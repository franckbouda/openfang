//! Kernel lifecycle management for the desktop app.
//!
//! Boots the OpenFang kernel, binds to a random localhost port, and runs the
//! API server on a background thread with its own tokio runtime.

use openfang_api::server::build_router;
use openfang_kernel::OpenFangKernel;
use std::net::{SocketAddr, TcpListener};
use std::sync::Arc;
use tokio::sync::watch;
use tracing::{error, info, warn};

/// Handle to the running embedded server. Drop or call `shutdown()` to stop.
pub struct ServerHandle {
    /// The port the server is listening on.
    pub port: u16,
    /// The kernel instance (shared with the server).
    pub kernel: Arc<OpenFangKernel>,
    /// Display key for vault (if newly generated).
    pub vault_display_key: Option<String>,
    /// Send `true` to trigger graceful shutdown.
    shutdown_tx: watch::Sender<bool>,
    /// Join handle for the background server thread.
    server_thread: Option<std::thread::JoinHandle<()>>,
}

impl ServerHandle {
    /// Signal the server to shut down and wait for the background thread.
    pub fn shutdown(mut self) {
        let _ = self.shutdown_tx.send(true);
        if let Some(handle) = self.server_thread.take() {
            let _ = handle.join();
        }
        self.kernel.shutdown();
        info!("OpenFang embedded server stopped");
    }
}

impl Drop for ServerHandle {
    fn drop(&mut self) {
        let _ = self.shutdown_tx.send(true);
        // Best-effort: don't block in drop, the thread will exit on its own.
    }
}

/// Enrich the process PATH so subprocesses (e.g. `claude` CLI) can be found
/// in GUI apps that inherit a minimal PATH from launchd.
fn enrich_path() {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut extra: Vec<String> = Vec::new();

    // User-local binaries (npm --prefix ~/.local, pipx, cargo, etc.)
    if !home.is_empty() {
        let candidates = [
            format!("{home}/.local/bin"),
            format!("{home}/.npm-global/bin"),
            format!("{home}/.yarn/bin"),
            format!("{home}/.cargo/bin"),
        ];
        for c in &candidates {
            if std::path::Path::new(c).exists() {
                extra.push(c.clone());
            }
        }

        // NVM: add the latest installed node version's bin
        let nvm_base = std::path::PathBuf::from(&home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm_base) {
            let mut versions: Vec<_> = entries.flatten().collect();
            versions.sort_by_key(|e| std::cmp::Reverse(e.file_name()));
            if let Some(latest) = versions.first() {
                let bin = latest.path().join("bin");
                if bin.exists() {
                    extra.push(bin.to_string_lossy().to_string());
                }
            }
        }
    }

    // System package managers
    for p in &["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin"] {
        if std::path::Path::new(p).exists() {
            extra.push(p.to_string());
        }
    }

    if extra.is_empty() {
        return;
    }

    let current = std::env::var("PATH").unwrap_or_default();
    let new_path = format!("{}:{}", extra.join(":"), current);
    std::env::set_var("PATH", &new_path);
    info!("Enriched PATH with {} extra directories", extra.len());
}

/// Boot the kernel and start the embedded API server on a background thread.
///
/// Binds to `127.0.0.1:0` on the calling thread so the port is known before
/// any Tauri window is created. The actual axum server runs on a dedicated
/// thread with its own tokio runtime.
pub fn start_server() -> Result<ServerHandle, Box<dyn std::error::Error>> {
    // Enrich PATH for GUI app context (launchd has minimal PATH)
    enrich_path();

    // Auto-initialize vault and migrate config.toml secrets
    let home = openfang_kernel::config::openfang_home();
    let vault_path = home.join("vault.enc");
    let config_path = home.join("config.toml");
    let mut vault_display_key: Option<String> = None;

    if !vault_path.exists() {
        let mut vault = openfang_extensions::vault::CredentialVault::new(vault_path.clone());
        match vault.init_and_get_display_key() {
            Ok(Some(key)) => {
                info!("Vault created with new master key");
                vault_display_key = Some(key.as_str().to_string());
            }
            Ok(None) => info!("Vault created (key from OS keyring)"),
            Err(e) => warn!("Could not init vault: {e}"),
        }
    }

    if vault_path.exists() && config_path.exists() {
        let mut vault = openfang_extensions::vault::CredentialVault::new(vault_path.clone());
        if vault.unlock().is_ok() {
            match openfang_extensions::credentials::migrate_config_to_vault(
                &config_path,
                &mut vault,
            ) {
                Ok(migrated) if !migrated.is_empty() => {
                    info!(
                        "Migrated {} credential(s) from config.toml to vault: {}",
                        migrated.len(),
                        migrated.join(", ")
                    );
                }
                Ok(_) => {}
                Err(e) => warn!("Migration config.toml→vault skipped: {e}"),
            }
        }
    }

    // Boot kernel (sync — no tokio needed)
    let kernel = OpenFangKernel::boot(None)?;
    let kernel = Arc::new(kernel);
    kernel.set_self_handle();

    // Bind to a random free port on localhost (main thread — guarantees port)
    let std_listener = TcpListener::bind("127.0.0.1:0")?;
    let port = std_listener.local_addr()?.port();
    let listen_addr: SocketAddr = std_listener.local_addr()?;

    info!("OpenFang embedded server bound to http://127.0.0.1:{port}");

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let kernel_clone = kernel.clone();

    let server_thread = std::thread::Builder::new()
        .name("openfang-server".into())
        .spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime for embedded server");

            rt.block_on(async move {
                // start_background_agents() uses tokio::spawn, so it must
                // run inside a tokio runtime context.
                kernel_clone.start_background_agents();
                run_embedded_server(kernel_clone, std_listener, listen_addr, shutdown_rx).await;
            });
        })?;

    Ok(ServerHandle {
        port,
        kernel,
        vault_display_key,
        shutdown_tx,
        server_thread: Some(server_thread),
    })
}

/// Run the axum server inside a tokio runtime, shut down when the watch
/// channel fires.
async fn run_embedded_server(
    kernel: Arc<OpenFangKernel>,
    std_listener: TcpListener,
    listen_addr: SocketAddr,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let (app, state) = build_router(kernel, listen_addr).await;

    // Convert std TcpListener → tokio TcpListener
    std_listener
        .set_nonblocking(true)
        .expect("Failed to set listener to non-blocking");
    let listener = tokio::net::TcpListener::from_std(std_listener)
        .expect("Failed to convert std TcpListener to tokio");

    info!("OpenFang embedded server listening on http://{listen_addr}");

    let server = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        let _ = shutdown_rx.wait_for(|v| *v).await;
        info!("Embedded server received shutdown signal");
    });

    if let Err(e) = server.await {
        error!("Embedded server error: {e}");
    }

    // Clean up channel bridges
    {
        let mut guard = state.bridge_manager.lock().await;
        if let Some(ref mut b) = *guard {
            b.stop().await;
        }
    }
}

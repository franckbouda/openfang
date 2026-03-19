//! Credential resolution chain — resolves secrets from multiple sources.
//!
//! Resolution order:
//! 1. Encrypted vault (`~/.openfang/vault.enc`)
//! 2. Dotenv file (`~/.openfang/.env`)
//! 3. Process environment variable
//! 4. Interactive prompt (CLI only, when `interactive` is true)

use crate::vault::CredentialVault;
use crate::ExtensionResult;
use std::collections::HashMap;
use std::path::Path;
use tracing::debug;
use zeroize::Zeroizing;

/// Credential resolver — tries multiple sources in priority order.
pub struct CredentialResolver {
    /// Reference to the credential vault.
    vault: Option<CredentialVault>,
    /// Dotenv entries (loaded from `~/.openfang/.env`). Values are zeroized on drop.
    dotenv: HashMap<String, Zeroizing<String>>,
    /// Whether to prompt interactively as a last resort.
    interactive: bool,
}

impl CredentialResolver {
    /// Create a resolver with optional vault and dotenv path.
    pub fn new(vault: Option<CredentialVault>, dotenv_path: Option<&Path>) -> Self {
        let dotenv: HashMap<String, Zeroizing<String>> = if let Some(path) = dotenv_path {
            load_dotenv(path)
                .unwrap_or_default()
                .into_iter()
                .map(|(k, v)| (k, Zeroizing::new(v)))
                .collect()
        } else {
            HashMap::new()
        };
        Self {
            vault,
            dotenv,
            interactive: false,
        }
    }

    /// Enable interactive prompting as a last-resort source.
    pub fn with_interactive(mut self, interactive: bool) -> Self {
        self.interactive = interactive;
        self
    }

    /// Resolve a credential by key, trying all sources in order.
    pub fn resolve(&self, key: &str) -> Option<Zeroizing<String>> {
        // 1. Vault
        if let Some(ref vault) = self.vault {
            if vault.is_unlocked() {
                if let Some(val) = vault.get(key) {
                    debug!("Credential '{}' resolved from vault", key);
                    return Some(val);
                }
            }
        }

        // 2. Dotenv file
        if let Some(val) = self.dotenv.get(key) {
            debug!("Credential '{}' resolved from .env", key);
            return Some(Zeroizing::new(val.as_str().to_string()));
        }

        // 3. Environment variable
        if let Ok(val) = std::env::var(key) {
            debug!("Credential '{}' resolved from env var", key);
            return Some(Zeroizing::new(val));
        }

        // 4. Interactive prompt (CLI only)
        if self.interactive {
            if let Some(val) = prompt_secret(key) {
                debug!("Credential '{}' resolved from interactive prompt", key);
                return Some(val);
            }
        }

        None
    }

    /// Check if a credential is available (without prompting).
    pub fn has_credential(&self, key: &str) -> bool {
        // Check vault
        if let Some(ref vault) = self.vault {
            if vault.is_unlocked() && vault.get(key).is_some() {
                return true;
            }
        }
        // Check dotenv
        if self.dotenv.contains_key(key) {
            return true;
        }
        // Check env
        std::env::var(key).is_ok()
    }

    /// Resolve all required credentials for an integration.
    /// Returns a map of env_var_name -> value for all resolved credentials.
    pub fn resolve_all(&self, keys: &[&str]) -> HashMap<String, Zeroizing<String>> {
        let mut result = HashMap::new();
        for key in keys {
            if let Some(val) = self.resolve(key) {
                result.insert(key.to_string(), val);
            }
        }
        result
    }

    /// Check which credentials are missing.
    pub fn missing_credentials(&self, keys: &[&str]) -> Vec<String> {
        keys.iter()
            .filter(|k| !self.has_credential(k))
            .map(|k| k.to_string())
            .collect()
    }

    /// Store a credential in the vault (if available).
    pub fn store_in_vault(&mut self, key: &str, value: Zeroizing<String>) -> ExtensionResult<()> {
        if let Some(ref mut vault) = self.vault {
            vault.set(key.to_string(), value)?;
            Ok(())
        } else {
            Err(crate::ExtensionError::Vault(
                "No vault configured".to_string(),
            ))
        }
    }

    /// Remove a credential from the vault (if available).
    pub fn remove_from_vault(&mut self, key: &str) -> ExtensionResult<bool> {
        if let Some(ref mut vault) = self.vault {
            vault.remove(key)
        } else {
            Err(crate::ExtensionError::Vault(
                "No vault configured".to_string(),
            ))
        }
    }
}

/// Load a dotenv file into a HashMap.
fn load_dotenv(path: &Path) -> Result<HashMap<String, String>, std::io::Error> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = std::fs::read_to_string(path)?;
    let mut map = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let mut value = value.trim().to_string();
            // Strip surrounding quotes
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value = value[1..value.len() - 1].to_string();
            }
            map.insert(key.to_string(), value);
        }
    }
    Ok(map)
}

/// Mask a secret token for display: if > 8 chars, show first 4 + **** + last 4, else ****.
fn mask_token(token: &str) -> String {
    if token.len() > 8 {
        format!("{}****{}", &token[..4], &token[token.len() - 4..])
    } else {
        "****".to_string()
    }
}

/// Migrate secrets from a `.env` file into the encrypted vault.
///
/// For each `KEY=VALUE` line (non-comment, non-empty value) where the key is
/// not already in the vault, the value is stored in the vault and the `.env`
/// line is replaced with a masked comment + empty assignment.
///
/// Returns the list of migrated key names.
pub fn migrate_dotenv_to_vault(
    dotenv_path: &Path,
    vault: &mut CredentialVault,
) -> ExtensionResult<Vec<String>> {
    if !dotenv_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(dotenv_path)?;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut output_lines: Vec<String> = Vec::new();
    let mut migrated: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Pass through empty lines and comments unchanged
        if trimmed.is_empty() || trimmed.starts_with('#') {
            output_lines.push(line.to_string());
            continue;
        }

        // Try to parse KEY=VALUE
        if let Some((raw_key, raw_value)) = trimmed.split_once('=') {
            let key = raw_key.trim();
            let mut value = raw_value.trim().to_string();

            // Strip surrounding quotes
            if value.len() >= 2
                && ((value.starts_with('"') && value.ends_with('"'))
                    || (value.starts_with('\'') && value.ends_with('\'')))
            {
                value = value[1..value.len() - 1].to_string();
            }

            // Skip empty values, already-in-vault keys
            if value.is_empty() || vault.get(key).is_some() {
                output_lines.push(line.to_string());
                continue;
            }

            // Migrate: store in vault
            let masked = mask_token(&value);
            vault.set(key.to_string(), Zeroizing::new(value))?;

            output_lines.push(format!(
                "# VAULT:{key}={masked} (migrated to vault {today})"
            ));
            output_lines.push(format!("{key}="));
            migrated.push(key.to_string());
        } else {
            // Line without '=' — keep as-is
            output_lines.push(line.to_string());
        }
    }

    // Rewrite the .env file
    let mut final_content = output_lines.join("\n");
    // Preserve trailing newline if original had one
    if content.ends_with('\n') {
        final_content.push('\n');
    }
    std::fs::write(dotenv_path, final_content)?;

    Ok(migrated)
}

/// Detect if a value looks like a raw API key (not an env var name).
fn looks_like_raw_api_key(value: &str) -> bool {
    // Valid env var names are ALL_CAPS with digits and underscores only
    if value
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
    {
        return false;
    }
    // Known API key prefixes
    if value.starts_with("gsk_")
        || value.starts_with("sk-ant-")
        || value.starts_with("sk-")
        || value.starts_with("ghp_")
        || value.starts_with("ghu_")
        || value.starts_with("xoxb-")
        || value.starts_with("xapp-")
        || value.starts_with("AIza")
        || value.starts_with("ya29.")
    {
        return true;
    }
    // Long mixed-case strings likely raw keys
    value.len() > 40 && value.chars().any(|c| c.is_ascii_lowercase())
}

/// Derive a vault key name from the raw API key value.
fn derive_vault_key(value: &str) -> String {
    if value.starts_with("gsk_") {
        return "GROQ_API_KEY".to_string();
    }
    if value.starts_with("sk-ant-") {
        return "ANTHROPIC_API_KEY".to_string();
    }
    if value.starts_with("sk-") {
        return "OPENAI_API_KEY".to_string();
    }
    if value.starts_with("ghp_") || value.starts_with("ghu_") {
        return "GITHUB_TOKEN".to_string();
    }
    if value.starts_with("xoxb-") {
        return "SLACK_BOT_TOKEN".to_string();
    }
    if value.starts_with("xapp-") {
        return "SLACK_APP_TOKEN".to_string();
    }
    "OPENFANG_SECRET".to_string()
}

/// Migrate raw API keys from `config.toml` to the vault.
///
/// Scans TOML lines for `field = "VALUE"` where VALUE looks like a raw API key.
/// Stores the value in the vault, replaces the line with the derived env var name,
/// and adds a masked comment above.
///
/// Returns the list of vault keys that were migrated.
pub fn migrate_config_to_vault(
    config_path: &std::path::Path,
    vault: &mut crate::vault::CredentialVault,
) -> crate::ExtensionResult<Vec<String>> {
    if !config_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(config_path)?;
    let mut new_lines: Vec<String> = Vec::new();
    let mut migrated: Vec<String> = Vec::new();

    // Regex-like parsing: match lines of the form:  key = "value"
    // We do this manually to preserve all formatting/comments.
    for line in content.lines() {
        let trimmed = line.trim();

        // Skip comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with('#') {
            new_lines.push(line.to_string());
            continue;
        }

        // Try to parse: field = "value"
        if let Some((field_part, rest)) = line.split_once('=') {
            let field = field_part.trim();
            let rest = rest.trim();

            // Check it's a quoted string value (may have trailing inline comment like # ...)
            if let Some(stripped) = rest.strip_prefix('"') {
                // Find the closing quote (first `"` after the opening one)
                if let Some(close_pos) = stripped.find('"') {
                    let value = &stripped[..close_pos];

                    if !value.is_empty() && looks_like_raw_api_key(value) {
                        let vault_key = derive_vault_key(value);

                        // Skip if already in vault
                        if vault.get(&vault_key).is_some() {
                            new_lines.push(line.to_string());
                            continue;
                        }

                        // Store in vault
                        vault.set(
                            vault_key.clone(),
                            zeroize::Zeroizing::new(value.to_string()),
                        )?;

                        // Build the masked comment + replacement line
                        let masked = mask_token(value);
                        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
                        let comment = format!(
                            "# VAULT:{}={} (migrated to vault {})",
                            vault_key, masked, date
                        );

                        // Preserve leading whitespace from original line
                        let indent: String =
                            line.chars().take_while(|c| c.is_whitespace()).collect();

                        new_lines.push(format!("{}{}", indent, comment));
                        new_lines.push(format!("{}{} = \"{}\"", indent, field, vault_key));

                        migrated.push(vault_key);
                        continue;
                    }
                }
            }
        }

        new_lines.push(line.to_string());
    }

    if !migrated.is_empty() {
        let new_content = new_lines.join("\n");
        // Preserve trailing newline if original had one
        let final_content = if content.ends_with('\n') {
            format!("{}\n", new_content)
        } else {
            new_content
        };
        std::fs::write(config_path, final_content)?;
    }

    Ok(migrated)
}

/// Prompt the user interactively for a secret value.
fn prompt_secret(key: &str) -> Option<Zeroizing<String>> {
    use std::io::{self, Write};

    eprint!("Enter value for {}: ", key);
    io::stderr().flush().ok()?;

    let mut input = String::new();
    io::stdin().read_line(&mut input).ok()?;
    let trimmed = input.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(Zeroizing::new(trimmed))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_dotenv_basic() {
        let dir = tempfile::tempdir().unwrap();
        let env_path = dir.path().join(".env");
        std::fs::write(
            &env_path,
            r#"
# Comment
GITHUB_TOKEN=ghp_test123
SLACK_TOKEN="xoxb-quoted"
EMPTY=
SINGLE_QUOTED='single'
"#,
        )
        .unwrap();

        let map = load_dotenv(&env_path).unwrap();
        assert_eq!(map.get("GITHUB_TOKEN").unwrap(), "ghp_test123");
        assert_eq!(map.get("SLACK_TOKEN").unwrap(), "xoxb-quoted");
        assert_eq!(map.get("EMPTY").unwrap(), "");
        assert_eq!(map.get("SINGLE_QUOTED").unwrap(), "single");
    }

    #[test]
    fn load_dotenv_nonexistent() {
        let map = load_dotenv(Path::new("/nonexistent/.env")).unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn resolver_env_var() {
        std::env::set_var("TEST_CRED_RESOLVE_123", "from_env");
        let resolver = CredentialResolver::new(None, None);
        let val = resolver.resolve("TEST_CRED_RESOLVE_123").unwrap();
        assert_eq!(val.as_str(), "from_env");
        assert!(resolver.has_credential("TEST_CRED_RESOLVE_123"));
        std::env::remove_var("TEST_CRED_RESOLVE_123");
    }

    #[test]
    fn resolver_dotenv_overrides_env() {
        let dir = tempfile::tempdir().unwrap();
        let env_path = dir.path().join(".env");
        std::fs::write(&env_path, "TEST_CRED_DOT_456=from_dotenv\n").unwrap();

        std::env::set_var("TEST_CRED_DOT_456", "from_env");

        let resolver = CredentialResolver::new(None, Some(&env_path));
        let val = resolver.resolve("TEST_CRED_DOT_456").unwrap();
        assert_eq!(val.as_str(), "from_dotenv"); // dotenv takes priority

        std::env::remove_var("TEST_CRED_DOT_456");
    }

    #[test]
    fn resolver_missing_credentials() {
        let resolver = CredentialResolver::new(None, None);
        let missing = resolver.missing_credentials(&["DEFINITELY_NOT_SET_XYZ_789"]);
        assert_eq!(missing, vec!["DEFINITELY_NOT_SET_XYZ_789"]);
    }

    // --- migrate_dotenv_to_vault tests ---

    fn test_vault_unlocked() -> (tempfile::TempDir, crate::vault::CredentialVault) {
        use rand::RngCore;
        let dir = tempfile::tempdir().unwrap();
        let vault_path = dir.path().join("vault.enc");
        let mut vault = crate::vault::CredentialVault::new(vault_path);
        let mut kb = Zeroizing::new([0u8; 32]);
        rand::rngs::OsRng.fill_bytes(kb.as_mut());
        vault.init_with_key(kb).unwrap();
        (dir, vault)
    }

    #[test]
    fn migrate_basic_token() {
        let (dir, mut vault) = test_vault_unlocked();
        let env_path = dir.path().join(".env");
        std::fs::write(&env_path, "MY_TOKEN=abcdefghijklmnop\n").unwrap();

        let migrated = migrate_dotenv_to_vault(&env_path, &mut vault).unwrap();
        assert_eq!(migrated, vec!["MY_TOKEN"]);

        // Value is now in vault
        let val = vault.get("MY_TOKEN").unwrap();
        assert_eq!(val.as_str(), "abcdefghijklmnop");

        // .env file should have masked comment and empty value
        let content = std::fs::read_to_string(&env_path).unwrap();
        assert!(content.contains("# VAULT:MY_TOKEN=abcd****mnop"));
        assert!(content.contains("MY_TOKEN=\n") || content.contains("MY_TOKEN="));
        // Value should NOT be in the .env anymore
        assert!(!content.contains("abcdefghijklmnop"));
    }

    #[test]
    fn migrate_skip_already_in_vault() {
        let (dir, mut vault) = test_vault_unlocked();
        let env_path = dir.path().join(".env");
        std::fs::write(&env_path, "EXISTING_KEY=some_value_here\n").unwrap();

        // Pre-populate vault
        vault
            .set(
                "EXISTING_KEY".to_string(),
                Zeroizing::new("vault_value".to_string()),
            )
            .unwrap();

        let migrated = migrate_dotenv_to_vault(&env_path, &mut vault).unwrap();
        assert!(migrated.is_empty());

        // .env file should be unchanged
        let content = std::fs::read_to_string(&env_path).unwrap();
        assert!(content.contains("EXISTING_KEY=some_value_here"));
    }

    #[test]
    fn migrate_skip_empty_and_comments() {
        let (dir, mut vault) = test_vault_unlocked();
        let env_path = dir.path().join(".env");
        std::fs::write(
            &env_path,
            "# This is a comment\n\nEMPTY_VAL=\nREAL_KEY=realvalue1\n",
        )
        .unwrap();

        let migrated = migrate_dotenv_to_vault(&env_path, &mut vault).unwrap();
        assert_eq!(migrated, vec!["REAL_KEY"]);

        let content = std::fs::read_to_string(&env_path).unwrap();
        // Comment and empty line preserved
        assert!(content.contains("# This is a comment"));
        // Empty value line preserved as-is
        assert!(content.contains("EMPTY_VAL="));
        // Real key migrated — value cleared
        assert!(!content.contains("realvalue1"));
        assert!(content.contains("REAL_KEY=\n") || content.ends_with("REAL_KEY="));
    }

    #[test]
    fn migrate_nonexistent_file_returns_empty() {
        let (_dir, mut vault) = test_vault_unlocked();
        let result =
            migrate_dotenv_to_vault(Path::new("/tmp/nonexistent_dotenv_test/.env"), &mut vault)
                .unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn migrate_config_raw_groq_key() {
        use crate::vault::CredentialVault;
        use zeroize::Zeroizing;

        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        std::fs::write(
            &config_path,
            r#"[default_model]
provider = "groq"
api_key_env = "gsk_testkey1234567890abcdefghijklmnopqrstuvwxyz"
"#,
        )
        .unwrap();

        let vault_path = dir.path().join("vault.enc");
        let mut vault = CredentialVault::new(vault_path);
        let mut key = Zeroizing::new([0u8; 32]);
        use aes_gcm::aead::OsRng;
        use rand::RngCore;
        OsRng.fill_bytes(key.as_mut());
        vault.init_with_key(key).unwrap();

        let migrated = migrate_config_to_vault(&config_path, &mut vault).unwrap();
        assert_eq!(migrated, vec!["GROQ_API_KEY"]);
        assert!(vault.get("GROQ_API_KEY").is_some());

        let new_content = std::fs::read_to_string(&config_path).unwrap();
        assert!(new_content.contains("# VAULT:GROQ_API_KEY="));
        assert!(new_content.contains(r#"api_key_env = "GROQ_API_KEY""#));
        assert!(!new_content.contains("gsk_testkey"));
    }

    #[test]
    fn migrate_config_skips_env_var_name() {
        use crate::vault::CredentialVault;
        use zeroize::Zeroizing;

        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        std::fs::write(
            &config_path,
            r#"api_key_env = "GROQ_API_KEY"
"#,
        )
        .unwrap();

        let vault_path = dir.path().join("vault.enc");
        let mut vault = CredentialVault::new(vault_path);
        let mut key = Zeroizing::new([0u8; 32]);
        use aes_gcm::aead::OsRng;
        use rand::RngCore;
        OsRng.fill_bytes(key.as_mut());
        vault.init_with_key(key).unwrap();

        let migrated = migrate_config_to_vault(&config_path, &mut vault).unwrap();
        assert!(migrated.is_empty());
    }

    #[test]
    fn migrate_config_skips_if_already_in_vault() {
        use crate::vault::CredentialVault;
        use zeroize::Zeroizing;

        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        std::fs::write(
            &config_path,
            r#"api_key_env = "gsk_testkey1234567890abcdefghijklmnopqrstuvwxyz"
"#,
        )
        .unwrap();

        let vault_path = dir.path().join("vault.enc");
        let mut vault = CredentialVault::new(vault_path);
        let mut key = Zeroizing::new([0u8; 32]);
        use aes_gcm::aead::OsRng;
        use rand::RngCore;
        OsRng.fill_bytes(key.as_mut());
        vault.init_with_key(key).unwrap();
        vault
            .set(
                "GROQ_API_KEY".to_string(),
                Zeroizing::new("existing".to_string()),
            )
            .unwrap();

        let migrated = migrate_config_to_vault(&config_path, &mut vault).unwrap();
        assert!(migrated.is_empty());
    }

    #[test]
    fn resolver_resolve_all() {
        std::env::set_var("TEST_MULTI_A", "a_val");
        std::env::set_var("TEST_MULTI_B", "b_val");

        let resolver = CredentialResolver::new(None, None);
        let resolved = resolver.resolve_all(&["TEST_MULTI_A", "TEST_MULTI_B", "TEST_MULTI_C"]);
        assert_eq!(resolved.len(), 2);
        assert_eq!(resolved["TEST_MULTI_A"].as_str(), "a_val");
        assert_eq!(resolved["TEST_MULTI_B"].as_str(), "b_val");

        std::env::remove_var("TEST_MULTI_A");
        std::env::remove_var("TEST_MULTI_B");
    }
}

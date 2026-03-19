# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
OpenFang is an open-source Agent Operating System written in Rust — 14 crates, ~137K LOC.
- Config: `~/.openfang/config.toml`
- Default API: `http://127.0.0.1:4200`
- CLI binary: `target/release/openfang` (or `target/debug/openfang`)
- Workspace version: defined in root `Cargo.toml` under `[workspace.package]`

## Build & Verify Commands
After every feature implementation, run ALL THREE checks:
```bash
cargo build --workspace --lib          # Must compile (use --lib if binary is locked by running daemon)
cargo test --workspace                 # All tests must pass
cargo clippy --workspace --all-targets -- -D warnings  # Zero warnings
```

Other useful commands:
```bash
cargo fmt --all -- --check             # Check formatting
cargo test -p openfang-runtime         # Test a single crate
cargo test -p openfang-kernel -- scheduler  # Run tests matching "scheduler" in one crate
cargo build --release -p openfang-cli  # Build release binary only
```

## Architecture — Data Flow

```
config.toml → KernelConfig → OpenFangKernel → AppState (server.rs) → routes.rs (Axum handlers)
                                  ↓
                            agent_loop.rs ←→ LlmDriver trait (5 drivers)
                                  ↓
                            tool_runner.rs (53 built-in tools + MCP + A2A)
```

### Crate Dependency Layers (top → bottom)
```
openfang-cli          CLI + TUI (ratatui) + daemon launcher — DO NOT MODIFY (user actively building)
openfang-desktop      Tauri 2.0 native app
openfang-api          Axum server, 140+ REST/WS/SSE routes, OpenAI-compatible API, dashboard
openfang-kernel       Orchestration: agent registry, scheduler, workflows, metering, RBAC, budget
openfang-runtime      Agent loop, 5 LLM drivers, 53 tools, WASM sandbox, MCP client/server, A2A
openfang-channels     40 messaging adapters (Telegram, Discord, Slack, etc.)
openfang-hands        7 autonomous Hands + HAND.toml parser + lifecycle
openfang-skills       Bundled skills, SKILL.md parser, FangHub marketplace
openfang-extensions   MCP templates, AES-256-GCM credential vault, OAuth2 PKCE
openfang-memory       SQLite persistence, vector embeddings, session management, compaction
openfang-wire         OFP P2P protocol, HMAC-SHA256 mutual auth
openfang-migrate      Migration engine (OpenClaw, LangChain, AutoGPT)
openfang-types        Shared types, taint tracking, Ed25519 signing, model catalog — NO business logic
xtask                 Build automation
```

### Key Architectural Patterns

- **`KernelHandle` trait** (`runtime/src/kernel_handle.rs`): Breaks the circular dependency between `openfang-runtime` and `openfang-kernel`. The kernel implements this trait; the agent loop receives it as a `dyn KernelHandle` to call back into the kernel (spawn/kill/message agents, shared memory).

- **`AppState`** (`api/src/routes.rs`): Bridges kernel to API routes. Holds `Arc<OpenFangKernel>`, peer registry, bridge manager, channel config, and shutdown notifier.

- **LLM Drivers** (`runtime/src/drivers/`): 5 drivers implementing the `LlmDriver` trait — `anthropic.rs`, `gemini.rs`, `openai.rs` (covers 20+ OpenAI-compatible providers), `copilot.rs`, `claude_code.rs`. Plus `fallback.rs` for resilient routing.

- **Agent Loop** (`runtime/src/agent_loop.rs`): Core execution cycle — receives message → recalls memories → calls LLM → executes tool calls → saves conversation. Max 50 iterations, 120s tool timeout, exponential backoff on rate limits.

## Adding New Features — Checklist

### New API Route
1. Add handler function in `crates/openfang-api/src/routes.rs`
2. Register route in `crates/openfang-api/src/server.rs` router
3. Add request/response types in `crates/openfang-api/src/types.rs` if needed

### New Config Field
1. Add field to `KernelConfig` struct in `crates/openfang-types/src/config.rs`
2. Add `#[serde(default)]` on the field (or `#[serde(default = "...")]`)
3. Add the field to the `Default` impl — build fails without this
4. Ensure `Serialize` + `Deserialize` derives are present

### Dashboard UI
- Alpine.js SPA in `static/index_body.html`
- New tabs need both HTML markup and JS data/methods in the same file

## Common Gotchas
- Binary may be locked if daemon is running — use `--lib` flag or kill daemon first
- `PeerRegistry` is `Option<PeerRegistry>` on kernel but `Option<Arc<PeerRegistry>>` on `AppState` — wrap with `.as_ref().map(|r| Arc::new(r.clone()))`
- `AgentLoopResult` field is `.response` not `.response_text`
- CLI command to start daemon is `start` (not `daemon`)
- On macOS: `pkill -f openfang` or `kill <pid>` to stop daemon
- On Windows: `taskkill //PID <pid> //F` (double slashes in MSYS2/Git Bash)

## Live Integration Testing
After implementing any new endpoint or wiring change, unit tests alone are insufficient. Run the daemon and test with curl:

```bash
# Stop any running daemon
pkill -f openfang || true
sleep 2

# Build and start
cargo build --release -p openfang-cli
GROQ_API_KEY=<key> ./target/release/openfang start &
sleep 6
curl -s http://127.0.0.1:4200/api/health  # Verify it's up

# Test endpoints (examples)
curl -s http://127.0.0.1:4200/api/agents
curl -s -X POST "http://127.0.0.1:4200/api/agents/<id>/message" \
  -H "Content-Type: application/json" -d '{"message": "Say hello in 5 words."}'
curl -s http://127.0.0.1:4200/api/budget

# Cleanup
pkill -f openfang
```

### Key API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/agents` | GET | List all agents |
| `/api/agents/{id}/message` | POST | Send message (triggers LLM) |
| `/api/budget` | GET/PUT | Global budget status/update |
| `/api/budget/agents` | GET | Per-agent cost ranking |
| `/api/network/status` | GET | OFP network status |
| `/api/peers` | GET | Connected OFP peers |
| `/api/a2a/agents` | GET | External A2A agents |
| `/api/a2a/discover` | POST | Discover A2A agent at URL |
| `/api/a2a/send` | POST | Send task to external A2A agent |
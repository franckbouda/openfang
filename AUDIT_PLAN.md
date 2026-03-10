# Plan d'amelioration et correction — OpenFang

> Audit realise le 2026-03-07 sur 152K LOC, 13 crates Rust.
> Score global : 7.5/10

---

## Phase 1 — CRITIQUE (Jours 1-5)

### 1.1 Injection SQL — semantic.rs
- **Fichier**: `crates/openfang-memory/src/semantic.rs:156`
- **Probleme**: Clause LIMIT inseree via `format!()` au lieu de parametres bindes
- **Severite**: CRITIQUE (CVSS 9+)
- **Correction**: Utiliser les parametres SQLite bindes (`?1`) au lieu de `format!`
- **Effort**: 30 minutes
- **Verification**: `cargo test -p openfang-memory`

### 1.2 JSON parsing silencieusement casse (15+ occurrences)
- **Fichiers**: `drivers/anthropic.rs`, `drivers/openai.rs`, `drivers/gemini.rs`, `tool_runner.rs`, `memory/*.rs`
- **Probleme**: `serde_json::from_str(&args).unwrap_or_default()` → outils executes avec `{}` vide
- **Impact**: Un outil `send_email` pourrait partir sans destinataire, impossible a debugger
- **Correction**: Retourner une erreur explicite `ToolError::InvalidArguments` au lieu de `unwrap_or_default()`
- **Effort**: 2-3 jours
- **Fichiers a modifier**:
  - [ ] `crates/openfang-runtime/src/drivers/anthropic.rs` (~5 occurrences)
  - [ ] `crates/openfang-runtime/src/drivers/openai.rs` (~5 occurrences)
  - [ ] `crates/openfang-runtime/src/drivers/gemini.rs` (~3 occurrences)
  - [ ] `crates/openfang-runtime/src/tool_runner.rs`
  - [ ] `crates/openfang-memory/src/*.rs` (~7 occurrences)
- **Verification**: `cargo test --workspace`

### 1.3 Streaming errors ignores (20+ occurrences)
- **Fichiers**: `drivers/anthropic.rs`, `drivers/openai.rs`, `channels/*`
- **Probleme**: `let _ = tx.send(StreamEvent::...).await;` → erreur ignoree
- **Impact**: Client deconnecte → agent continue en zombie, etat incoherent
- **Correction**: Remplacer par :
  ```rust
  if tx.send(StreamEvent::...).await.is_err() {
      warn!("Client deconnecte, arret du streaming");
      return Err(LlmError::StreamClosed);
  }
  ```
- **Effort**: 1-2 jours
- **Fichiers a modifier**:
  - [ ] `crates/openfang-runtime/src/drivers/anthropic.rs` (~5 occurrences)
  - [ ] `crates/openfang-runtime/src/drivers/openai.rs` (~5 occurrences)
  - [ ] `crates/openfang-channels/src/*.rs` (~10 occurrences)
- **Verification**: `cargo test -p openfang-runtime && cargo clippy --workspace --all-targets -- -D warnings`

### 1.4 Timing attack sur API key
- **Fichier**: `crates/openfang-api/src/middleware.rs:131-152`
- **Probleme**: `if token.len() != api_key.len()` retourne immediatement → fuite de timing
- **Correction**: Utiliser comparaison constant-time sans early return sur la longueur
  ```rust
  use subtle::ConstantTimeEq;
  let is_valid = token.as_bytes().ct_eq(api_key.as_bytes()).into();
  ```
- **Effort**: 1 heure
- **Dependance**: Ajouter `subtle` dans Cargo.toml
- **Verification**: `cargo test -p openfang-api`

### 1.5 Timeouts manquants sur drivers LLM
- **Fichiers**: `drivers/anthropic.rs`, `drivers/openai.rs`, `drivers/gemini.rs`
- **Probleme**: `reqwest::Client::new()` sans timeout global → appels bloquants indefiniment
- **Correction**:
  ```rust
  reqwest::Client::builder()
      .timeout(Duration::from_secs(120))
      .connect_timeout(Duration::from_secs(10))
      .build()?
  ```
- **Effort**: 2 heures
- **Fichiers a modifier**:
  - [ ] `crates/openfang-runtime/src/drivers/anthropic.rs`
  - [ ] `crates/openfang-runtime/src/drivers/openai.rs`
  - [ ] `crates/openfang-runtime/src/drivers/gemini.rs`
  - [ ] `crates/openfang-runtime/src/drivers/copilot.rs`
- **Verification**: `cargo test -p openfang-runtime`

---

## Phase 2 — HAUTE PRIORITE (Jours 6-15)

### 2.1 Unsafe blocks sans synchronisation
- **Fichier**: `crates/openfang-api/src/routes.rs:4270-4285, 4320+`
- **Probleme**: Mutation d'etat global (env vars, pointeurs raw) sans Mutex → race conditions
- **Correction**: Utiliser `Arc<RwLock<Config>>` au lieu de unsafe + env vars
- **Effort**: 1 jour

### 2.2 Unsafe FFI — conversion PID
- **Fichier**: `crates/openfang-kernel/src/kernel.rs:3670-3675`
- **Probleme**: Conversion `u32 -> i32` sans verifier l'overflow
- **Correction**: Valider `pid <= i32::MAX` avant conversion, utiliser `std::process::Command` si possible
- **Effort**: 2 heures

### 2.3 Taint checking — blacklist contournable
- **Fichier**: `crates/openfang-runtime/src/tool_runner.rs:25-50`
- **Probleme**: Patterns hardcodes (curl, bash, eval) → contournements via `curl\0`, `sh -c`, etc.
- **Correction**: Passer a une whitelist de commandes autorisees
- **Effort**: 1-2 jours

### 2.4 Shell exec "Full" mode bypass
- **Fichier**: `crates/openfang-runtime/src/tool_runner.rs:228-240`
- **Probleme**: `exec_policy.mode = "full"` desactive completement le taint check
- **Correction**: Appliquer taint check meme en Full mode, ou implementer un approval gate
- **Effort**: 1 jour

### 2.5 Client HTTP partage (75 instances redondantes)
- **Fichiers**: `drivers/*.rs`, `web_fetch.rs`, `embedding.rs`, `a2a.rs`
- **Probleme**: ~75 instances de `reqwest::Client::new()` creees independamment
- **Impact**: Chaque client cree sa pool TCP/TLS → 10-100x plus de memoire
- **Correction**: Creer 1 `Arc<reqwest::Client>` au boot du kernel, le passer via config/context
- **Effort**: 1 jour
- **Fichiers a modifier**:
  - [ ] `crates/openfang-runtime/src/drivers/anthropic.rs`
  - [ ] `crates/openfang-runtime/src/drivers/openai.rs`
  - [ ] `crates/openfang-runtime/src/drivers/gemini.rs`
  - [ ] `crates/openfang-runtime/src/drivers/copilot.rs`
  - [ ] `crates/openfang-runtime/src/web_fetch.rs`
  - [ ] `crates/openfang-runtime/src/embedding.rs`
  - [ ] `crates/openfang-runtime/src/a2a.rs`
  - [ ] `crates/openfang-runtime/src/mcp.rs`

### 2.6 DashMap memory leak — running_tasks
- **Fichier**: `crates/openfang-kernel/src/kernel.rs:96`
- **Probleme**: `AbortHandle` jamais supprime apres completion → memoire croit O(n agents)
- **Correction**: Implementer cleanup on agent completion dans la boucle du kernel
- **Effort**: 2 heures

### 2.7 UPLOAD_REGISTRY sans TTL
- **Fichier**: `crates/openfang-api/src/routes.rs:202`
- **Probleme**: Uploads jamais supprimes → DoS possible (1MB x 10K = 10GB)
- **Correction**: Ajouter TTL 15min + tache de cleanup periodique
- **Effort**: 3 heures

### 2.8 Mutex global SQLite
- **Fichiers**: `crates/openfang-memory/src/session.rs`, `semantic.rs`, `substrate.rs`
- **Probleme**: `Arc<Mutex<Connection>>` serialise tous les acces → contention sous charge
- **Correction**: Migrer vers `tokio_rusqlite::Connection` (async wrapper) ou pool `r2d2`
- **Effort**: 2 jours

### 2.9 Endpoints sensibles sans authentification
- **Fichier**: `crates/openfang-api/src/middleware.rs:73-114`
- **Probleme**: `/api/agents`, `/api/budget`, `/api/providers` accessibles sans API key
- **Correction**: Mettre tous les endpoints `/api/*` sensibles derriere le middleware d'auth
- **Effort**: 3 heures

### 2.10 Prometheus default sur 0.0.0.0
- **Fichier**: `crates/openfang-kernel/src/kernel.rs:3629-3647`
- **Probleme**: Metrics exposees sur toutes les interfaces reseau par defaut
- **Correction**: Changer default a `127.0.0.1:9090` (loopback)
- **Effort**: 15 minutes

---

## Phase 3 — REFACTORING ARCHITECTURE (Jours 16-30)

### 3.1 Decouper routes.rs (10 247 lignes → 10-12 modules)
- **Fichier**: `crates/openfang-api/src/routes.rs`
- **Probleme**: 166 handlers dans 1 fichier, impossible a naviguer/tester
- **Correction**: Creer un repertoire `routes/` :
  ```
  routes/
    mod.rs              (AppState + re-exports)
    agents.rs           (~1200 LOC)
    chat.rs             (~900 LOC)
    sessions.rs         (~700 LOC)
    models.rs           (~400 LOC)
    budget.rs           (~600 LOC)
    workflows.rs        (~800 LOC)
    a2a.rs              (~500 LOC)
    skills.rs           (~400 LOC)
    network.rs          (~300 LOC)
    triggers.rs         (~400 LOC)
    uploads.rs          (~300 LOC)
    admin.rs            (~400 LOC)
  ```
- **Effort**: 3-4 jours
- **Verification**: `cargo test -p openfang-api && cargo clippy -p openfang-api -- -D warnings`

### 3.2 Decouper cli/main.rs (6 583 lignes)
- **Fichier**: `crates/openfang-cli/src/main.rs`
- **Note**: CLAUDE.md dit "DO NOT MODIFY" — a valider avec le proprietaire
- **Correction proposee**:
  ```
  cli/src/
    main.rs            (~500 LOC - entry point)
    ui/
      mod.rs
      dashboard.rs
      chat.rs
      agents.rs
      config.rs
    commands/          (~300 LOC par cmd)
    state.rs           (~400 LOC)
  ```
- **Effort**: 2-3 jours

### 3.3 Decouper execute_tool() (3000+ lignes)
- **Fichier**: `crates/openfang-runtime/src/tool_runner.rs`
- **Probleme**: Match block de 53 branches impossible a maintenir
- **Correction**: Extraire chaque categorie d'outil en sous-module :
  ```
  tools/
    mod.rs             (dispatch + ToolContext)
    filesystem.rs      (read, write, list, glob)
    network.rs         (web_fetch, curl, api calls)
    shell.rs           (bash, exec)
    collaboration.rs   (message, spawn, kill)
    memory.rs          (remember, recall, search)
    mcp.rs             (mcp_call, mcp_list)
  ```
- **Effort**: 3 jours

### 3.4 Decouper agent_loop (684 + 700 lignes)
- **Fichier**: `crates/openfang-runtime/src/agent_loop.rs`
- **Correction**: Extraire en fonctions de ~100 lignes :
  - `prepare_request()` — construction du CompletionRequest
  - `call_llm()` — appel driver + retry
  - `process_tool_calls()` — execution des outils
  - `save_conversation()` — persistance
  - `check_limits()` — iterations, budget, timeout
- **Effort**: 2 jours

### 3.5 Deduplication drivers openai/anthropic
- **Fichiers**: `drivers/openai.rs`, `drivers/anthropic.rs`
- **Probleme**: 150 lignes identiques de conversion de messages
- **Correction**: Extraire `build_messages()` dans un module `drivers/common.rs`
- **Effort**: 1 jour

---

## Phase 4 — TESTS (Jours 16-30, en parallele de Phase 3)

### 4.1 Tests drivers LLM (+60 tests)
- **Cible**: `crates/openfang-runtime/src/drivers/`
- **Couverture actuelle**: anthropic 2 tests, openai 3 tests
- **Tests a ajouter**:
  - [ ] Streaming responses (5 tests par driver)
  - [ ] Tool use / function calling (5 tests par driver)
  - [ ] Error retry logic 429/500 (3 tests par driver)
  - [ ] Token counting (2 tests par driver)
  - [ ] Timeout handling (2 tests par driver)
  - [ ] Malformed response handling (3 tests par driver)
- **Effort**: 3 jours

### 4.2 Tests config reload (+10 tests)
- **Cible**: `crates/openfang-kernel/src/config_reload.rs`
- **Couverture actuelle**: 0 tests
- **Tests a ajouter**:
  - [ ] Hot-reload sans restart
  - [ ] Agents recuperent les changements
  - [ ] Changement de chemin DB
  - [ ] Config invalide rejectee
  - [ ] Rollback sur erreur
- **Effort**: 1 jour

### 4.3 Tests budget enforcement (+8 tests)
- **Cible**: `crates/openfang-kernel/src/metering.rs`
- **Tests a ajouter**:
  - [ ] Depassement de limite globale
  - [ ] Depassement de limite par agent
  - [ ] Degradation gracieuse
  - [ ] Reset de budget
- **Effort**: 1 jour

### 4.4 Tests CLI integration (+15 tests)
- **Cible**: `crates/openfang-cli/`
- **Couverture actuelle**: 1 test
- **Tests a ajouter**:
  - [ ] `openfang start` (lifecycle daemon)
  - [ ] `openfang list` (listing agents)
  - [ ] PID file management
  - [ ] Graceful shutdown
- **Effort**: 2 jours

### 4.5 Tests securite (+20 tests)
- **Tests a ajouter**:
  - [ ] RBAC violations (5 tests)
  - [ ] SQL injection SQLite (3 tests)
  - [ ] Manifest fuzzing (3 tests)
  - [ ] Rate limiting spike (3 tests)
  - [ ] Credential vault edge cases (3 tests)
  - [ ] OAuth token refresh failures (3 tests)
- **Effort**: 2 jours

### 4.6 Setup benchmarks (criterion)
- **Probleme**: Zero benchmarks dans le projet
- **Correction**: Ajouter `benches/` avec criterion pour :
  - [ ] Model catalog loading
  - [ ] Tool execution latency
  - [ ] Taint check overhead
  - [ ] Message truncation speed
  - [ ] WASM module loading
- **Effort**: 1 jour

---

## Phase 5 — POLISH (Jours 30-35)

### 5.1 Clones excessifs dans boucles (80+ occurrences)
- **Fichiers**: `routes.rs`, `drivers/openai.rs`, `drivers/anthropic.rs`
- **Correction**: Utiliser references + `Cow<'static, str>` pour constantes
- **Effort**: 2 jours

### 5.2 Acces JSON sans validation (104 occurrences)
- **Fichiers**: `routes.rs`, `channels/*`
- **Probleme**: `req["name"].as_str().unwrap_or("unnamed")`
- **Correction**: Retourner `BAD_REQUEST` si champs obligatoires manquent
- **Effort**: 2 jours

### 5.3 Imports wildcard (10+ occurrences)
- **Fichiers**: `routes.rs`, `ws.rs`, `middleware.rs`
- **Correction**: Remplacer `use crate::types::*` par imports explicites
- **Effort**: 1 jour

### 5.4 Logs manquants dans code critique
- **Fichiers**: `drivers/` (25 logs pour 5000 lignes)
- **Correction**: Ajouter `warn!()` et `debug!()` sur chaque erreur reseau/parsing
- **Effort**: 1 jour

### 5.5 Retry sans circuit breaker
- **Fichier**: `crates/openfang-runtime/src/agent_loop.rs`
- **Correction**: Implementer circuit breaker simple (3 echecs → open → half-open apres 30s)
- **Effort**: 1 jour

### 5.6 MCP timeout hardcode
- **Fichier**: `crates/openfang-runtime/src/mcp.rs:512`
- **Probleme**: `Duration::from_secs(30)` ne correspond pas a la config
- **Correction**: Utiliser `self.config.timeout_secs`
- **Effort**: 15 minutes

### 5.7 Serialisation JSON redondante WebSocket
- **Fichier**: `crates/openfang-api/src/ws.rs:256-262`
- **Probleme**: Hash computation fait 1 serialisation complete par agent toutes les 5s
- **Correction**: Faire 1 serialisation, hasher une fois
- **Effort**: 1 heure

---

## Recapitulatif

| Phase | Duree | Items | Priorite |
|-------|-------|-------|----------|
| Phase 1 — Critique | Jours 1-5 | 5 items | IMMEDIATE |
| Phase 2 — Haute | Jours 6-15 | 10 items | Semaine 2-3 |
| Phase 3 — Refactoring | Jours 16-30 | 5 items | Mois 1 |
| Phase 4 — Tests | Jours 16-30 | 6 items | Mois 1 (parallele) |
| Phase 5 — Polish | Jours 30-35 | 7 items | Mois 1-2 |

**Total : 33 chantiers, ~35 jours de travail**

---

## Verification globale apres chaque phase

```bash
cargo build --workspace --lib
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

# OpenFang — Bug Tracker

> Dernière vérification : 2026-03-08

---

## Bugs critiques

### BUG-001 — Vault → Env Injection manquante
**Sévérité** : HIGH
**Statut** : 🔴 PRÉSENT
**Fichiers** : `crates/openfang-kernel/src/kernel.rs:552`, `crates/openfang-runtime/src/drivers/mod.rs`

Le kernel résout `api_key_env` uniquement via `std::env::var()`. Les clés chiffrées dans `vault.enc` ne sont jamais injectées dans les drivers LLM → les clés stockées dans le vault sont ignorées silencieusement.

**Solution — Étape 1 (rapide)** : Injecter le vault dans les env vars du process au boot dans `OpenFangKernel::boot()` :

```rust
let vault_path = openfang_home().join("vault.enc");
if vault_path.exists() {
    let mut vault = openfang_extensions::vault::CredentialVault::new(vault_path);
    if vault.unlock().is_ok() {
        for key in vault.list_keys() {
            if std::env::var(key).is_err() {
                if let Some(val) = vault.get(key) {
                    std::env::set_var(key, val.as_str());
                }
            }
        }
    }
}
```

**Solution — Étape 2 (propre)** : Modifier les drivers pour passer par `CredentialResolver` (`crates/openfang-extensions/src/credentials.rs`) au lieu de `std::env::var`.

**Fichiers à modifier** :

| Fichier | Rôle |
|---------|------|
| `crates/openfang-kernel/src/lib.rs` | `OpenFangKernel::boot()` — injecter vault avant le boot des agents |
| `crates/openfang-runtime/src/drivers/openai.rs` | Résolution `api_key_env` → fallback vault |
| `crates/openfang-runtime/src/drivers/anthropic.rs` | Idem |
| `crates/openfang-runtime/src/drivers/gemini.rs` | Idem |

---

### BUG-002 — Modèle par défaut cassé
**Sévérité** : HIGH
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-types/src/config.rs`

Le modèle par défaut est maintenant `claude-sonnet-4-20250514` avec provider `anthropic`. L'ancien `gpt-oss-120b` avec provider `groq` (qui nécessitait le préfixe `openai/`) n'est plus le défaut.

---

### BUG-003 — Vault master key jamais affichée à la création
**Sévérité** : MEDIUM
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-extensions/src/vault.rs`, `crates/openfang-cli/src/main.rs`

La fonction `init_and_get_display_key()` retourne maintenant la clé lors de la création. La CLI affiche la clé dans un encadré avec le message "VAULT MASTER KEY — Sauvegarde dans un endroit sûr !".

> Note : Vérifier que sur macOS (keyring toujours accessible) `Some(key)` est bien retourné même quand le keyring réussit.

---

## Sécurité

### BUG-004 — SQL Injection via LIMIT
**Sévérité** : CRITIQUE
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-memory/src/semantic.rs:156`

`LIMIT` est maintenant passé via un paramètre bindé (`?{param_idx}`) et non via `format!()`.

---

### BUG-005 — Timing attack sur la comparaison de clé API
**Sévérité** : MEDIUM
**Statut** : 🟡 PARTIEL
**Fichier** : `crates/openfang-api/src/middleware.rs:131`

La comparaison finale utilise `subtle::ConstantTimeEq` (correct), mais un early return sur la longueur (`if token.len() != api_key.len() { return false; }`) expose la longueur de la clé via timing side-channel.

**Correction attendue** : Remplacer l'early return longueur par une comparaison sur des buffers de taille fixe (HMAC-SHA256 des deux valeurs, puis `ct_eq`).

---

### BUG-006 — Endpoints sensibles sans authentification
**Sévérité** : HIGH
**Statut** : ✅ CORRIGÉ (par design)
**Fichier** : `crates/openfang-api/src/middleware.rs`

`/api/agents`, `/api/budget`, `/api/providers` sont intentionnellement publics pour permettre au dashboard SPA de se rendre avant l'authentification. Comportement documenté et voulu.

---

### BUG-007 — Prometheus exposé sans auth
**Sévérité** : MEDIUM
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-api/src/server.rs`

`/api/metrics` est protégé par authentification et n'est plus dans la liste des endpoints publics.

---

### BUG-008 — Upload sans TTL (accumulation disque)
**Sévérité** : MEDIUM
**Statut** : 🔴 PRÉSENT
**Fichier** : `crates/openfang-api/src/routes.rs:8547`

Les fichiers uploadés sont stockés dans `temp_dir()/openfang_uploads/`. Le `UPLOAD_REGISTRY` (`DashMap<String, UploadMeta>`) ne contient pas de timestamp ni de TTL. Les fichiers s'accumulent indéfiniment → vecteur de DoS par remplissage disque.

**Correction attendue** : Ajouter `uploaded_at: Instant` dans `UploadMeta`, lancer une tâche de nettoyage toutes les heures qui supprime les fichiers de plus de 24h.

---

## Performance & Robustesse

### BUG-009 — Instances `reqwest::Client::new()` multiples dans les drivers
**Sévérité** : MEDIUM
**Statut** : 🔴 PRÉSENT
**Fichiers** : `crates/openfang-runtime/src/drivers/openai.rs:28`, `anthropic.rs`, `gemini.rs`

Chaque instance de driver LLM crée un nouveau `reqwest::Client` sans configuration (`ClientBuilder`). En production, cela génère des dizaines de connection pools séparés, gaspillant mémoire et descripteurs de fichiers.

**Correction attendue** : Client partagé via `once_cell::Lazy<reqwest::Client>` ou injecté depuis le kernel.

---

### BUG-010 — Memory leak dans `running_tasks`
**Sévérité** : HIGH
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-kernel/src/kernel.rs:2728`

Les `AbortHandle` sont correctement supprimés du `DashMap` lors de l'arrêt des agents. Pas de fuite mémoire.

---

### BUG-011 — HTTP clients sans timeout dans les drivers LLM
**Sévérité** : MEDIUM
**Statut** : 🔴 PRÉSENT
**Fichiers** : `crates/openfang-runtime/src/drivers/openai.rs`, `anthropic.rs`, `gemini.rs`

`reqwest::Client::new()` sans `ClientBuilder::timeout()`. Un appel LLM suspendu (provider down) peut bloquer indéfiniment.

**Correction attendue** :
```rust
reqwest::ClientBuilder::new()
    .timeout(Duration::from_secs(120))
    .connect_timeout(Duration::from_secs(10))
    .build()?
```

---

### BUG-012 — Zombie streaming (agent continue si client déconnecté)
**Sévérité** : MEDIUM
**Statut** : ✅ CORRIGÉ
**Fichier** : `crates/openfang-runtime/src/agent_loop.rs`

Quand `stream_tx.send(...).is_err()`, un warning est logué et l'agent arrête d'envoyer des événements stream. L'exécution continue en arrière-plan (comportement attendu).

---

## Features IDEE.md

### BUG-013 — ClawHub 429 backoff manquant
**Sévérité** : LOW
**Statut** : 🔴 PRÉSENT (TODO documenté dans `IDEE.md:6`)

```
WARN openfang_api::routes: ClawHub install failed: Network error:
ClawHub download returned 429 Too Many Requests
```

Aucun retry avec backoff exponentiel dans le driver ClawHub. L'installation d'extensions échoue silencieusement sur rate limit.

**Correction attendue** : Retry avec backoff (1s → 2s → 4s, max 3 tentatives) + message d'erreur explicite dans l'UI.

---

### BUG-014 — Groq Whisper models
**Sévérité** : -
**Statut** : ✅ IMPLÉMENTÉ
**Fichiers** : `crates/openfang-runtime/src/media_understanding.rs`, `crates/openfang-runtime/src/model_catalog.rs`

`whisper-large-v3` et `whisper-large-v3-turbo` (alias : `whisper-turbo`) sont enregistrés dans le catalogue et fonctionnels avec fallback vers OpenAI Whisper.

---

## Résumé

| ID | Description | Sévérité | Statut |
|----|-------------|----------|--------|
| BUG-001 | Vault → Env injection manquante | HIGH | 🔴 À corriger |
| BUG-002 | Modèle par défaut cassé | HIGH | ✅ Corrigé |
| BUG-003 | Vault master key jamais affichée | MEDIUM | ✅ Corrigé |
| BUG-004 | SQL Injection via LIMIT | CRITIQUE | ✅ Corrigé |
| BUG-005 | Timing attack longueur clé API | MEDIUM | 🟡 Partiel |
| BUG-006 | Endpoints sans auth | HIGH | ✅ Corrigé |
| BUG-007 | Prometheus exposé sans auth | MEDIUM | ✅ Corrigé |
| BUG-008 | Upload sans TTL | MEDIUM | 🔴 À corriger |
| BUG-009 | reqwest::Client::new() multiples | MEDIUM | 🔴 À corriger |
| BUG-010 | Memory leak running_tasks | HIGH | ✅ Corrigé |
| BUG-011 | HTTP clients sans timeout | MEDIUM | 🔴 À corriger |
| BUG-012 | Zombie streaming | MEDIUM | ✅ Corrigé |
| BUG-013 | ClawHub 429 backoff | LOW | 🔴 À corriger |
| BUG-014 | Groq Whisper models | — | ✅ Implémenté |

**Priorité** : BUG-001 (vault injection) → BUG-005 (timing attack) → BUG-008 (upload TTL) → BUG-009 + BUG-011 (reqwest clients) → BUG-013 (ClawHub)

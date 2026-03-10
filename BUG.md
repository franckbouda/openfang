# Feature à implémenter : Kernel lit le vault pour les API keys

## Problème actuel

Le champ `api_key_env` dans `config.toml` contient un **nom de variable d'environnement** :
```toml
api_key_env = "GROQ_API_KEY"
```

Le kernel résout cette valeur uniquement via `std::env::var("GROQ_API_KEY")`. Après migration vers le vault, la clé est dans `~/.openfang/vault.enc` mais **pas dans les env vars système** → le kernel ne trouve pas la clé → fallback sur les defaults.

## Solution à implémenter

### Étape 1 (simple) — Injecter le vault dans le process env au boot

Dans `OpenFangKernel::boot()` (probablement dans `crates/openfang-kernel/src/lib.rs`), après le chargement du config, injecter les valeurs du vault comme env vars temporaires :

```rust
// Inject vault credentials into process env so api_key_env fields resolve correctly
let vault_path = openfang_home().join("vault.enc");
if vault_path.exists() {
    let mut vault = openfang_extensions::vault::CredentialVault::new(vault_path);
    if vault.unlock().is_ok() {
        for key in vault.list_keys() {
            if std::env::var(key).is_err() {
                // Only inject if not already set in env (don't override real env vars)
                if let Some(val) = vault.get(key) {
                    std::env::set_var(key, val.as_str());
                }
            }
        }
    }
}
```

### Étape 2 (propre) — Modifier les drivers LLM pour utiliser CredentialResolver

Modifier la résolution de `api_key_env` dans chaque driver pour passer par `CredentialResolver` au lieu de `std::env::var` directement. Plus sécurisé (valeurs restent dans le vault), mais plus de travail.

## Fichiers clés à modifier

| Fichier | Rôle |
|---------|------|
| `crates/openfang-kernel/src/lib.rs` | `OpenFangKernel::boot()` — injecter vault avant le boot des agents |
| `crates/openfang-runtime/src/drivers/openai.rs` | Résolution `api_key_env` → ajouter fallback vault |
| `crates/openfang-runtime/src/drivers/anthropic.rs` | Idem |
| `crates/openfang-runtime/src/drivers/gemini.rs` | Idem |
| `crates/openfang-extensions/src/credentials.rs` | `CredentialResolver` — déjà capable de lire le vault |

## Dépendance à ajouter

`openfang-kernel` devra dépendre de `openfang-extensions` dans son `Cargo.toml` :
```toml
openfang-extensions = { path = "../openfang-extensions" }
```
Vérifier qu'il n'y a pas de dépendance circulaire (kernel ← runtime ← extensions est OK car extensions ne dépend pas de kernel).

## Approche recommandée

Commencer par l'Étape 1 pour un fix rapide, puis refactorer vers l'Étape 2 si la sécurité est une priorité.

---

# Bug : Modèle par défaut introuvable + absence de notification d'erreur à l'utilisateur

## Symptôme

Après installation, envoyer un message à l'agent par défaut produit silencieusement :
```
WARN agent_loop: LLM stream error: The requested model was not found. model=gpt-oss-120b
WARN kernel: Streaming agent loop failed error=LLM driver error: The requested model was not found.
WARN api::ws: Agent message failed: LLM driver error: The requested model was not found.
```
L'utilisateur ne voit aucune notification dans l'UI — le message disparaît sans réponse ni alerte.

## Cause #1 — Mauvais nom de modèle par défaut

Le config.toml d'exemple utilise `model = "gpt-oss-120b"` avec `provider = "groq"`. Groq exige le préfixe `openai/` pour ces modèles :

```
gpt-oss-120b       ← invalide pour Groq
openai/gpt-oss-120b ← correct
```

**Fix** : Corriger le modèle par défaut dans le template `config.toml` (généré par `openfang init` ou l'init wizard) et dans le `KernelConfig::default()` :

- Fichier : `crates/openfang-types/src/config.rs` → `impl Default for ModelConfig`
- Fichier : `crates/openfang-cli/src/tui/screens/init_wizard.rs` → modèle Groq proposé par défaut
- Le modèle correct à utiliser : `"llama-3.3-70b-versatile"` (stable, gratuit, bien supporté)

## Cause #2 — Absence de notification utilisateur en cas d'erreur LLM

Quand l'agent loop échoue (`Streaming agent loop failed`), le WebSocket reçoit un `AgentMessageFailed` mais **aucun message d'erreur n'est envoyé dans le chat** côté UI. L'utilisateur voit juste le message partir sans réponse.

**Fix** : Dans `crates/openfang-api/src/routes.rs` (handler WebSocket/SSE), quand `agent_loop` retourne une erreur, envoyer un message d'erreur explicite au client :

```rust
Err(e) => {
    // Envoyer l'erreur comme message de l'assistant dans le chat
    let error_msg = format!("⚠️ Erreur : {}", e);
    // ws_send(AgentMessage { role: "error", content: error_msg })
    warn!("Agent message failed: {e}");
}
```

Ou alternativement, émettre un événement SSE/WS de type `error` que le frontend Alpine.js affiche comme toast ou message dans le chat.

## Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `crates/openfang-types/src/config.rs` | `ModelConfig::default()` → `model = "llama-3.3-70b-versatile"` |
| `crates/openfang-cli/src/tui/screens/init_wizard.rs` | Modèle Groq par défaut proposé |
| `crates/openfang-api/src/routes.rs` | Handler WS/SSE → envoyer message d'erreur au client si agent loop échoue |
| `crates/openfang-api/static/js/` | Frontend → afficher les messages d'erreur reçus |

---

# Bug : La clé maître du vault ne s'affiche pas à la création

## Problème

La méthode `init_and_get_display_key()` dans `crates/openfang-extensions/src/vault.rs` retourne `Some(key)` **uniquement si** la clé a été nouvellement générée ET que le keyring OS n'était pas disponible. Sur macOS, le keyring (fichier `~/.local/share/openfang/.keyring`) réussit toujours → la méthode retourne `None` → le banner avec la clé ne s'affiche jamais dans le CLI ni dans le desktop.

L'utilisateur n'a donc aucun moyen de sauvegarder la clé maître pour restaurer le vault sur une autre machine.

## Comportement actuel

```
init_and_get_display_key()
  ├─ env var OPENFANG_VAULT_KEY présente → None (clé existante)
  ├─ keyring OS accessible           → None (clé existante)  ← toujours le cas sur macOS
  └─ keyring inaccessible            → Some(key) ← n'arrive jamais en pratique
```

## Solution à implémenter

Toujours retourner `Some(key)` quand le vault est **nouvellement créé**, peu importe si le keyring a réussi ou non. L'utilisateur doit pouvoir sauvegarder la clé même si elle est déjà dans le keyring (le keyring peut être perdu, corrompu, ou la machine peut changer).

Dans `vault.rs`, modifier `init_and_get_display_key()` :

```rust
// Toujours retourner la clé display si c'est une nouvelle initialisation
// (que la clé vienne du keyring ou soit nouvellement générée)
let display_key = Some(Zeroizing::new(base64::Engine::encode(
    &base64::engine::general_purpose::STANDARD,
    key_bytes.as_ref(),
)));
```

Supprimer le flag `newly_generated` et toujours retourner `Some(key)`.

## Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `crates/openfang-extensions/src/vault.rs` | `init_and_get_display_key()` → toujours retourner `Some(key)` |

## Impact

- CLI (`openfang start`) : le banner avec la clé s'affichera systématiquement à la première création du vault
- Desktop (`cargo tauri dev`) : le dialog Tauri s'affichera systématiquement à la première création du vault
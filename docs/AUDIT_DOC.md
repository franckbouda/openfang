# Audit Documentation OpenFang

Date: 2026-03-07
Branche: fix/phase1-audit-corrections

---

## 1. Ecarts API (docs/api-reference.md vs code)

### Routes presentes dans le code (server.rs) mais ABSENTES de la documentation

#### Agent Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/agents/{id}` | PATCH | `patch_agent` |
| `/api/agents/{id}/tools` | GET/PUT | `get_agent_tools` / `set_agent_tools` |
| `/api/agents/{id}/skills` | GET/PUT | `get_agent_skills` / `set_agent_skills` |
| `/api/agents/{id}/mcp_servers` | GET/PUT | `get_agent_mcp_servers` / `set_agent_mcp_servers` |
| `/api/agents/{id}/identity` | PATCH | `update_agent_identity` |
| `/api/agents/{id}/config` | PATCH | `patch_agent_config` |
| `/api/agents/{id}/clone` | POST | `clone_agent` |
| `/api/agents/{id}/files` | GET | `list_agent_files` |
| `/api/agents/{id}/files/{filename}` | GET/PUT | `get_agent_file` / `set_agent_file` |
| `/api/agents/{id}/deliveries` | GET | `get_agent_deliveries` |
| `/api/agents/{id}/upload` | POST | `upload_file` |
| `/api/agents/{id}/history` | DELETE | `clear_agent_history` |

#### Session Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/agents/{id}/sessions` | GET/POST | `list_agent_sessions` / `create_agent_session` |
| `/api/agents/{id}/sessions/{session_id}/switch` | POST | `switch_agent_session` |
| `/api/agents/{id}/sessions/by-label/{label}` | GET | `find_session_by_label` |
| `/api/sessions/{id}/label` | PUT | `set_session_label` |

#### Channel Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/channels/{name}/configure` | POST/DELETE | `configure_channel` / `remove_channel` |
| `/api/channels/{name}/test` | POST | `test_channel` |
| `/api/channels/reload` | POST | `reload_channels` |
| `/api/channels/whatsapp/qr/start` | POST | `whatsapp_qr_start` |
| `/api/channels/whatsapp/qr/status` | GET | `whatsapp_qr_status` |

#### Schedule / Cron
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/schedules` | GET/POST | `list_schedules` / `create_schedule` |
| `/api/schedules/{id}` | PUT/DELETE | `update_schedule` / `delete_schedule` |
| `/api/schedules/{id}/run` | POST | `run_schedule` |
| `/api/cron/jobs` | GET/POST | `list_cron_jobs` / `create_cron_job` |
| `/api/cron/jobs/{id}` | DELETE | `delete_cron_job` |
| `/api/cron/jobs/{id}/enable` | PUT | `toggle_cron_job` |
| `/api/cron/jobs/{id}/status` | GET | `cron_job_status` |

#### Hands (Autonomous Hands)
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/hands` | GET | `list_hands` |
| `/api/hands/install` | POST | `install_hand` |
| `/api/hands/active` | GET | `list_active_hands` |
| `/api/hands/{hand_id}` | GET | `get_hand` |
| `/api/hands/{hand_id}/activate` | POST | `activate_hand` |
| `/api/hands/{hand_id}/check-deps` | POST | `check_hand_deps` |
| `/api/hands/{hand_id}/install-deps` | POST | `install_hand_deps` |
| `/api/hands/{hand_id}/settings` | GET/PUT | `get_hand_settings` / `update_hand_settings` |
| `/api/hands/instances/{id}/pause` | POST | `pause_hand` |
| `/api/hands/instances/{id}/resume` | POST | `resume_hand` |
| `/api/hands/instances/{id}` | DELETE | `deactivate_hand` |
| `/api/hands/instances/{id}/stats` | GET | `hand_stats` |
| `/api/hands/instances/{id}/browser` | GET | `hand_instance_browser` |

#### Config Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/config/set` | POST | `config_set` |
| `/api/config/schema` | GET | `config_schema` |
| `/api/config/reload` | POST | `config_reload` |

#### Approval System
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/approvals` | GET/POST | `list_approvals` / `create_approval` |
| `/api/approvals/{id}/approve` | POST | `approve_request` |
| `/api/approvals/{id}/reject` | POST | `reject_request` |

#### Budget
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/budget` | GET/PUT | `budget_status` / `update_budget` |
| `/api/budget/agents` | GET | `agent_budget_ranking` |
| `/api/budget/agents/{id}` | GET/PUT | `agent_budget_status` / `update_agent_budget` |

#### Network / Comms
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/network/status` | GET | `network_status` |
| `/api/comms/topology` | GET | `comms_topology` |
| `/api/comms/events` | GET | `comms_events` |
| `/api/comms/events/stream` | GET (SSE) | `comms_events_stream` |
| `/api/comms/send` | POST | `comms_send` |
| `/api/comms/task` | POST | `comms_task` |

#### A2A Management (Outbound)
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/a2a/agents` | GET | `a2a_list_external_agents` |
| `/api/a2a/discover` | POST | `a2a_discover_external` |
| `/api/a2a/send` | POST | `a2a_send_external` |
| `/api/a2a/tasks/{id}/status` | GET | `a2a_external_task_status` |

#### Integrations
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/integrations` | GET | `list_integrations` |
| `/api/integrations/available` | GET | `list_available_integrations` |
| `/api/integrations/add` | POST | `add_integration` |
| `/api/integrations/{id}` | DELETE | `remove_integration` |
| `/api/integrations/{id}/reconnect` | POST | `reconnect_integration` |
| `/api/integrations/health` | GET | `integrations_health` |
| `/api/integrations/reload` | POST | `reload_integrations` |

#### Device Pairing
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/pairing/request` | POST | `pairing_request` |
| `/api/pairing/complete` | POST | `pairing_complete` |
| `/api/pairing/devices` | GET | `pairing_devices` |
| `/api/pairing/devices/{id}` | DELETE | `pairing_remove_device` |
| `/api/pairing/notify` | POST | `pairing_notify` |

#### Bindings
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/bindings` | GET/POST | `list_bindings` / `add_binding` |
| `/api/bindings/{index}` | DELETE | `remove_binding` |

#### Model Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/models/custom` | POST | `add_custom_model` |
| `/api/models/custom/{id}` | DELETE | `remove_custom_model` |

#### Provider Management
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/providers/{name}/url` | PUT | `set_provider_url` |
| `/api/providers/github-copilot/oauth/start` | POST | `copilot_oauth_start` |
| `/api/providers/github-copilot/oauth/poll/{poll_id}` | GET | `copilot_oauth_poll` |

#### Streaming / Monitoring
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/metrics` | GET | `prometheus_metrics` |
| `/api/logs/stream` | GET (SSE) | `logs_stream` |
| `/api/commands` | GET | `list_commands` |

#### Uploads
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/uploads/{file_id}` | GET | `serve_upload` |

#### Webhooks
| Route | Methode | Handler |
|-------|---------|---------|
| `/hooks/wake` | POST | `webhook_wake` |
| `/hooks/agent` | POST | `webhook_agent` |

#### ClawHub (manquant partiel)
| Route | Methode | Handler |
|-------|---------|---------|
| `/api/clawhub/skill/{slug}/code` | GET | `clawhub_skill_code` |

### Routes documentees mais dont la methode HTTP differe dans le code

| Route doc | Methode doc | Methode code | Notes |
|-----------|-------------|--------------|-------|
| `/api/agents/{id}/update` | PUT (doc) | PUT (code) | OK - coherent |

### Comptage

- **Routes dans le code** : ~160+ (methodes individuelles)
- **Routes documentees** : ~75
- **Taux de couverture doc** : environ 47%

---

## 2. Ecarts Configuration (docs/configuration.md vs code config.rs)

### Sections de config presentes dans KernelConfig MAIS absentes de la documentation

| Champ KernelConfig | Type | Description |
|---------------------|------|-------------|
| `browser` | `BrowserConfig` | Configuration du navigateur automatise (headless, viewport, timeout, sessions max, chemin Chromium) |
| `extensions` | `ExtensionsConfig` | Integrations MCP (auto-reconnect, tentatives max, backoff, health check) |
| `vault` | `VaultConfig` | Coffre-fort de credentials AES-256-GCM (active, chemin personnalise) |
| `workspaces_dir` | `Option<PathBuf>` | Repertoire racine des workspaces agents |
| `media` | `MediaConfig` | Configuration de comprehension media (images, audio) |
| `links` | `LinkConfig` | Configuration de comprehension de liens |
| `reload` | `ReloadConfig` | Hot-reload du fichier config (mode: off/restart/hot/hybrid, debounce) |
| `webhook_triggers` | `Option<WebhookTriggerConfig>` | Endpoints webhook /hooks/* (active, token, limites) |
| `approval` | `ApprovalPolicy` | Politique d'approbation d'execution |
| `max_cron_jobs` | `usize` | Nombre max de jobs cron globaux (defaut: 500) |
| `include` | `Vec<String>` | Fichiers de config inclus et fusionnes |
| `exec_policy` | `ExecPolicy` | Politique de securite shell/exec (mode deny/allowlist/full, commandes autorisees, timeouts) |
| `bindings` | `Vec<AgentBinding>` | Routage multi-compte vers agents specifiques |
| `broadcast` | `BroadcastConfig` | Envoi de messages a plusieurs agents (strategie parallel/sequential) |
| `auto_reply` | `AutoReplyConfig` | Moteur de reponse automatique en arriere-plan |
| `canvas` | `CanvasConfig` | Canvas Agent-to-UI (HTML interactif) |
| `tts` | `TtsConfig` | Text-to-Speech (OpenAI, ElevenLabs) |
| `docker` | `DockerSandboxConfig` | Sandbox Docker pour execution isolee |
| `pairing` | `PairingConfig` | Appairage d'appareils (mobile, desktop) |
| `auth_profiles` | `HashMap<String, Vec<AuthProfile>>` | Rotation de cles API par provider |
| `thinking` | `Option<ThinkingConfig>` | Extended thinking (budget tokens, streaming) |
| `budget` | `BudgetConfig` | Budget de depenses global (limites horaire/journaliere/mensuelle) |
| `provider_urls` | `HashMap<String, String>` | URLs de base personnalisees par provider |
| `oauth` | `OAuthConfig` | Client IDs OAuth PKCE (Google, GitHub, Microsoft, Slack) |

### Comptage configuration

- **Champs dans KernelConfig** : ~35+
- **Champs documentes** : ~12 sections
- **Sections non documentees** : 23 sections/champs majeurs
- **Taux de couverture doc** : environ 34%

---

## 3. Sections manquantes dans la documentation

### Fichiers de doc qui devraient exister ou etre etoffes

1. **docs/hands-reference.md** - Les 7 Hands autonomes (Browser, Code, Data, DevOps, Research, System, Creative) ne sont pas documentees cote API
2. **docs/budget-guide.md** - Le systeme de budget et metering n'a pas de guide dedie
3. **docs/security-guide.md** - Les 16 systemes de securite (exec_policy, approval, audit, taint tracking, etc.) meritent un guide complet
4. **docs/integrations-guide.md** - Les endpoints d'integrations MCP/A2A manquent de documentation
5. **docs/webhooks-guide.md** - Les webhooks /hooks/* et leur configuration ne sont pas documentes
6. **docs/pairing-guide.md** - L'appairage d'appareils n'est pas documente
7. **docs/docker-sandbox.md** - La sandbox Docker merite sa propre page
8. **docs/tts-guide.md** - Le Text-to-Speech n'est pas documente
9. **docs/comms-guide.md** - La communication inter-agents (topologie, events, taches) n'est pas documentee
10. **docs/cron-schedules.md** - Les jobs cron et schedules ne sont pas documentes

### Sections manquantes dans les fichiers existants

- **api-reference.md** : Il manque ~85 routes (voir section 1 ci-dessus)
- **configuration.md** : Il manque ~23 sections de configuration (voir section 2 ci-dessus)
- Pas de documentation sur le WebSocket `/api/agents/{id}/ws` (protocole, messages)
- Pas de documentation sur le SSE `/api/logs/stream` et `/api/comms/events/stream`
- Pas de documentation sur les endpoints Prometheus `/api/metrics`

---

## 4. Recommandations

### Priorite haute (impact utilisateur direct)
1. **Documenter les routes Budget** (`/api/budget/*`) - Le systeme de budget est critique pour les utilisateurs en production
2. **Documenter exec_policy** dans configuration.md - La securite d'execution est essentielle
3. **Documenter les routes Hands** - Fonctionnalite majeure sans aucune doc API
4. **Documenter les routes Schedule/Cron** - Automatisation utilisee quotidiennement
5. **Ajouter les sections config manquantes** : `browser`, `docker`, `tts`, `budget`, `exec_policy`, `thinking`

### Priorite moyenne (fonctionnalites avancees)
6. Documenter les routes d'integrations MCP
7. Documenter les routes A2A management (outbound)
8. Documenter le systeme d'approbation (approval)
9. Documenter la configuration de hot-reload
10. Documenter les webhooks triggers

### Priorite basse (cas d'utilisation specifiques)
11. Documenter le device pairing
12. Documenter les endpoints Prometheus/metriques
13. Documenter le canvas (A2UI)
14. Documenter les agent bindings
15. Documenter la configuration broadcast/auto-reply
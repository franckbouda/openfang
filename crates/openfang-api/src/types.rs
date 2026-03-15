//! Request/response types for the OpenFang API.

use serde::{Deserialize, Serialize};

/// Request to spawn an agent from a TOML manifest string or a template name.
#[derive(Debug, Deserialize)]
pub struct SpawnRequest {
    /// Agent manifest as TOML string (optional if `template` is provided).
    #[serde(default)]
    pub manifest_toml: String,
    /// Template name from `~/.openfang/agents/{template}/agent.toml`.
    /// When provided and `manifest_toml` is empty, the template is loaded automatically.
    #[serde(default)]
    pub template: Option<String>,
    /// Optional Ed25519 signed manifest envelope (JSON).
    /// When present, the signature is verified before spawning.
    #[serde(default)]
    pub signed_manifest: Option<String>,
}

/// Response after spawning an agent.
#[derive(Debug, Serialize)]
pub struct SpawnResponse {
    pub agent_id: String,
    pub name: String,
}

/// A file attachment reference (from a prior upload).
#[derive(Debug, Clone, Deserialize)]
pub struct AttachmentRef {
    pub file_id: String,
    #[serde(default)]
    pub filename: String,
    #[serde(default)]
    pub content_type: String,
}

/// Request to send a message to an agent.
#[derive(Debug, Deserialize)]
pub struct MessageRequest {
    pub message: String,
    /// Optional file attachments (uploaded via /upload endpoint).
    #[serde(default)]
    pub attachments: Vec<AttachmentRef>,
    /// Sender identity (e.g. WhatsApp phone number, Telegram user ID).
    #[serde(default)]
    pub sender_id: Option<String>,
    /// Sender display name.
    #[serde(default)]
    pub sender_name: Option<String>,
}

/// Response from sending a message.
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub response: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub iterations: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

/// Request to install a skill from the marketplace.
#[derive(Debug, Deserialize)]
pub struct SkillInstallRequest {
    pub name: String,
}

/// Request to uninstall a skill.
#[derive(Debug, Deserialize)]
pub struct SkillUninstallRequest {
    pub name: String,
}

/// Request to update an agent's manifest.
#[derive(Debug, Deserialize)]
pub struct AgentUpdateRequest {
    pub manifest_toml: String,
}

/// Request to change an agent's operational mode.
#[derive(Debug, Deserialize)]
pub struct SetModeRequest {
    pub mode: openfang_types::agent::AgentMode,
}

/// Request to run a migration.
#[derive(Debug, Deserialize)]
pub struct MigrateRequest {
    pub source: String,
    pub source_dir: String,
    pub target_dir: String,
    #[serde(default)]
    pub dry_run: bool,
}

/// Request to scan a directory for migration.
#[derive(Debug, Deserialize)]
pub struct MigrateScanRequest {
    pub path: String,
}

/// Request to install a skill from ClawHub.
#[derive(Debug, Deserialize)]
pub struct ClawHubInstallRequest {
    /// ClawHub skill slug (e.g., "github-helper").
    pub slug: String,
}

/// Unified error response for all API error cases.
///
/// Use this struct to return structured, machine-readable errors to API clients.
/// Fields:
/// - `error`: Human-readable error message.
/// - `error_code`: Optional short code for the error category (e.g. "rate_limit", "billing").
/// - `retryable`: Whether the client can retry the request (e.g. after a delay).
/// - `details`: Optional additional context (arbitrary JSON).
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ErrorResponse {
    /// Create a simple non-retryable error with no code.
    pub fn simple(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            error_code: None,
            retryable: false,
            details: None,
        }
    }

    /// Create an error with a short error code.
    pub fn with_code(msg: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            error_code: Some(code.into()),
            retryable: false,
            details: None,
        }
    }

    /// Create a retryable error (e.g. rate limit).
    pub fn retryable(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            error_code: None,
            retryable: true,
            details: None,
        }
    }
}

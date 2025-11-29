use anyhow::{anyhow, Result};
use serde::Deserialize;
use serde_json::Value;
use tlsn_core::{
    presentation::{Presentation, PresentationOutput},
    CryptoProvider,
};

/// Verification result for all quest types
#[derive(Default)]
pub struct VerificationResult {
    pub twitter_handle: Option<String>,
    pub tweet_id: Option<String>,
    pub author_screen_name: Option<String>,
    pub tweet_text: Option<String>,
    pub like_verified: Option<bool>,
    pub retweet_verified: Option<bool>,
}

/// Expected data for verification
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedData {
    pub tweet_url: Option<String>,
    pub expected_author: Option<String>,
}

/// TLSNotary v0.1.0-alpha.12 proof format from browser extension
#[derive(Deserialize, Debug)]
struct ProofData {
    version: String,
    data: String, // hex-encoded bincode-serialized Presentation
    meta: ProofMeta,
}

#[derive(Deserialize, Debug)]
struct ProofMeta {
    #[serde(rename = "notaryUrl")]
    notary_url: String,
    #[serde(rename = "websocketProxyUrl")]
    websocket_proxy_url: Option<String>,
}

// Common proof verification logic
async fn verify_proof_common(proof_json: &Value) -> Result<(String, String)> {
    // Parse the proof structure
    let proof: ProofData = serde_json::from_value(proof_json.clone())
        .map_err(|e| anyhow!("Invalid proof format: {}", e))?;

    tracing::info!(
        "Received proof version: {}, notary: {}",
        proof.version,
        proof.meta.notary_url
    );

    // Verify version compatibility
    if !proof.version.starts_with("0.1.0-alpha") {
        return Err(anyhow!("Unsupported proof version: {}", proof.version));
    }

    // Verify notary URL is from trusted sources (PSE or local)
    let trusted_notaries = [
        "https://notary.pse.dev",
        "http://localhost:7047",
        "http://127.0.0.1:7047",
    ];

    if !trusted_notaries.iter().any(|n| proof.meta.notary_url.starts_with(n)) {
        return Err(anyhow!("Untrusted notary: {}", proof.meta.notary_url));
    }

    // Verify data is present
    if proof.data.is_empty() {
        return Err(anyhow!("Missing proof data"));
    }

    // Decode hex data to bytes
    let data_bytes = hex::decode(&proof.data)
        .map_err(|e| anyhow!("Invalid hex data: {}", e))?;

    tracing::info!("Proof data size: {} bytes", data_bytes.len());

    // Deserialize the bincode-encoded Presentation
    let presentation: Presentation = bincode::deserialize(&data_bytes)
        .map_err(|e| anyhow!("Failed to deserialize presentation: {}", e))?;

    tracing::info!("Successfully deserialized presentation");

    // Get the verifying key from the presentation
    let verifying_key = presentation.verifying_key();
    tracing::info!("Presentation signed by notary key: {:?}", verifying_key);

    // Create crypto provider for verification
    let crypto_provider = CryptoProvider::default();

    // Cryptographically verify the presentation
    let PresentationOutput {
        server_name,
        connection_info,
        transcript,
        ..
    } = presentation.verify(&crypto_provider)
        .map_err(|e| anyhow!("Presentation verification failed: {}", e))?;

    tracing::info!("Cryptographic verification successful!");
    tracing::info!("Server name: {:?}", server_name);
    tracing::info!("Connection time: {:?}", connection_info.time);

    // Verify the server is Twitter/X API
    let server = server_name.ok_or_else(|| anyhow!("No server identity in proof"))?;
    let server_str = server.as_str();

    if !server_str.contains("api.x.com") && !server_str.contains("api.twitter.com") && !server_str.contains("x.com") {
        return Err(anyhow!("Proof not from Twitter API: {}", server_str));
    }

    tracing::info!("Verified server identity: {}", server_str);

    // Extract transcript data
    let partial_transcript = transcript.ok_or_else(|| anyhow!("No transcript data in proof"))?;
    let recv_data = partial_transcript.received_unsafe();
    let recv_str = String::from_utf8_lossy(recv_data).to_string();

    tracing::debug!("Received data length: {} bytes", recv_data.len());

    Ok((server_str.to_string(), recv_str))
}

/// Verify a Twitter profile proof (Quest 1)
pub async fn verify_profile_proof(proof_json: &Value) -> Result<VerificationResult> {
    let (_server, recv_str) = verify_proof_common(proof_json).await?;

    // Extract Twitter handle
    let twitter_handle = extract_twitter_handle(&recv_str)?;

    tracing::info!("Successfully verified Twitter handle: {}", twitter_handle);

    Ok(VerificationResult {
        twitter_handle: Some(twitter_handle),
        ..Default::default()
    })
}

/// Verify a tweet authorship proof (Quest 2)
pub async fn verify_authorship_proof(
    proof_json: &Value,
    expected: Option<&ExpectedData>,
) -> Result<VerificationResult> {
    let (_server, recv_str) = verify_proof_common(proof_json).await?;

    // Extract tweet data from the response
    // Twitter API /1.1/statuses/show.json returns:
    // {"id_str": "...", "full_text": "...", "user": {"screen_name": "..."}}

    let tweet_id = extract_json_field(&recv_str, "id_str")
        .or_else(|_| extract_json_field(&recv_str, "rest_id"))?;

    let author_handle = extract_nested_field(&recv_str, "user", "screen_name")
        .or_else(|_| extract_twitter_handle(&recv_str))?;

    let tweet_text = extract_json_field(&recv_str, "full_text")
        .or_else(|_| extract_json_field(&recv_str, "text"))
        .ok();

    tracing::info!(
        "Verified tweet {} by @{}",
        tweet_id,
        author_handle
    );

    Ok(VerificationResult {
        tweet_id: Some(tweet_id),
        author_screen_name: Some(author_handle),
        tweet_text,
        ..Default::default()
    })
}

/// Verify engagement proof - like and retweet (Quest 3)
pub async fn verify_engagement_proof(
    proof_json: &Value,
    expected: Option<&ExpectedData>,
) -> Result<VerificationResult> {
    let (_server, recv_str) = verify_proof_common(proof_json).await?;

    // GraphQL TweetDetail response contains:
    // "favorited": true/false
    // "retweeted": true/false
    // "rest_id": "..."

    let tweet_id = extract_json_field(&recv_str, "rest_id")
        .or_else(|_| extract_json_field(&recv_str, "id_str"))?;

    // Check for favorited (liked) status
    let like_verified = recv_str.contains("\"favorited\":true") ||
                        recv_str.contains("\"favorited\": true");

    // Check for retweeted status
    let retweet_verified = recv_str.contains("\"retweeted\":true") ||
                           recv_str.contains("\"retweeted\": true");

    tracing::info!(
        "Engagement verification for tweet {}: like={}, retweet={}",
        tweet_id,
        like_verified,
        retweet_verified
    );

    if !like_verified && !retweet_verified {
        return Err(anyhow!("No engagement (like or retweet) detected in proof"));
    }

    Ok(VerificationResult {
        tweet_id: Some(tweet_id),
        like_verified: Some(like_verified),
        retweet_verified: Some(retweet_verified),
        ..Default::default()
    })
}

// Legacy function for backwards compatibility
pub async fn verify_twitter_proof(proof_json: &Value) -> Result<String> {
    let result = verify_profile_proof(proof_json).await?;
    result.twitter_handle.ok_or_else(|| anyhow!("No Twitter handle extracted"))
}

fn extract_twitter_handle(data: &str) -> Result<String> {
    // Try to find screen_name in the transcript data
    // Format: "screen_name":"username"
    if let Some(start) = data.find("\"screen_name\":\"") {
        let after_key = &data[start + 15..];
        if let Some(end) = after_key.find('"') {
            let handle = &after_key[..end];
            if !handle.is_empty() && handle.len() <= 15 && is_valid_handle(handle) {
                return Ok(handle.to_string());
            }
        }
    }

    // Alternative format: screen_name: "username" (with space)
    if let Some(start) = data.find("\"screen_name\": \"") {
        let after_key = &data[start + 16..];
        if let Some(end) = after_key.find('"') {
            let handle = &after_key[..end];
            if !handle.is_empty() && handle.len() <= 15 && is_valid_handle(handle) {
                return Ok(handle.to_string());
            }
        }
    }

    Err(anyhow!(
        "Could not extract Twitter handle from verified transcript"
    ))
}

fn extract_json_field(data: &str, field: &str) -> Result<String> {
    // Format: "field":"value" or "field": "value"
    let patterns = [
        format!("\"{}\":\"", field),
        format!("\"{}\": \"", field),
    ];

    for pattern in &patterns {
        if let Some(start) = data.find(pattern) {
            let after_key = &data[start + pattern.len()..];
            if let Some(end) = after_key.find('"') {
                let value = &after_key[..end];
                if !value.is_empty() {
                    return Ok(value.to_string());
                }
            }
        }
    }

    Err(anyhow!("Could not find field '{}' in data", field))
}

fn extract_nested_field(data: &str, parent: &str, field: &str) -> Result<String> {
    // Find the parent object first, then the field within it
    let parent_pattern = format!("\"{}\":", parent);
    if let Some(parent_start) = data.find(&parent_pattern) {
        let parent_data = &data[parent_start..];
        // Find the opening brace
        if let Some(brace_start) = parent_data.find('{') {
            let nested_data = &parent_data[brace_start..];
            // Find the closing brace (simple approach - may not handle deeply nested)
            if let Some(brace_end) = nested_data.find('}') {
                let obj_str = &nested_data[..brace_end + 1];
                return extract_json_field(obj_str, field);
            }
        }
    }
    Err(anyhow!("Could not find nested field '{}.{}'", parent, field))
}

fn is_valid_handle(handle: &str) -> bool {
    // Twitter handles can only contain alphanumeric characters and underscores
    handle.chars().all(|c| c.is_alphanumeric() || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_verify_rejects_untrusted_notary() {
        let proof = serde_json::json!({
            "version": "0.1.0-alpha.12",
            "data": "48656c6c6f", // "Hello" in hex
            "meta": {
                "notaryUrl": "https://evil-notary.com",
                "websocketProxyUrl": "ws://localhost:55688"
            }
        });

        let result = verify_profile_proof(&proof).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Untrusted notary"));
    }

    #[test]
    fn test_extract_twitter_handle() {
        let data = "some data \"screen_name\":\"avnerLukk\" more data";
        let result = extract_twitter_handle(data);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "avnerLukk");
    }

    #[test]
    fn test_extract_json_field() {
        let data = "{\"id_str\":\"1234567890\",\"text\":\"Hello world\"}";
        assert_eq!(extract_json_field(data, "id_str").unwrap(), "1234567890");
        assert_eq!(extract_json_field(data, "text").unwrap(), "Hello world");
    }

    #[test]
    fn test_is_valid_handle() {
        assert!(is_valid_handle("avnerLukk"));
        assert!(is_valid_handle("test_user"));
        assert!(is_valid_handle("User123"));
        assert!(!is_valid_handle("user name")); // space not allowed
        assert!(!is_valid_handle("user@name")); // @ not allowed
    }
}

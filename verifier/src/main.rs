use axum::{extract::Json, http::StatusCode, response::IntoResponse, routing::{get, post}, Router};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};

mod verify;

use verify::ExpectedData;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyRequest {
    proof: serde_json::Value,
    #[serde(default)]
    quest_type: Option<String>, // "profile", "authorship", "engagement"
    #[serde(default)]
    expected_data: Option<ExpectedData>,
}

#[derive(Serialize)]
struct VerifyResponse {
    valid: bool,
    twitter_handle: Option<String>,
    tweet_id: Option<String>,
    author_screen_name: Option<String>,
    tweet_text: Option<String>,
    like_verified: Option<bool>,
    retweet_verified: Option<bool>,
    error: Option<String>,
}

async fn verify_proof(Json(req): Json<VerifyRequest>) -> impl IntoResponse {
    let quest_type = req.quest_type.as_deref().unwrap_or("profile");

    let result = match quest_type {
        "profile" => verify::verify_profile_proof(&req.proof).await,
        "authorship" => verify::verify_authorship_proof(&req.proof, req.expected_data.as_ref()).await,
        "engagement" => verify::verify_engagement_proof(&req.proof, req.expected_data.as_ref()).await,
        _ => Err(anyhow::anyhow!("Unknown quest type: {}", quest_type)),
    };

    match result {
        Ok(result) => (
            StatusCode::OK,
            Json(VerifyResponse {
                valid: true,
                twitter_handle: result.twitter_handle,
                tweet_id: result.tweet_id,
                author_screen_name: result.author_screen_name,
                tweet_text: result.tweet_text,
                like_verified: result.like_verified,
                retweet_verified: result.retweet_verified,
                error: None,
            }),
        ),
        Err(e) => (
            StatusCode::OK,
            Json(VerifyResponse {
                valid: false,
                twitter_handle: None,
                tweet_id: None,
                author_screen_name: None,
                tweet_text: None,
                like_verified: None,
                retweet_verified: None,
                error: Some(e.to_string()),
            }),
        ),
    }
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        )
        .init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/verify", post(verify_proof))
        .route("/health", get(health_check))
        .layer(cors);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Verifier service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

# LupoVerify - ZK Twitter Quest System

Zero-knowledge Twitter verification POC with a 3-quest system. Prove your Twitter identity and actions using cryptographic proofs powered by TLSNotary.

## Features

- **Quest 1**: Verify Twitter profile ownership
- **Quest 2**: Prove you authored a specific tweet
- **Quest 3**: Prove you liked AND retweeted a specific tweet
- **Wallet Integration**: All verifications linked to your Ethereum address
- **SQLite Storage**: Lightweight database for quest completion tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                              │
│  ┌─────────────────────┐     ┌─────────────────────────────────────────┐ │
│  │   React Frontend    │     │      LupoVerify Extension               │ │
│  │   (Quest UI)        │◄────│  ├── quest-1-profile.wasm               │ │
│  │   Port: 5173        │     │  ├── quest-2-tweet.wasm                 │ │
│  └──────────┬──────────┘     │  └── quest-3-engagement.wasm            │ │
└─────────────┼────────────────└──────────────────┬──────────────────────┘
              │ REST API                          │ MPC-TLS
              ▼                                   ▼
┌─────────────────────────┐     ┌─────────────────────────────────────────┐
│    NestJS Backend       │     │         Notary Infrastructure           │
│    Port: 3000           │     │  ┌─────────────┐ ┌─────────────────────┐ │
│    SQLite DB            │     │  │ Notary 7047 │ │ wstcp Proxy 55688   │ │
└─────────────┬───────────┘     │  └─────────────┘ └─────────────────────┘ │
              │                 └─────────────────────────────────────────┘
              ▼
┌─────────────────────────┐
│   Rust Verifier         │
│   Port: 8080            │
│   (tlsn-core)           │
└─────────────────────────┘
```

## Quick Start

### Prerequisites

1. **Node.js** v18+
2. **Rust** (for verifier and notary)
3. **TLSNotary Browser Extension** (or LupoVerify fork)
4. **Ethereum Wallet** (MetaMask)

### 1. Start the Local Notary Server

```bash
# If not already built
cd ~/projects/tlsn
cargo build --release -p notary-server

# Run notary server
./target/release/notary-server --config ~/.notary-server/config/config.yaml
```

### 2. Start the WebSocket Proxy

```bash
# Install if needed
cargo install wstcp

# Run proxy
wstcp --bind-addr 127.0.0.1:55688 api.x.com:443
```

### 3. Start the Rust Verifier

```bash
cd verifier
RUST_LOG=info cargo run
# Listening on http://localhost:8080
```

### 4. Start the Backend

```bash
cd backend
npm install
npm run start:dev
# API running on http://localhost:3000
```

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

## Quest System

### Quest 1: Verify Twitter Profile
- **Purpose**: Prove you own a Twitter account
- **API**: `GET /1.1/account/settings.json`
- **Reveals**: `screen_name` only
- **Prerequisites**: None

### Quest 2: Verify Tweet Authorship
- **Purpose**: Prove you wrote a specific tweet
- **API**: `GET /1.1/statuses/show.json?id={tweet_id}`
- **Input**: Tweet URL
- **Reveals**: `id_str`, `user.screen_name`, `full_text`
- **Prerequisites**: Quest 1

### Quest 3: Verify Like & Retweet
- **Purpose**: Prove you liked AND retweeted a tweet
- **API**: Twitter GraphQL TweetDetail
- **Input**: Tweet URL
- **Reveals**: `favorited`, `retweeted` flags
- **Prerequisites**: Quest 1

## API Endpoints

### Quest Progress
```
GET /api/quest/progress/:walletAddress
```

### Submit Quest Proof
```
POST /api/quest/:questNumber/submit
{
  "walletAddress": "0x...",
  "proof": { ... },
  "tweetUrl": "https://x.com/..." // For Quest 2/3
}
```

## Project Structure

```
zk-twitter-verifier-002/
├── backend/           # NestJS API + SQLite
├── frontend/          # React + wagmi
├── verifier/          # Rust proof verification
├── plugins/           # TLSNotary WASM plugins
│   ├── quest-1-profile/
│   ├── quest-2-tweet/
│   └── quest-3-engagement/
└── extension/         # LupoVerify (TLSNotary fork)
```

## Ports

| Service | Port |
|---------|------|
| Notary Server | 7047 |
| wstcp Proxy | 55688 |
| Rust Verifier | 8080 |
| Backend API | 3000 |
| Frontend | 5173 |

## Environment Variables

### Backend
- `DATABASE_PATH`: SQLite database path (default: `./data/quests.db`)
- `RUST_VERIFIER_URL`: Verifier service URL (default: `http://localhost:8080`)

### Frontend
- `VITE_API_URL`: Backend API URL (default: `http://localhost:3000`)

### Verifier
- `RUST_LOG`: Log level (default: `info`)

## Development

### Building Plugins

```bash
cd plugins/quest-1-profile
npm install
npm run build
# Output: dist/index.tlsn.wasm
```

### Database Schema

The backend uses SQLite with these tables:
- `users`: Wallet addresses and Twitter handles
- `quest_completions`: Quest progress per user
- `proofs`: Stored proof data (legacy)

## License

MIT

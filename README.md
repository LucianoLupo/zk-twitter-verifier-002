# LupoVerify - ZK Twitter Quest System

Zero-knowledge Twitter verification POC with a 3-quest system. Prove your Twitter identity and actions using cryptographic proofs powered by TLSNotary's MPC-TLS protocol.

## Screenshots

| Verification In Progress | Verification Completed |
|--------------------------|------------------------|
| ![Verification In Progress](docs/images/Screenshot1.png) | ![Verification Completed](docs/images/Screenshot2.png) |

## Related Repositories

- **[LupoVerify Extension](https://github.com/LucianoLupo/lupo-verify-extension)** - Fork of TLSNotary extension with dark glass UI theme

## Features

- **Quest 1**: Verify Twitter profile ownership
- **Quest 2**: Prove you authored a specific tweet
- **Quest 3**: Prove you liked AND retweeted a specific tweet
- **Wallet Integration**: MetaMask signature required for all submissions
- **Dark Glass UI**: Modern glassmorphism design theme
- **Real-time Progress**: Live notarization progress in extension side panel

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite + wagmi |
| Backend | NestJS + SQLite |
| Verifier | Rust + tlsn-core |
| Extension | TLSNotary fork (MV3) |
| Proofs | TLSNotary MPC-TLS |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                   │
│                                                                              │
│  ┌─────────────────────┐          ┌─────────────────────────────────────┐    │
│  │   React Frontend    │  IPC     │      LupoVerify Extension           │    │
│  │   (Quest UI)        │◄────────►│  ├── quest-1-profile.wasm           │    │
│  │   Port: 5173        │          │  ├── quest-2-tweet.wasm             │    │
│  └──────────┬──────────┘          │  └── quest-3-engagement.wasm        │    │
│             │                     └──────────┬───────────────────────────┘   │
│             │                                │                               │
└─────────────┼────────────────────────────────┼───────────────────────────────┘
              │                                │
              │ REST API                       │ HTTPS (User's IP)
              │                                ▼
              │                     ┌─────────────────────────┐
              │                     │   Twitter API           │
              │                     │   api.x.com             │
              │                     │   (sees user's IP)      │
              │                     └─────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│    NestJS Backend       │
│    Port: 3000           │
│    SQLite DB            │
└─────────────┬───────────┘
              │
              ▼
┌─────────────────────────┐
│   Rust Verifier         │
│   Port: 8080            │
│   (tlsn-core)           │
└─────────────────────────┘
```

### MPC-TLS Notarization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER (Extension)                          │
│                                                                             │
│   1. Initiate TLS handshake with Twitter                                    │
│   2. MPC protocol splits TLS keys between browser & notary                  │
│   3. Make HTTPS request to Twitter (USER'S IP seen by Twitter)              │
│   4. Receive encrypted response                                             │
│   5. Generate proof of response authenticity                                │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            │                                       │
            ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│   Twitter API         │               │   Notary Server       │
│   api.x.com:443       │               │   localhost:7047      │
│                       │               │                       │
│   • Sees user's IP    │               │   • MPC-TLS co-signer │
│   • Normal HTTPS      │               │   • Never sees data   │
│   • No idea about     │               │   • Only validates    │
│     notarization      │               │     TLS session       │
└───────────────────────┘               └───────────────────────┘

Key Privacy Properties:
├── Twitter sees: Normal request from user's IP address
├── Notary sees: Encrypted TLS traffic only (no plaintext)
├── User gets: Cryptographic proof of authentic response
└── Verifier: Can validate proof without contacting Twitter
```

## Quick Start

### Prerequisites

1. **Node.js** v18+
2. **Rust** (for verifier and notary)
3. **[LupoVerify Extension](https://github.com/LucianoLupo/lupo-verify-extension)** (built from source)
4. **MetaMask** or compatible Ethereum wallet

### 1. Clone and Setup Extension

```bash
git clone https://github.com/LucianoLupo/lupo-verify-extension.git
cd lupo-verify-extension
npm install
npm run build
# Load build/ folder in chrome://extensions (Developer mode)
```

### 2. Start the Local Notary Server

```bash
# Clone and build TLSNotary
git clone https://github.com/tlsnotary/tlsn.git
cd tlsn
cargo build --release -p notary-server

# Run notary server
./target/release/notary-server --config ~/.notary-server/config/config.yaml
```

### 3. Start the WebSocket Proxy

```bash
cargo install wstcp
wstcp --bind-addr 127.0.0.1:55688 api.x.com:443
```

### 4. Start the Rust Verifier

```bash
cd verifier
RUST_LOG=info cargo run
# Listening on http://localhost:8080
```

### 5. Start the Backend

```bash
cd backend
npm install
npm run start:dev
# API running on http://localhost:3000
```

### 6. Start the Frontend

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
  "signature": { ... },
  "tweetUrl": "https://x.com/..." // For Quest 2/3
}
```

## Project Structure

```
zk-twitter-verifier/
├── backend/           # NestJS API + SQLite
├── frontend/          # React + Vite + wagmi
├── verifier/          # Rust proof verification (tlsn-core)
└── plugins/           # TLSNotary WASM plugins
    ├── quest-1-profile/
    ├── quest-2-tweet/
    └── quest-3-engagement/
```

## Ports

| Service | Port |
|---------|------|
| Notary Server | 7047 |
| wstcp Proxy | 55688 |
| Rust Verifier | 8080 |
| Backend API | 3000 |
| Frontend | 5173 |

## How It Works

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │Frontend │     │Extension│     │ Twitter │     │ Notary  │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ 1. Connect    │               │               │               │
     │   Wallet      │               │               │               │
     │──────────────►│               │               │               │
     │               │               │               │               │
     │ 2. Start      │ 3. Run Plugin │               │               │
     │   Quest       │   (IPC)       │               │               │
     │──────────────►│──────────────►│               │               │
     │               │               │               │               │
     │               │  4. Approval  │               │               │
     │◄──────────────│◄──────────────│               │               │
     │               │               │               │               │
     │ 5. Approve    │               │               │               │
     │──────────────►│──────────────►│               │               │
     │               │               │               │               │
     │               │               │ 6. MPC-TLS    │               │
     │               │               │   Handshake   │               │
     │               │               │◄─────────────────────────────►│
     │               │               │               │               │
     │               │               │ 7. HTTPS      │               │
     │               │               │   Request     │               │
     │               │               │──────────────►│               │
     │               │               │   (User's IP) │               │
     │               │               │               │               │
     │               │               │◄──────────────│               │
     │               │               │  8. Response  │               │
     │               │               │               │               │
     │               │               │ 9. Generate   │               │
     │               │               │    Proof      │               │
     │               │               │──────────────────────────────►│
     │               │               │◄──────────────────────────────│
     │               │               │  10. Signed   │               │
     │               │               │      Proof    │               │
     │               │               │               │               │
     │               │◄──────────────│               │               │
     │               │  11. Proof    │               │               │
     │               │               │               │               │
     │ 12. Sign with │               │               │               │
     │    MetaMask   │               │               │               │
     │◄──────────────│               │               │               │
     │──────────────►│               │               │               │
     │               │               │               │               │
     │               │ 13. Submit to Backend         │               │
     │               │─────────────────────────────► │               │
     │               │        (Rust Verifier)        │               │
     │               │                               │               │
     │               │◄───────────────────────────── │               │
     │◄──────────────│  14. Quest Complete!          │               │
     │               │               │               │               │
```

### Step Details

1. **Connect Wallet** - User connects MetaMask to the frontend
2. **Start Quest** - Click "Start Quest" to trigger plugin execution
3. **Run Plugin** - Frontend sends IPC message to extension
4. **Approval Dialog** - Extension shows what data will be accessed
5. **User Approves** - User confirms the notarization request
6. **MPC-TLS Handshake** - Extension & notary establish shared TLS session
7. **HTTPS Request** - Extension fetches from Twitter (**user's IP is seen**)
8. **Response** - Twitter returns data (only user can decrypt)
9. **Generate Proof** - Extension creates proof of response authenticity
10. **Notary Signs** - Notary co-signs the proof (without seeing content)
11. **Return Proof** - Proof sent back to frontend
12. **Wallet Signature** - User signs submission with MetaMask
13. **Backend Verification** - Rust verifier validates TLSNotary proof
14. **Quest Complete** - Backend records completion in SQLite

## License

MIT

FROM rust:1.75-slim as builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml ./

# Create a dummy main.rs to build dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Build dependencies
RUN cargo build --release && rm -rf src

# Copy actual source code
COPY src ./src

# Build the application
RUN touch src/main.rs && cargo build --release

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/tlsn-verifier-service /app/verifier

ENV RUST_LOG=info

EXPOSE 8080

CMD ["/app/verifier"]

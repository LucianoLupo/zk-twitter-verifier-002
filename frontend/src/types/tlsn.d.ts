declare global {
  interface Window {
    tlsn?: TLSNProvider;
  }
}

export interface TLSNProvider {
  connect(): Promise<TLSNClient>;
}

export interface TLSNClient {
  runPlugin(url: string, params?: Record<string, string>): Promise<ProofData | string | null>;
}

// TLSNotary v0.1.0-alpha.12 proof format
export interface ProofData {
  version: string;
  data: string; // hex-encoded bincode-serialized Presentation
  meta: ProofMeta;
}

export interface ProofMeta {
  notaryUrl: string;
  websocketProxyUrl?: string;
}

// Legacy format (for backwards compatibility)
export interface LegacyProofData {
  notaryUrl: string;
  session: Session;
  substrings: Substrings;
}

export interface Session {
  header: SessionHeader;
  signature: string;
}

export interface SessionHeader {
  encoder_seed: string;
  merkle_root: string;
  sent_len: number;
  recv_len: number;
  handshake_summary: HandshakeSummary;
}

export interface HandshakeSummary {
  time: number;
  server_public_key: ServerPublicKey;
  handshake_commitment: string;
}

export interface ServerPublicKey {
  group: string;
  key: string;
}

export interface Substrings {
  openings: Record<string, unknown>;
  inclusion_proof: InclusionProof;
}

export interface InclusionProof {
  proof: string[];
  total_leaves: number;
}

export {};

import { useWallet } from '../hooks/useWallet';

const styles = {
  container: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '16px 32px',
    fontSize: '18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  error: {
    color: '#ff6b6b',
    marginTop: '16px',
  },
};

export function ConnectWallet() {
  const { connectWallet, isConnecting, error } = useWallet();

  return (
    <div style={styles.container}>
      <h2 style={{ marginBottom: '24px' }}>Connect Your Wallet</h2>
      <p style={{ marginBottom: '24px', opacity: 0.8 }}>
        Connect your Ethereum wallet to link your Twitter verification
      </p>
      <button
        style={styles.button}
        onClick={connectWallet}
        disabled={isConnecting}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

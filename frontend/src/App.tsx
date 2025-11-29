import { useWallet } from './hooks/useWallet';
import { ConnectWallet } from './components/ConnectWallet';
import { QuestList } from './components/QuestList';

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '40px 20px',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
  },
  container: {
    maxWidth: '520px',
    width: '100%',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px',
  },
  logo: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '36px',
    fontWeight: 700,
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    opacity: 0.7,
    fontSize: '16px',
    lineHeight: 1.5,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '24px',
    padding: '32px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footer: {
    marginTop: '40px',
    textAlign: 'center' as const,
    opacity: 0.4,
    fontSize: '13px',
  },
  link: {
    color: '#818CF8',
    textDecoration: 'none',
  },
  walletInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(79, 70, 229, 0.1)',
    borderRadius: '12px',
    marginBottom: '24px',
    fontSize: '14px',
  },
  walletAddress: {
    fontFamily: 'monospace',
    color: '#818CF8',
  },
  disconnectButton: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'rgba(255, 255, 255, 0.7)',
    padding: '6px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

function App() {
  const { isConnected, address, disconnect } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logo}>🔐</div>
          <h1 style={styles.title}>LupoVerify</h1>
          <p style={styles.subtitle}>
            Complete quests to prove your Twitter activity<br />
            using zero-knowledge proofs
          </p>
        </header>

        <div style={styles.card}>
          {isConnected && address ? (
            <>
              <div style={styles.walletInfo}>
                <span style={styles.walletAddress}>{formatAddress(address)}</span>
                <button style={styles.disconnectButton} onClick={() => disconnect()}>
                  Disconnect
                </button>
              </div>
              <QuestList />
            </>
          ) : (
            <ConnectWallet />
          )}
        </div>

        <footer style={styles.footer}>
          <p>
            Powered by{' '}
            <a
              href="https://tlsnotary.org"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              TLSNotary
            </a>
            {' '}• Zero-Knowledge Proofs
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;

import { useState } from 'react';

interface TweetInputProps {
  onSubmit: (tweetUrl: string) => void;
  questType: 'authorship' | 'engagement';
}

const styles = {
  container: {
    width: '100%',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    opacity: 0.7,
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '14px',
    marginBottom: '12px',
    boxSizing: 'border-box' as const,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  error: {
    color: '#EF4444',
    fontSize: '12px',
    marginBottom: '12px',
  },
  hint: {
    fontSize: '12px',
    opacity: 0.5,
    marginBottom: '16px',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #4F46E5 0%, #667eea 100%)',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// Parse tweet URL to extract tweet ID
function parseTweetUrl(url: string): string | null {
  try {
    const patterns = [
      /twitter\.com\/\w+\/status\/(\d+)/,
      /x\.com\/\w+\/status\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function TweetInput({ onSubmit, questType }: TweetInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!url.trim()) {
      setError('Please enter a tweet URL');
      return;
    }

    const tweetId = parseTweetUrl(url);
    if (!tweetId) {
      setError('Invalid tweet URL. Please use format: https://x.com/username/status/123...');
      return;
    }

    onSubmit(url);
  };

  const getHint = () => {
    if (questType === 'authorship') {
      return 'Enter the URL of a tweet YOU posted to prove authorship.';
    }
    return 'Enter the URL of a tweet you have BOTH liked AND retweeted.';
  };

  return (
    <div style={styles.container}>
      <label style={styles.label}>Tweet URL</label>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://x.com/username/status/1234567890"
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
        }}
      />
      {error && <p style={styles.error}>{error}</p>}
      <p style={styles.hint}>{getHint()}</p>
      <button
        style={{
          ...styles.button,
          ...(!url.trim() ? styles.buttonDisabled : {}),
        }}
        onClick={handleSubmit}
        disabled={!url.trim()}
      >
        Continue
      </button>
    </div>
  );
}

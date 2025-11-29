import { useState, useEffect, useCallback } from 'react';
import { QuestCard } from './QuestCard';
import { TweetInput } from './TweetInput';
import { useExtension } from '../hooks/useExtension';
import { useWallet } from '../hooks/useWallet';
import { apiService, QuestProgress, QuestStatus } from '../services/api';

interface Quest {
  number: number;
  name: string;
  type: 'profile' | 'authorship' | 'engagement';
  status: QuestStatus | 'locked';
  description: string;
  completedAt?: Date;
  metadata?: {
    twitterHandle?: string;
    tweetId?: string;
    tweetText?: string;
  };
}

const QUEST_DESCRIPTIONS = {
  1: 'Connect your Twitter account to prove you own it. This enables the other quests.',
  2: 'Prove you authored a specific tweet by providing its URL.',
  3: 'Prove you liked AND retweeted a specific tweet.',
};

const PLUGIN_URLS = {
  1: '/twitter_profile.tlsn.wasm',
  2: '/twitter_profile.tlsn.wasm', // TODO: Build dedicated tweet authorship plugin
  3: '/twitter_profile.tlsn.wasm', // TODO: Build dedicated engagement plugin
};

const styles = {
  container: {
    width: '100%',
  },
  header: {
    marginBottom: '24px',
  },
  progress: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  progressDot: {
    width: '40px',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotCompleted: {
    background: '#10B981',
  },
  progressText: {
    fontSize: '14px',
    opacity: 0.7,
  },
  twitterHandle: {
    background: 'rgba(29, 161, 242, 0.1)',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handleText: {
    fontWeight: 600,
    color: '#1DA1F2',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#1a1a2e',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '450px',
    width: '90%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  cancelButton: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    marginTop: '12px',
  },
};

export function QuestList() {
  const { address, signQuestSubmission } = useWallet();
  const { runPlugin, isExtensionInstalled, extensionError } = useExtension();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [twitterHandle, setTwitterHandle] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQuest, setActiveQuest] = useState<number | null>(null);
  const [showTweetInput, setShowTweetInput] = useState(false);
  const [pendingQuestNumber, setPendingQuestNumber] = useState<number | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      const progress = await apiService.getQuestProgress(address);
      setTwitterHandle(progress.twitterHandle);

      const mappedQuests: Quest[] = progress.quests.map((q) => ({
        number: q.number,
        name: q.name,
        type: q.type,
        status: q.status,
        description: QUEST_DESCRIPTIONS[q.number as keyof typeof QUEST_DESCRIPTIONS],
        completedAt: q.completedAt,
        metadata: {
          twitterHandle: progress.twitterHandle,
          tweetId: q.metadata?.tweetId,
          tweetText: q.metadata?.tweetText,
        },
      }));

      setQuests(mappedQuests);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
      setError('Failed to load quest progress');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const handleStartQuest = async (questNumber: number, tweetUrl?: string) => {
    if (!address) return;
    if (!isExtensionInstalled) {
      setError('LupoVerify extension is not installed. Please install it first.');
      return;
    }

    // For quest 2 and 3, we need a tweet URL
    if ((questNumber === 2 || questNumber === 3) && !tweetUrl) {
      setPendingQuestNumber(questNumber);
      setShowTweetInput(true);
      return;
    }

    setActiveQuest(questNumber);
    setError(null);

    try {
      // Run the plugin to generate proof
      const pluginUrl = PLUGIN_URLS[questNumber as keyof typeof PLUGIN_URLS];
      const params = tweetUrl ? { tweetUrl } : undefined;

      const proof = await runPlugin(pluginUrl, params);

      if (!proof) {
        setError('Failed to generate proof. Please try again.');
        return;
      }

      // Sign the submission with wallet
      console.log('Requesting wallet signature...');
      const signatureData = await signQuestSubmission();
      console.log('Wallet signature obtained');

      // Submit the proof to backend with signature
      const result = await apiService.submitQuest(questNumber, address, proof, signatureData, tweetUrl);

      if (result.success) {
        // Refresh progress
        await fetchProgress();
      } else {
        setError(result.message || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Quest error:', err);
      setError(err.message || 'An error occurred during verification');
    } finally {
      setActiveQuest(null);
    }
  };

  const handleTweetSubmit = (tweetUrl: string) => {
    setShowTweetInput(false);
    if (pendingQuestNumber) {
      handleStartQuest(pendingQuestNumber, tweetUrl);
      setPendingQuestNumber(null);
    }
  };

  const completedCount = quests.filter((q) => q.status === 'completed').length;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading quests...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.progress}>
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              style={{
                ...styles.progressDot,
                ...(quests.find((q) => q.number === num)?.status === 'completed'
                  ? styles.progressDotCompleted
                  : {}),
              }}
            />
          ))}
        </div>
        <p style={styles.progressText}>
          {completedCount}/3 quests completed
        </p>
      </div>

      {twitterHandle && (
        <div style={styles.twitterHandle}>
          <span>Connected as:</span>
          <span style={styles.handleText}>@{twitterHandle}</span>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {extensionError && (
        <div style={styles.error}>
          Extension error: {extensionError}
        </div>
      )}

      {quests.map((quest) => (
        <QuestCard
          key={quest.number}
          questNumber={quest.number}
          title={quest.name}
          description={quest.description}
          status={quest.status}
          completedData={quest.metadata}
          onStart={() => handleStartQuest(quest.number)}
          isLoading={activeQuest === quest.number}
        />
      ))}

      {showTweetInput && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>
              Enter Tweet URL for Quest {pendingQuestNumber}
            </h3>
            <TweetInput
              onSubmit={handleTweetSubmit}
              questType={pendingQuestNumber === 2 ? 'authorship' : 'engagement'}
            />
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowTweetInput(false);
                setPendingQuestNumber(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

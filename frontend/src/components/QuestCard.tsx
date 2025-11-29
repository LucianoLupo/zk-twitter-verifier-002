import { useState } from 'react';

interface QuestCardProps {
  questNumber: number;
  title: string;
  description: string;
  status: 'locked' | 'pending' | 'in_progress' | 'completed';
  completedData?: {
    twitterHandle?: string;
    tweetId?: string;
    tweetText?: string;
  };
  onStart: () => void;
  isLoading?: boolean;
}

const styles = {
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s ease',
  },
  cardLocked: {
    opacity: 0.5,
    pointerEvents: 'none' as const,
  },
  cardCompleted: {
    borderColor: '#10B981',
    background: 'rgba(16, 185, 129, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  questNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4F46E5 0%, #667eea 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '14px',
    marginRight: '12px',
  },
  questNumberCompleted: {
    background: '#10B981',
  },
  questNumberLocked: {
    background: 'rgba(255, 255, 255, 0.2)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
  },
  statusPending: {
    background: 'rgba(79, 70, 229, 0.2)',
    color: '#818CF8',
  },
  statusCompleted: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#10B981',
  },
  statusLocked: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  description: {
    fontSize: '14px',
    opacity: 0.7,
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  completedInfo: {
    padding: '12px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #4F46E5 0%, #667eea 100%)',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  checkIcon: {
    marginRight: '8px',
  },
};

export function QuestCard({
  questNumber,
  title,
  description,
  status,
  completedData,
  onStart,
  isLoading,
}: QuestCardProps) {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const canStart = status === 'pending';

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return <span style={{ ...styles.statusBadge, ...styles.statusCompleted }}>Completed</span>;
      case 'locked':
        return <span style={{ ...styles.statusBadge, ...styles.statusLocked }}>Locked</span>;
      case 'in_progress':
        return <span style={{ ...styles.statusBadge, ...styles.statusPending }}>In Progress</span>;
      default:
        return <span style={{ ...styles.statusBadge, ...styles.statusPending }}>Available</span>;
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        ...(isLocked ? styles.cardLocked : {}),
        ...(isCompleted ? styles.cardCompleted : {}),
      }}
    >
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div
            style={{
              ...styles.questNumber,
              ...(isCompleted ? styles.questNumberCompleted : {}),
              ...(isLocked ? styles.questNumberLocked : {}),
            }}
          >
            {isCompleted ? '✓' : questNumber}
          </div>
          <h3 style={styles.title}>{title}</h3>
        </div>
        {getStatusBadge()}
      </div>

      <p style={styles.description}>{description}</p>

      {isCompleted && completedData && (
        <div style={styles.completedInfo}>
          {completedData.twitterHandle && (
            <div>✓ Verified as @{completedData.twitterHandle}</div>
          )}
          {completedData.tweetId && (
            <div>✓ Tweet ID: {completedData.tweetId}</div>
          )}
        </div>
      )}

      {!isCompleted && !isLocked && (
        <button
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {}),
          }}
          onClick={onStart}
          disabled={isLoading || !canStart}
        >
          {isLoading ? 'Verifying...' : `Start Quest ${questNumber}`}
        </button>
      )}

      {isLocked && (
        <button style={{ ...styles.button, ...styles.buttonDisabled }} disabled>
          Complete Quest {questNumber - 1} First
        </button>
      )}
    </div>
  );
}

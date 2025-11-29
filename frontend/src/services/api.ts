const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type QuestStatus = 'locked' | 'pending' | 'in_progress' | 'completed' | 'failed';
export type QuestType = 'profile' | 'authorship' | 'engagement';

export interface ProofData {
  version: string;
  data: string;
  meta: {
    notaryUrl: string;
    websocketProxyUrl?: string;
  };
}

export interface QuestProgress {
  walletAddress: string;
  twitterHandle?: string;
  quests: Array<{
    number: number;
    name: string;
    type: QuestType;
    status: QuestStatus;
    completedAt?: Date;
    metadata?: {
      tweetId?: string;
      tweetUrl?: string;
      tweetText?: string;
      likeVerified?: boolean;
      retweetVerified?: boolean;
    };
  }>;
}

export interface QuestSubmitResult {
  success: boolean;
  questNumber: number;
  status: QuestStatus;
  message?: string;
  verificationResult?: {
    twitterHandle?: string;
    tweetId?: string;
    authorVerified?: boolean;
    likeVerified?: boolean;
    retweetVerified?: boolean;
  };
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getQuestProgress(walletAddress: string): Promise<QuestProgress> {
    const response = await fetch(
      `${this.baseUrl}/api/quest/progress/${walletAddress}`
    );

    if (!response.ok) {
      // If user doesn't exist yet, return default empty progress
      if (response.status === 404) {
        return {
          walletAddress: walletAddress.toLowerCase(),
          quests: [
            { number: 1, name: 'Verify Twitter Profile', type: 'profile', status: 'pending' },
            { number: 2, name: 'Verify Tweet Authorship', type: 'authorship', status: 'locked' },
            { number: 3, name: 'Verify Like & Retweet', type: 'engagement', status: 'locked' },
          ],
        };
      }
      throw new Error('Failed to fetch quest progress');
    }

    return response.json();
  }

  async submitQuest(
    questNumber: number,
    walletAddress: string,
    proof: ProofData,
    signatureData: {
      signature: string;
      message: string;
      timestamp: number;
    },
    tweetUrl?: string
  ): Promise<QuestSubmitResult> {
    const response = await fetch(
      `${this.baseUrl}/api/quest/${questNumber}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          proof,
          tweetUrl,
          signature: signatureData.signature,
          message: signatureData.message,
          timestamp: signatureData.timestamp,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Submission failed' }));
      throw new Error(error.message || 'Failed to submit quest');
    }

    return response.json();
  }

  // Legacy support for checking verification (used by old components)
  async checkVerification(walletAddress: string): Promise<{
    verified: boolean;
    twitterHandle?: string;
    verifiedAt?: string;
  } | null> {
    try {
      const progress = await this.getQuestProgress(walletAddress);
      const quest1 = progress.quests.find((q) => q.number === 1);

      if (quest1?.status === 'completed') {
        return {
          verified: true,
          twitterHandle: progress.twitterHandle,
          verifiedAt: quest1.completedAt?.toString(),
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const apiService = new ApiService(API_URL);

// Legacy exports for backward compatibility
export async function checkVerification(walletAddress: string) {
  return apiService.checkVerification(walletAddress);
}

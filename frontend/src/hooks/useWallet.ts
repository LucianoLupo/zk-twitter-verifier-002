import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  /**
   * Sign a message for quest submission verification
   * Returns { signature, message, timestamp }
   */
  const signQuestSubmission = async (): Promise<{
    signature: string;
    message: string;
    timestamp: number;
  }> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const timestamp = Date.now();
    const message = `LupoVerify Quest Submission\nWallet: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;

    const signature = await signMessageAsync({ message });

    return { signature, message, timestamp };
  };

  return {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    disconnect,
    signQuestSubmission,
    error: connectError?.message || null,
  };
}

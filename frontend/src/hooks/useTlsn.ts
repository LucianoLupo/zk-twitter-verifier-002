import { useState, useCallback, useEffect } from 'react';
import type { ProofData } from '../types/tlsn';

// Twitter profile plugin - built from tlsn-plugin-boilerplate
// This plugin returns the notarization ID to the calling page
const TWITTER_PLUGIN_URL = 'http://localhost:5173/twitter_profile.tlsn.wasm';

export interface UseTlsnReturn {
  isExtensionAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  proof: ProofData | null;
  requestVerification: () => Promise<ProofData | null>;
  getHistory: () => Promise<unknown[]>;
  reset: () => void;
}

export function useTlsn(): UseTlsnReturn {
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);

  // Check for extension on mount and listen for tlsn_loaded event
  useEffect(() => {
    const checkExtension = () => {
      if (typeof window !== 'undefined' && window.tlsn) {
        setIsExtensionAvailable(true);
      }
    };

    // Check immediately
    checkExtension();

    // Also check on window load (extension might inject after initial render)
    const handleLoad = () => checkExtension();

    // Listen for the tlsn_loaded event (fired by extension when ready)
    const handleTlsnLoaded = () => {
      setIsExtensionAvailable(true);
    };

    window.addEventListener('load', handleLoad);
    window.addEventListener('tlsn_loaded', handleTlsnLoaded);

    // Fallback: poll for a short time in case events are missed
    const pollInterval = setInterval(() => {
      if (window.tlsn) {
        setIsExtensionAvailable(true);
        clearInterval(pollInterval);
      }
    }, 500);

    // Stop polling after 5 seconds
    setTimeout(() => clearInterval(pollInterval), 5000);

    return () => {
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('tlsn_loaded', handleTlsnLoaded);
      clearInterval(pollInterval);
    };
  }, []);

  const requestVerification = useCallback(async (): Promise<ProofData | null> => {
    console.log('requestVerification called, window.tlsn:', !!window.tlsn);

    if (!window.tlsn) {
      setError('TLSNotary extension not installed. Please install it first.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Connect to the extension
      console.log('Connecting to TLSN extension...');
      const client = await window.tlsn.connect();
      console.log('Connected to TLSN extension, client:', client);

      // Run the twitter_profile plugin
      // This will open the extension UI and guide the user through:
      // 1. Navigating to Twitter
      // 2. Authenticating (if needed)
      // 3. Creating a notarized proof of their profile
      console.log('Running plugin:', TWITTER_PLUGIN_URL);
      const result = await client.runPlugin(TWITTER_PLUGIN_URL);
      console.log('runPlugin returned:', result);
      console.log('runPlugin result type:', typeof result);
      console.log('runPlugin result stringified:', JSON.stringify(result, null, 2));

      // Handle different response formats
      let proofData: ProofData | null = null;

      if (result && typeof result === 'object') {
        // Check if it's a ProofData object (has version, data, meta)
        if ('version' in result && 'data' in result && 'meta' in result) {
          console.log('Received ProofData format');
          proofData = result as ProofData;
        }
        // Check if it has the proof wrapped differently
        else if ('proof' in result) {
          console.log('Received wrapped proof format');
          proofData = (result as { proof: ProofData }).proof;
        }
        // Try to use as-is if it looks like a valid proof
        else if ('version' in result && 'data' in result) {
          console.log('Received proof without meta, adding default');
          proofData = {
            version: (result as { version: string }).version,
            data: (result as { data: string }).data,
            meta: {
              notaryUrl: 'http://localhost:7047',
            }
          };
        }
        else {
          console.log('Unknown proof format, keys:', Object.keys(result));
        }
      } else if (typeof result === 'string') {
        // Might be a session ID or error message
        console.log('Received string result:', result);
      }

      if (proofData) {
        setProof(proofData);
        return proofData;
      }

      console.log('No valid proof data extracted');
      return null;
    } catch (err) {
      console.error('requestVerification error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to generate proof. Please try again.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getHistory = useCallback(async (): Promise<unknown[]> => {
    // Note: TLSNotary extension doesn't expose history API to calling pages
    // Proofs must be downloaded from extension UI and uploaded manually
    console.log('getHistory called - not supported by TLSNotary extension API');
    return [];
  }, []);

  const reset = useCallback(() => {
    setProof(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isExtensionAvailable,
    isLoading,
    error,
    proof,
    requestVerification,
    getHistory,
    reset,
  };
}

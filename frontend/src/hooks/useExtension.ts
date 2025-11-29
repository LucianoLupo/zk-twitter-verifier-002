import { useState, useEffect, useCallback } from 'react';

// TLSNotary/LupoVerify proof format
interface ProofData {
  version: string;
  data: string;
  meta: {
    notaryUrl: string;
    websocketProxyUrl?: string;
  };
}

interface ExtensionClient {
  runPlugin(url: string, params?: Record<string, string>): Promise<ProofData | null>;
}

interface ExtensionProvider {
  connect(): Promise<ExtensionClient>;
}

// Check for both lupoVerify and tlsn (fallback) providers
declare global {
  interface Window {
    lupoVerify?: ExtensionProvider;
    tlsn?: ExtensionProvider;
  }
}

export function useExtension() {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [client, setClient] = useState<ExtensionClient | null>(null);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if extension is installed
  useEffect(() => {
    const checkExtension = () => {
      const hasExtension = !!(window.lupoVerify || window.tlsn);
      setIsExtensionInstalled(hasExtension);
    };

    // Check immediately
    checkExtension();

    // Also check after a short delay (extension might inject later)
    const timeout = setTimeout(checkExtension, 1000);

    // Listen for extension load event
    const handleExtensionLoad = () => {
      checkExtension();
    };

    window.addEventListener('lupoVerify_loaded', handleExtensionLoad);
    window.addEventListener('tlsn_loaded', handleExtensionLoad);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('lupoVerify_loaded', handleExtensionLoad);
      window.removeEventListener('tlsn_loaded', handleExtensionLoad);
    };
  }, []);

  // Connect to extension
  const connect = useCallback(async (): Promise<ExtensionClient | null> => {
    if (client) return client;

    const provider = window.lupoVerify || window.tlsn;
    if (!provider) {
      setExtensionError('Extension not installed');
      return null;
    }

    setIsConnecting(true);
    setExtensionError(null);

    try {
      const newClient = await provider.connect();
      setClient(newClient);
      return newClient;
    } catch (err: any) {
      setExtensionError(err.message || 'Failed to connect to extension');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  // Run a plugin and get proof
  const runPlugin = useCallback(
    async (
      pluginUrl: string,
      params?: Record<string, string>
    ): Promise<ProofData | null> => {
      setExtensionError(null);

      try {
        // Get or create client
        let activeClient = client;
        if (!activeClient) {
          activeClient = await connect();
          if (!activeClient) {
            throw new Error('Could not connect to extension');
          }
        }

        // Resolve relative plugin URL to absolute
        const absoluteUrl = new URL(pluginUrl, window.location.origin).href;

        console.log('Running plugin:', absoluteUrl, params);

        // Run the plugin
        const result = await activeClient.runPlugin(absoluteUrl, params);

        if (!result) {
          throw new Error('Plugin returned no result');
        }

        // Handle different result formats
        if (typeof result === 'object' && 'version' in result && 'data' in result) {
          return result as ProofData;
        }

        // Try to parse as JSON if it's a string
        if (typeof result === 'string') {
          try {
            return JSON.parse(result) as ProofData;
          } catch {
            throw new Error('Invalid proof format returned from plugin');
          }
        }

        throw new Error('Unexpected result format from plugin');
      } catch (err: any) {
        console.error('Plugin error:', err);
        setExtensionError(err.message || 'Plugin execution failed');
        return null;
      }
    },
    [client, connect]
  );

  return {
    isExtensionInstalled,
    isConnecting,
    extensionError,
    connect,
    runPlugin,
  };
}

import { useState, useEffect, useRef } from 'react';
import { useTlsn } from '../hooks/useTlsn';
import { useWallet } from '../hooks/useWallet';
import { checkVerification, VerificationStatus } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const styles = {
  container: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  walletInfo: {
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  address: {
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  disconnectBtn: {
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  verifyButton: {
    background: 'linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%)',
    color: 'white',
    border: 'none',
    padding: '20px 40px',
    fontSize: '18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '0 auto',
  },
  secondaryButton: {
    background: 'linear-gradient(135deg, #2ed573 0%, #1e8b4d 100%)',
    color: 'white',
    border: 'none',
    padding: '16px 32px',
    fontSize: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    margin: '0 auto',
    marginTop: '16px',
  },
  uploadButton: {
    background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
    color: 'white',
    border: 'none',
    padding: '16px 32px',
    fontSize: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    margin: '0 auto',
    marginTop: '16px',
  },
  disabledButton: {
    background: '#555',
    cursor: 'not-allowed',
  },
  error: {
    background: 'rgba(255, 107, 107, 0.2)',
    border: '1px solid #ff6b6b',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '20px',
    color: '#ff6b6b',
  },
  success: {
    background: 'rgba(46, 213, 115, 0.2)',
    border: '1px solid #2ed573',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '20px',
  },
  extensionWarning: {
    background: 'rgba(255, 193, 7, 0.2)',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  link: {
    color: '#1DA1F2',
    textDecoration: 'none',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #fff',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  stepBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    textAlign: 'left' as const,
  },
  fileInput: {
    display: 'none',
  },
  fileName: {
    marginTop: '8px',
    fontSize: '14px',
    opacity: 0.8,
  },
  tabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'transparent',
    color: 'white',
  },
  activeTab: {
    background: 'rgba(29, 161, 242, 0.3)',
    borderColor: '#1DA1F2',
  },
};

type Step = 'idle' | 'verifying' | 'uploading' | 'submitting';
type Mode = 'auto' | 'simple' | 'verified';

export function VerifyTwitter() {
  const { address, disconnect } = useWallet();
  const { isExtensionAvailable, requestVerification, reset } = useTlsn();
  const [existingVerification, setExistingVerification] = useState<VerificationStatus | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [mode, setMode] = useState<Mode>('auto');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; handle?: string; message?: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if wallet is already verified on mount
  useEffect(() => {
    async function check() {
      if (!address) return;
      try {
        const status = await checkVerification(address);
        setExistingVerification(status);
      } catch (e) {
        console.error('Failed to check verification status:', e);
      } finally {
        setCheckingStatus(false);
      }
    }
    check();
  }, [address]);

  const handleStartVerification = async (autoSubmit: boolean = false) => {
    if (!address) return;
    console.log('Starting verification, address:', address, 'autoSubmit:', autoSubmit);
    setStep('verifying');

    try {
      // Start the plugin - this opens the extension and waits for proof
      const proofData = await requestVerification();
      console.log('requestVerification returned:', proofData);
      console.log('proofData type:', typeof proofData);
      console.log('proofData stringified:', JSON.stringify(proofData, null, 2));

      // If we got proof data and autoSubmit is enabled, submit it
      if (autoSubmit && proofData && typeof proofData === 'object') {
        console.log('Auto-submitting proof to backend...');
        setStep('submitting');
        setSubmitting(true);

        const response = await fetch(`${API_URL}/api/verification/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            proof: proofData,
          }),
        });

        const data = await response.json();
        console.log('Auto-submit verification response:', data);

        if (response.ok && data.success) {
          setResult({ success: true, handle: data.handle });
          setExistingVerification({ verified: true, twitterHandle: data.handle });
        } else {
          setResult({ success: false, message: data.message || 'Verification failed' });
        }
        setSubmitting(false);
      } else if (autoSubmit) {
        // runPlugin returned null/undefined - show fallback options
        console.log('runPlugin returned null, showing fallback options');
        setResult({
          success: false,
          message: 'Proof data not received from extension. Please use "Upload Proof" mode instead.'
        });
      }
    } catch (err) {
      console.error('requestVerification error:', err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Verification failed',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
    }
  };

  const handleUploadProof = async () => {
    if (!address || !proofFile) return;

    setSubmitting(true);
    try {
      const proofContent = await proofFile.text();
      const proof = JSON.parse(proofContent);
      console.log('Uploading proof:', proof);

      // Send to our Rust verifier via backend
      const response = await fetch(`${API_URL}/api/verification/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          proof: proof,
        }),
      });

      const data = await response.json();
      console.log('Verification response:', data);

      if (response.ok && data.success) {
        setResult({ success: true, handle: data.handle });
        setExistingVerification({ verified: true, twitterHandle: data.handle });
      } else {
        setResult({ success: false, message: data.message || 'Verification failed' });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to verify proof',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimpleSave = async () => {
    if (!address || !twitterHandle.trim()) return;

    const cleanHandle = twitterHandle.trim().replace('@', '');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/verification/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          twitterHandle: cleanHandle,
          sessionId: `manual-${Date.now()}`,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setResult({ success: true, handle: cleanHandle });
        setExistingVerification({ verified: true, twitterHandle: cleanHandle });
      } else {
        setResult({ success: false, message: data.message || 'Failed to save' });
      }
    } catch (err) {
      console.error('Save error:', err);
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save verification',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    setStep('idle');
    setResult(null);
    setTwitterHandle('');
    setProofFile(null);
  };

  if (checkingStatus) {
    return (
      <div style={styles.container}>
        <p>Checking verification status...</p>
      </div>
    );
  }

  // Already verified
  if (existingVerification?.verified) {
    return (
      <div style={styles.container}>
        <div style={styles.walletInfo}>
          <span style={styles.address}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button style={styles.disconnectBtn} onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
        <div style={styles.success}>
          <h3 style={{ color: '#2ed573', marginBottom: '12px' }}>Verified!</h3>
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>
            @{existingVerification.twitterHandle}
          </p>
          <p style={{ opacity: 0.7 }}>
            Your Twitter account is linked to this wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>
        {`@keyframes spin { to { transform: rotate(360deg); } }`}
      </style>

      <div style={styles.walletInfo}>
        <span style={styles.address}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button style={styles.disconnectBtn} onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>

      {!isExtensionAvailable && (
        <div style={styles.extensionWarning}>
          <h4 style={{ marginBottom: '8px' }}>TLSNotary Extension Required</h4>
          <p style={{ marginBottom: '12px' }}>
            Install the TLSNotary browser extension to verify your Twitter account.
          </p>
          <a
            href="https://chromewebstore.google.com/detail/tlsnotary-extension/gcfkkledipjbgdbimfpijgbkhajiaaph"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Install Extension
          </a>
        </div>
      )}

      <h2 style={{ marginBottom: '16px' }}>Verify Your Twitter Account</h2>

      {/* Mode Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === 'auto' ? styles.activeTab : {}) }}
          onClick={() => { setMode('auto'); setStep('idle'); handleReset(); }}
        >
          Automatic
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'verified' ? styles.activeTab : {}) }}
          onClick={() => { setMode('verified'); setStep('idle'); handleReset(); }}
        >
          Upload Proof
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'simple' ? styles.activeTab : {}) }}
          onClick={() => { setMode('simple'); setStep('idle'); handleReset(); }}
        >
          Manual
        </button>
      </div>

      {/* Auto Mode */}
      {mode === 'auto' && step === 'idle' && (
        <>
          <p style={{ marginBottom: '32px', opacity: 0.8 }}>
            Click the button to verify your Twitter account.
            <br />
            <small>(Proof will be automatically submitted after verification)</small>
          </p>

          <button
            style={{
              ...styles.verifyButton,
              ...(!isExtensionAvailable ? styles.disabledButton : {}),
            }}
            onClick={() => handleStartVerification(true)}
            disabled={!isExtensionAvailable}
          >
            Verify Twitter Account
          </button>
        </>
      )}

      {mode === 'auto' && step === 'verifying' && (
        <div style={styles.stepBox}>
          <h4 style={{ marginBottom: '12px' }}>Verifying...</h4>
          <p>Complete the verification in the TLSNotary extension.</p>
          <p style={{ marginTop: '12px', opacity: 0.7 }}>
            The proof will be automatically submitted when complete.
          </p>
          <div style={{ ...styles.loadingSpinner, margin: '20px auto' }} />
        </div>
      )}

      {mode === 'auto' && step === 'submitting' && (
        <div style={styles.stepBox}>
          <h4 style={{ marginBottom: '12px' }}>Submitting proof...</h4>
          <p>Verifying your proof on the server.</p>
          <div style={{ ...styles.loadingSpinner, margin: '20px auto' }} />
        </div>
      )}

      {/* Simple Mode */}
      {mode === 'simple' && step === 'idle' && (
        <>
          <p style={{ marginBottom: '24px', opacity: 0.8 }}>
            Enter your Twitter handle, verify in TLSNotary, then save.
            <br />
            <small>(Fast MVP - manual handle entry)</small>
          </p>

          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Your Twitter handle (e.g., @username)"
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              style={{
                padding: '12px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                width: '250px',
              }}
            />
          </div>

          <button
            style={{
              ...styles.verifyButton,
              ...(!isExtensionAvailable || !twitterHandle.trim() ? styles.disabledButton : {}),
            }}
            onClick={() => handleStartVerification(false)}
            disabled={!isExtensionAvailable || !twitterHandle.trim()}
          >
            Step 1: Open TLSNotary Extension
          </button>
        </>
      )}

      {mode === 'simple' && step === 'verifying' && (
        <>
          <div style={styles.stepBox}>
            <h4 style={{ marginBottom: '12px' }}>Verifying: @{twitterHandle.replace('@', '')}</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li>Complete the verification in the TLSNotary extension</li>
              <li>Wait for "Notarization successful" message</li>
              <li>Click Save below when done</li>
            </ol>
          </div>

          <button
            style={{
              ...styles.secondaryButton,
              ...(submitting ? styles.disabledButton : {}),
            }}
            onClick={handleSimpleSave}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Step 2: Save Verification'}
          </button>

          <button
            onClick={handleReset}
            style={{ ...styles.disconnectBtn, marginTop: '16px', display: 'block', margin: '16px auto' }}
          >
            Cancel
          </button>
        </>
      )}

      {/* Verified Mode */}
      {mode === 'verified' && step === 'idle' && (
        <>
          <p style={{ marginBottom: '32px', opacity: 0.8 }}>
            Create a proof in TLSNotary, download it, and upload here.
            <br />
            <small>(Full cryptographic verification)</small>
          </p>

          <button
            style={{
              ...styles.verifyButton,
              ...(!isExtensionAvailable ? styles.disabledButton : {}),
            }}
            onClick={() => {
              handleStartVerification(false);
              setStep('uploading');
            }}
            disabled={!isExtensionAvailable}
          >
            Step 1: Open TLSNotary Extension
          </button>
        </>
      )}

      {mode === 'verified' && step === 'uploading' && (
        <>
          <div style={styles.stepBox}>
            <h4 style={{ marginBottom: '12px' }}>Instructions:</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li>Complete the verification in the TLSNotary extension</li>
              <li>Click <strong>"Download"</strong> in the extension to save the proof</li>
              <li>Upload the proof file below</li>
            </ol>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            style={styles.fileInput}
          />

          <button
            style={styles.uploadButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Select Proof File (.json)
          </button>

          {proofFile && (
            <p style={styles.fileName}>Selected: {proofFile.name}</p>
          )}

          <button
            style={{
              ...styles.secondaryButton,
              ...(submitting || !proofFile ? styles.disabledButton : {}),
            }}
            onClick={handleUploadProof}
            disabled={submitting || !proofFile}
          >
            {submitting ? 'Verifying...' : 'Step 2: Verify & Save'}
          </button>

          <button
            onClick={handleReset}
            style={{ ...styles.disconnectBtn, marginTop: '16px', display: 'block', margin: '16px auto' }}
          >
            Cancel
          </button>
        </>
      )}

      {result && !result.success && (
        <div style={styles.error}>
          <p>{result.message || 'Verification failed'}</p>
          <button
            onClick={handleReset}
            style={{ ...styles.disconnectBtn, marginTop: '12px' }}
          >
            Try Again
          </button>
        </div>
      )}

      {result?.success && (
        <div style={styles.success}>
          <h3 style={{ color: '#2ed573', marginBottom: '12px' }}>
            Verification Saved!
          </h3>
          <p style={{ fontSize: '24px' }}>@{result.handle}</p>
        </div>
      )}
    </div>
  );
}

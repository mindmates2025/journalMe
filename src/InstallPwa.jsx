import React, { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';

const InstallPwa = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Detect iOS
    const iOSCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOSCheck);

    // 2. Check if already in "Standalone" (Installed) mode
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // If already installed, do nothing
    if (isInStandaloneMode) return;

    // 3. Android/Desktop: Listen for the 'beforeinstallprompt' event
    const handler = (e) => {
      e.preventDefault(); // Prevent default browser banner
      setPromptInstall(e); // Save the event for later
      setSupportsPWA(true);
      setShowBanner(true); // Show our custom UI
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If iOS, just show banner immediately (since there is no event to wait for)
    if (iOSCheck) setShowBanner(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = (e) => {
    e.preventDefault();
    if (!promptInstall) return;
    
    // Trigger the actual browser prompt
    promptInstall.prompt();
    
    // Wait for response
    promptInstall.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false); // They accepted, hide banner
      }
      setPromptInstall(null);
    });
  };

  if (!showBanner) return null;

  return (
    <div className="install-banner fade-in" style={{
      position: 'fixed', bottom: '80px', left: '16px', right: '16px',
      background: '#1e293b', color: 'white', padding: '16px',
      borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <h4 style={{margin: 0, fontSize: '0.95rem', fontWeight: '700'}}>Install JournalMe</h4>
          <p style={{margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.8}}>
            {isIOS ? "Install for offline access & better privacy." : "Add to home screen for offline access."}
          </p>
        </div>
        <button onClick={() => setShowBanner(false)} style={{background: 'none', border: 'none', color: '#94a3b8'}}>
          <X size={18} />
        </button>
      </div>

      {isIOS ? (
        // iOS Instructions
        <div style={{fontSize: '0.8rem', background: '#334155', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span>Tap</span> <Share size={14} /> <span>then "Add to Home Screen"</span> <PlusBox />
        </div>
      ) : (
        // Android/Desktop Button
        <button 
          onClick={handleInstallClick}
          style={{
            background: '#6366f1', color: 'white', border: 'none', 
            padding: '10px', borderRadius: '8px', fontWeight: '600',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
          }}
        >
          <Download size={16} /> Install App
        </button>
      )}
    </div>
  );
};

// Tiny helper icon for iOS instruction
const PlusBox = () => (
  <div style={{width: '16px', height: '16px', border: '1px solid white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{fontSize: '12px', fontWeight: 'bold', lineHeight: 0}}>+</div>
  </div>
);

export default InstallPwa;
import { useEffect, useState } from 'react';

// Add-to-home-screen install invite (PWA-1/B-144). Captures the Android/Chromium
// `beforeinstallprompt` event so Paramètres can offer an explicit "Installer l'app" button.
// iOS Safari never fires the event → `canInstall` stays false there (no in-app hint, by
// decision); the button also hides once installed or already running standalone.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => void } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPrompt = (e: Event): void => {
      e.preventDefault(); // keep the browser's own mini-infobar from showing
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = (): void => {
    if (!deferred) return;
    void deferred.prompt();
    setDeferred(null); // a prompt can only be used once
  };

  return { canInstall: deferred !== null && !isStandalone(), promptInstall };
}

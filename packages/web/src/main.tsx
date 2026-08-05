import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { QueryProvider } from './app/providers/QueryProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { AppRouter } from './app/router';
import { Toaster } from './components/Toast/Toaster';
import { registerServiceWorker } from './lib/pwa/registerSw';
import './i18n/config';
import './styles/tokens.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Register the PWA service worker (no-op in dev / unsupported browsers; PWA-1, ADR-0003).
registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    {/* Root boundary (B-265): outside the router, so it still renders the recovery card when the
        failure is the router itself. The per-screen boundary lives in AppShell. It sits inside
        ThemeProvider so the card is drawn in the user's theme. */}
    <ThemeProvider>
      <ErrorBoundary>
        <QueryProvider>
          <AppRouter />
          {/* B-261: the single toast surface, at the root so any screen can raise one — the
              provider stays neutral and the caller supplies the undo callback. */}
          <Toaster />
        </QueryProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);

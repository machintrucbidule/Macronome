import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './app/providers/QueryProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { AppRouter } from './app/router';
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
    <ThemeProvider>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './app/providers/QueryProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { SettingsSync } from './app/SettingsSync';
import { AppRouter } from './app/router';
import './i18n/config';
import './styles/tokens.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <SettingsSync>
          <AppRouter />
        </SettingsSync>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);

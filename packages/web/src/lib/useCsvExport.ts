import { useState } from 'react';
import { notify } from '../components/Toast/notify';

// Shared CSV-export trigger (EX-1 / B-132): kicks off a file download and tracks a transient
// error flag so the page can show a dismissible warning banner. The download itself is the
// server response (api/data.ts → downloadFile); this only owns the failure UI state.
export interface CsvExport {
  error: boolean;
  start: () => void;
  dismiss: () => void;
}

export function useCsvExport(run: () => Promise<void>): CsvExport {
  const [error, setError] = useState(false);
  return {
    error,
    start: () => {
      setError(false);
      // B-261: the file lands in the browser's downloads, off-screen. No undo — nothing changed.
      void run()
        .then(() => notify('exportDone'))
        .catch(() => setError(true));
    },
    dismiss: () => setError(false),
  };
}

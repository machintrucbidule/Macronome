import { useState } from 'react';

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
      void run().catch(() => setError(true));
    },
    dismiss: () => setError(false),
  };
}

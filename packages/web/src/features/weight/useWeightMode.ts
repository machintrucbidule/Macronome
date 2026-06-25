import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DietFlag } from '@macronome/shared';
import { useSettingsMutation } from '../settings/useSettings';
import { WEIGHT_KEY } from './useWeight';

// Screen-local current mode (Régime/Maintien) for the Poids header + the new-weigh-in default.
// Seeded once from the server's persisted `current_mode` (GET /weight). A change updates it
// optimistically and persists to app_user.settings via PATCH /settings (M7 — reusing the
// theme/locale settings-patch path), then refreshes the weight view so the server-derived
// `current_mode` stays consistent (the cache is otherwise stale for 30 s).
export function useWeightMode(serverMode: DietFlag | null): {
  mode: DietFlag | null;
  setMode: (m: DietFlag) => void;
} {
  const [mode, setMode] = useState<DietFlag | null>(null);
  const persist = useSettingsMutation();
  const qc = useQueryClient();

  useEffect(() => {
    if (mode === null && serverMode) setMode(serverMode);
  }, [mode, serverMode]);

  const changeMode = (m: DietFlag): void => {
    setMode(m); // optimistic; the persisted value comes back via GET /weight below
    persist.mutate(
      { current_mode: m },
      { onSuccess: () => void qc.invalidateQueries({ queryKey: [WEIGHT_KEY] }) },
    );
  };

  return { mode, setMode: changeMode };
}

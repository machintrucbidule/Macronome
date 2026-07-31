import { useEffect, useState } from 'react';
import type { Settings } from '@macronome/shared';
import { useSettingsMutation, useSettingsQuery } from './useSettings';

// Shared edit rule for the numeric settings steppers (extracted from MealLinesFields, B-203, and
// reused by the minimum-columns field, B-244). The draft is seeded from the query; a valid
// in-range value saves immediately (that covers the ▲▼ stepper), and blur clamps then saves a
// final value (that covers mid-typing out-of-range input). Bounds mirror the server Zod.
type NumericKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

export function useNumberSetting(key: NumericKey, min: number, max: number) {
  const settings = useSettingsQuery().data?.data;
  const saveSettings = useSettingsMutation();
  const [value, setValue] = useState('');
  const stored = settings?.[key];

  useEffect(() => {
    if (stored !== undefined) setValue(String(stored));
  }, [stored]);

  const onChange = (raw: string): void => {
    setValue(raw);
    const n = Number(raw);
    if (Number.isInteger(n) && n >= min && n <= max && stored !== undefined && n !== stored) {
      saveSettings.mutate({ [key]: n });
    }
  };

  const onBlur = (): void => {
    if (stored === undefined) return;
    const n = Math.round(Number(value));
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : stored;
    setValue(String(clamped));
    if (clamped !== stored) saveSettings.mutate({ [key]: clamped });
  };

  return { value, onChange, onBlur, min, max };
}

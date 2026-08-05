import type { DayTone } from '@macronome/shared';
import { useAppBadge } from '../lib/pwa/useAppBadge';
import { useDayTone } from './useDayTone';
import styles from './AppShell.module.css';

// The window-level day signal (B-262): a 2px rule carrying TODAY's compliance tone under the
// title strip, plus the app-icon badge driven by the same value. One component so the two
// surfaces read a single query and can never disagree.
//
// Decorative on purpose: `aria-hidden`, because the verdict is already available as text on
// Repas and Journal and a bare colour with no label would only add noise to a screen reader
// (design/components/top-nav.md).

const TONE_CLASS: Record<DayTone, string | undefined> = {
  ok: styles.toneOk,
  warn: styles.toneWarn,
  nok: styles.toneNok,
  none: undefined, // falls back to --border: indistinguishable from the appbar's own edge
};

export function DayToneRule() {
  const tone = useDayTone();
  useAppBadge(tone);
  return (
    <div
      className={`${styles.toneRule} ${TONE_CLASS[tone] ?? ''}`}
      data-tone={tone}
      aria-hidden="true"
    />
  );
}

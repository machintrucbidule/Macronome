import { useTranslation } from 'react-i18next';
import type { IntervalDay, IntervalDayState } from '@macronome/shared';
import { formatInt } from '../../../lib/format/number';
import { DASH, formatDayLong, isWeekend, kcal0 } from '../format';
import styles from './interval-days.module.css';

// One day card of the interval-days recap (B-227). Uniform height (the comment slot is always
// present, reserved even when empty). Server-derived figures only — the web formats + colours; it
// computes nothing (CLAUDE.md rule 2). Clicking navigates to that day's Repas screen.

const STATE_CLASS: Record<IntervalDayState, string | undefined> = {
  ok: styles.stOk,
  partiel: styles.stPartiel,
  nok: styles.stNok,
  none: styles.stNone,
};

export function IntervalDayRow({
  day,
  today,
  onOpen,
}: {
  day: IntervalDay;
  today: string;
  onOpen: (date: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const dateLabel = formatDayLong(day.date, i18n.language);
  const isToday = day.date === today;
  const cls = [styles.day, isWeekend(day.date) && styles.weekend, STATE_CLASS[day.state]]
    .filter(Boolean)
    .join(' ');
  const kcalLabel =
    day.kcal === null ? t('weight.intervalDays.notLogged') : `${kcal0(day.kcal)} kcal`;

  return (
    <button
      type="button"
      className={cls}
      onClick={() => onOpen(day.date)}
      aria-label={`${dateLabel} · ${kcalLabel}`}
    >
      <span className={styles.date}>
        {dateLabel}
        {isToday && <span className={styles.today}>{t('weight.intervalDays.today')}</span>}
      </span>
      <span className={day.kcal === null ? `${styles.kcal} ${styles.kcalNone}` : styles.kcal}>
        {kcalLabel}
      </span>
      <span className={styles.comment} title={day.comment ?? undefined}>
        {day.comment}
      </span>
      {day.macros ? (
        <span className={styles.macros}>
          <span className={styles.mFat}>L {formatInt(day.macros.L)}</span>
          <span className={styles.mCarb}>G {formatInt(day.macros.G)}</span>
          <span className={styles.mProt}>P {formatInt(day.macros.P)}</span>
        </span>
      ) : (
        <span className={styles.macrosNone}>{DASH}</span>
      )}
    </button>
  );
}

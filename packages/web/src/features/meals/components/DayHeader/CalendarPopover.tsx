import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { journalApi } from '../../../../api/journal';
import { parseIso, todayIso } from '../../format';
import styles from '../../meals.module.css';

// Month grid with day-state dots (specifications/screens/meals.md §Layout). Dots come from the
// Journal API (one row per logged day): detailed → full, summary (imported) → partial. Future
// days are selectable (plan meals ahead, parity with the ‹ › arrows — B-016). View-only —
// picking a day navigates the screen.
interface CalendarPopoverProps {
  selected: string;
  onPick: (date: string) => void;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${`${m + 1}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
}

export function CalendarPopover({ selected, onPick }: CalendarPopoverProps) {
  const { t } = useTranslation();
  const sel = parseIso(selected);
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const year = month.getFullYear();
  const journal = useQuery({ queryKey: ['journal', year], queryFn: () => journalApi.list(year) });

  const states = new Map<string, 'full' | 'partial'>();
  for (const row of journal.data?.data ?? [])
    states.set(row.date, row.kind === 'summary' ? 'partial' : 'full');

  const today = todayIso();
  const mo = month.getMonth();
  const firstDow = (new Date(year, mo, 1).getDay() + 6) % 7; // Monday-based offset
  const days = new Date(year, mo + 1, 0).getDate();
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className={styles.cal} onMouseDown={(e) => e.stopPropagation()}>
      <div className={styles.calHead}>
        <button type="button" onClick={() => setMonth(new Date(year, mo - 1, 1))}>
          ‹
        </button>
        <span>{monthLabel}</span>
        <button type="button" onClick={() => setMonth(new Date(year, mo + 1, 1))}>
          ›
        </button>
      </div>
      <div className={styles.calGrid}>
        {(t('meals.calendar.dow', { returnObjects: true }) as string[]).map((d, i) => (
          <div key={i} className={styles.dow}>
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const date = iso(year, mo, d);
          const cls = [
            styles.day,
            date === today ? styles.today : '',
            date === selected ? styles.sel : '',
          ].join(' ');
          const dot = states.get(date);
          return (
            <div key={d} className={cls} onClick={() => onPick(date)}>
              {d}
              {dot && (
                <span
                  className={`${styles.dot} ${dot === 'full' ? styles.full : styles.partial}`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.full} />
          {t('meals.calendar.full')}
        </span>
        <span>
          <i className={styles.partial} />
          {t('meals.calendar.partial')}
        </span>
      </div>
    </div>
  );
}

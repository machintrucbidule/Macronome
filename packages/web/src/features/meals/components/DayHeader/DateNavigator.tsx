import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shiftIso } from '../../format';
import { CalendarPopover } from './CalendarPopover';
import styles from '../../meals.module.css';

// Date navigator: prev/next day arrows + a calendar popover. Picking/shifting navigates the
// screen to that date (the parent updates the route).
interface DateNavigatorProps {
  date: string;
  onNavigate: (date: string) => void;
}

export function DateNavigator({ date, onNavigate }: DateNavigatorProps) {
  const { t } = useTranslation();
  const [calOpen, setCalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [calOpen]);

  return (
    <div className={styles.dateNav} ref={ref}>
      <button
        type="button"
        title={t('meals.nav.prev')}
        onClick={() => onNavigate(shiftIso(date, -1))}
      >
        ‹
      </button>
      <button
        type="button"
        title={t('meals.nav.next')}
        onClick={() => onNavigate(shiftIso(date, 1))}
      >
        ›
      </button>
      <button type="button" title={t('meals.nav.calendar')} onClick={() => setCalOpen((o) => !o)}>
        ▦
      </button>
      {calOpen && (
        <CalendarPopover
          selected={date}
          onPick={(d) => {
            setCalOpen(false);
            onNavigate(d);
          }}
        />
      )}
    </div>
  );
}

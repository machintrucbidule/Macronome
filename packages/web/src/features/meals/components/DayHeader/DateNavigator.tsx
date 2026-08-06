import { useTranslation } from 'react-i18next';
import { shiftIso } from '../../format';
import { CalendarPopover } from './CalendarPopover';
import type { CalendarPopoverState } from './useCalendarPopover';
import styles from '../../meals.module.css';

// Date navigator: prev/next day arrows + a calendar popover. Picking/shifting navigates the
// screen to that date (the parent updates the route). The popover's open-state is owned by the
// parent (B-297) so the date label can drive it too; it still renders inside `.dateNav`, which is
// its positioning context.
interface DateNavigatorProps {
  date: string;
  onNavigate: (date: string) => void;
  cal: CalendarPopoverState;
}

export function DateNavigator({ date, onNavigate, cal }: DateNavigatorProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.dateNav} ref={cal.navRef}>
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
      <button type="button" title={t('meals.nav.calendar')} onClick={cal.toggle}>
        ▦
      </button>
      {cal.open && (
        <CalendarPopover
          selected={date}
          onPick={(d) => {
            cal.close();
            onNavigate(d);
          }}
        />
      )}
    </div>
  );
}

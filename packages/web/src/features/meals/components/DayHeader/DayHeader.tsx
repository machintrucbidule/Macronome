import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useMealSwipe } from '../../hooks/useMealSwipe';
import { formatDateLabel, formatDateLabelShort, shiftIso, todayIso } from '../../format';
import { DateNavigator } from './DateNavigator';
import { useCalendarPopover } from './useCalendarPopover';
import { DayKindBadge } from './DayKindBadge';
import { DayCommentField } from './DayCommentField';
import { DayVerdictBadge } from './DayVerdictBadge';
import { DayMenu, type DayMenuActions } from '../DayMenu/DayMenu';
import { TotalsRow } from '../TotalsRow/TotalsRow';
import styles from '../../meals.module.css';

// Sticky day header: the date line (navigator + day-kind chip menu + editable comment + OK/NOK
// badge, B-063/B-064) then the totals row. Stays pinned under the app bar while meals scroll.
// On mobile (detailed days) the date row also carries the "⋯" day menu (spec §5.1) — the desktop
// MealsControls row is hidden ≤560px and its day actions live there.
interface DayHeaderProps {
  date: string;
  day: DayDetail;
  onNavigate: (date: string) => void;
  /** Day-level actions for the mobile "⋯" menu (omitted on summary days). */
  menu?: DayMenuActions;
}

export function DayHeader({ date, day, onNavigate, menu }: DayHeaderProps) {
  const { t, i18n } = useTranslation();
  const isToday = date === todayIso();
  const isMobile = useIsMobile();
  // Swipe the date band to change day on mobile (B-154): left = next, right = prev — same
  // convention as the ‹ › arrows and the meal-tab swipe (dir −1/+1). The hook ignores gestures
  // starting on a button/input/menu, so the ‹ › / ⋯ / comment controls keep their own behaviour.
  const cal = useCalendarPopover();
  // A completed swipe is followed by a synthesized click on wherever the finger lifted. Stamping
  // the swipe lets the date label ignore that click, so a day-swipe never also opens the calendar.
  const swipedAt = useRef(0);
  const dateSwipe = useMealSwipe(isMobile, (dir) => {
    swipedAt.current = Date.now();
    onNavigate(shiftIso(date, dir));
  });
  const openCalendar = (): void => {
    if (Date.now() - swipedAt.current < 500) return;
    cal.toggle();
  };
  const onLabelKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    cal.toggle();
  };

  return (
    <div className={styles.sticky}>
      <div className={styles.daybar}>
        {/* Date group wrapped so it can claim its own row ≤560px (`.dateRow`, mobile-responsive
            S4); `display:contents` keeps it inert on desktop. */}
        <div className={styles.dateRow} {...dateSwipe}>
          <DateNavigator date={date} onNavigate={onNavigate} cal={cal} />
          {/* Two date variants, CSS-toggled (appbarTitle pattern): the long label on desktop, the
              compact one ≤560px. Both render; the breakpoint hides one.
              The label is a second trigger for the calendar (B-297). Deliberately NOT a <button>:
              useMealSwipe drops gestures starting on one, which would kill the day-swipe over the
              widest part of the row — `role="button"` is not in that selector. */}
          <div
            ref={cal.labelRef}
            className={styles.dateLabel}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={cal.open}
            title={t('meals.nav.calendar')}
            onClick={openCalendar}
            onKeyDown={onLabelKey}
          >
            <span className={styles.dateLong}>{formatDateLabel(date, i18n.language)}</span>
            <span className={styles.dateShort}>{formatDateLabelShort(date, i18n.language)}</span>
            {isToday && <small>{t('meals.today')}</small>}
          </div>
          {isMobile && menu && day.kind === 'detailed' && (
            <DayMenu menu={menu} day={day} date={date} />
          )}
        </div>
        <DayKindBadge kind={day.kind} confirmNeeded={day.totals.kcal > 0} />
        <DayCommentField comment={day.comment} />
        <DayVerdictBadge
          effective={day.effective_verdict}
          auto={day.verdict_auto}
          override={day.verdict_override}
          tone={day.tone}
        />
      </div>
      <TotalsRow day={day} />
    </div>
  );
}

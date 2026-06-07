import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { formatDateLabel, todayIso } from '../../format';
import { DateNavigator } from './DateNavigator';
import { DayKindBadge } from './DayKindBadge';
import { DayCommentField } from './DayCommentField';
import { DayVerdictBadge } from './DayVerdictBadge';
import { TotalsRow } from '../TotalsRow/TotalsRow';
import styles from '../../meals.module.css';

// Sticky day header: the date line (navigator + day-kind chip menu + editable comment + OK/NOK
// badge, B-063/B-064) then the totals row. Stays pinned under the app bar while meals scroll.
interface DayHeaderProps {
  date: string;
  day: DayDetail;
  onNavigate: (date: string) => void;
}

export function DayHeader({ date, day, onNavigate }: DayHeaderProps) {
  const { t, i18n } = useTranslation();
  const isToday = date === todayIso();

  return (
    <div className={styles.sticky}>
      <div className={styles.daybar}>
        <DateNavigator date={date} onNavigate={onNavigate} />
        <div className={styles.dateLabel}>
          {formatDateLabel(date, i18n.language)}
          {isToday && <small>{t('meals.today')}</small>}
        </div>
        <DayKindBadge kind={day.kind} confirmNeeded={day.totals.kcal > 0} />
        <DayCommentField comment={day.comment} />
        <DayVerdictBadge
          effective={day.effective_verdict}
          auto={day.verdict_auto}
          override={day.verdict_override}
        />
      </div>
      <TotalsRow day={day} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { formatDateLabel, todayIso } from '../../format';
import { DateNavigator } from './DateNavigator';
import { DayTypeTag } from './DayTypeTag';
import { TotalsRow } from '../TotalsRow/TotalsRow';
import styles from '../../meals.module.css';

// Sticky day header: date navigator + day-type tag + the editable day comment + the totals row.
// Stays pinned under the app bar while the meals scroll.
interface DayHeaderProps {
  date: string;
  day: DayDetail;
  onNavigate: (date: string) => void;
}

export function DayHeader({ date, day, onNavigate }: DayHeaderProps) {
  const { t, i18n } = useTranslation();
  const { actions } = useMeals();
  const [comment, setComment] = useState(day.comment ?? '');

  useEffect(() => setComment(day.comment ?? ''), [day.comment]);
  const isToday = date === todayIso();

  return (
    <div className={styles.sticky}>
      <div className={styles.daybar}>
        <DateNavigator date={date} onNavigate={onNavigate} />
        <div className={styles.dateLabel}>
          {formatDateLabel(date, i18n.language)}
          {isToday && <small>{t('meals.today')}</small>}
        </div>
        <DayTypeTag kind={day.kind} />
      </div>
      <div className={styles.dayComment}>
        <span className={styles.dcIcon} title={t('meals.commentTitle')}>
          ✎
        </span>
        <input
          value={comment}
          placeholder={t('meals.commentPlaceholder')}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (day.comment ?? '') && void actions.setComment(comment)}
        />
      </div>
      <TotalsRow day={day} />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/Modal/Modal';
import { formatDayCompact } from '../format';
import { useIntervalDays } from '../useWeight';
import { IntervalDaysHeader } from './IntervalDaysHeader';
import { IntervalDayRow } from './IntervalDayRow';
import styles from './interval-days.module.css';

// Today (UTC YYYY-MM-DD), matching the app's date convention (WeighInModal / targets).
const todayStr = (): string => new Date().toISOString().slice(0, 10);

// Read-only interval-days recap popup (B-225, redesigned B-227; screens/weight.md §Interval-days
// recap). Lists every calendar day of a period's inclusive [start,end] with a recap header, coloured
// macros and a per-day verdict band (server-derived; the web only renders — CLAUDE.md rule 2). Each
// day navigates to that day's Repas screen (/day/:date), then closes the popup.

interface IntervalDaysModalProps {
  start: string;
  end: string;
  /** The interval's end weight + Δ (from the Period), for the header's weight change; null on the
   *  open interval (no closing weight). */
  weightEnd: number | null;
  delta: number | null;
  onClose: () => void;
}

export function IntervalDaysModal({
  start,
  end,
  weightEnd,
  delta,
  onClose,
}: IntervalDaysModalProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const query = useIntervalDays(start, end);
  const today = todayStr();
  const openDay = (date: string): void => {
    onClose();
    void navigate(`/day/${date}`);
  };
  const title = `${formatDayCompact(start, i18n.language)} → ${formatDayCompact(end, i18n.language)}`;

  return (
    <Modal title={title} onClose={onClose} fillBody>
      <div className={styles.wrap}>
        {query.data && (
          <IntervalDaysHeader summary={query.data.summary} weightEnd={weightEnd} delta={delta} />
        )}
        {query.isLoading ? (
          <p className={styles.state}>{t('weight.intervalDays.loading')}</p>
        ) : (
          <div className={styles.list}>
            {(query.data?.data ?? []).map((day) => (
              <IntervalDayRow key={day.date} day={day} today={today} onOpen={openDay} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

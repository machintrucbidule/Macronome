import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { IntervalDay } from '@macronome/shared';
import { Modal } from '../../../components/Modal/Modal';
import { formatInt } from '../../../lib/format/number';
import { DASH, kcal0 } from '../format';
import { useIntervalDays } from '../useWeight';
import styles from './interval-days.module.css';

// Read-only interval-days recap popup (B-225, screens/weight.md §Interval-days recap). Lists every
// calendar day of a period's inclusive [start,end] range with its calories / macros / comment
// (server-derived; the web only renders — CLAUDE.md rule 2). Each day is a button navigating to
// that day's Repas screen (/day/:date), then closing the popup — the JournalDaySheet pattern.

const macroLine = (m: IntervalDay['macros']): string =>
  m === null ? DASH : `L ${formatInt(m.L)} · G ${formatInt(m.G)} · P ${formatInt(m.P)}`;

function DayRow({ day, onOpen }: { day: IntervalDay; onOpen: (date: string) => void }) {
  return (
    <button type="button" className={styles.day} onClick={() => onOpen(day.date)}>
      <span className={styles.date}>{day.date}</span>
      <span className={styles.figures}>
        <span>{day.kcal === null ? DASH : `${kcal0(day.kcal)} kcal`}</span>
        <span className={styles.macros}>{macroLine(day.macros)}</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
      {day.comment && <span className={styles.comment}>{day.comment}</span>}
    </button>
  );
}

interface IntervalDaysModalProps {
  start: string;
  end: string;
  onClose: () => void;
}

export function IntervalDaysModal({ start, end, onClose }: IntervalDaysModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useIntervalDays(start, end);
  const days = query.data?.data ?? [];
  const openDay = (date: string): void => {
    onClose();
    void navigate(`/day/${date}`);
  };
  return (
    <Modal title={`${start} → ${end}`} onClose={onClose} fillBody>
      <div className={styles.list}>
        {query.isLoading ? (
          <p className={styles.state}>{t('weight.intervalDays.loading')}</p>
        ) : days.length === 0 ? (
          <p className={styles.state}>{t('weight.intervalDays.empty')}</p>
        ) : (
          days.map((d) => <DayRow key={d.date} day={d} onOpen={openDay} />)
        )}
      </div>
    </Modal>
  );
}

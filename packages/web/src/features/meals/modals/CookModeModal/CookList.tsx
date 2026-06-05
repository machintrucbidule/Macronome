import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CookRow } from './CookRow';
import type { CookSession } from './useCookSession';
import styles from './cook-mode.module.css';

// The cook-mode left pane: the meal's lines as large name·qty·unit rows, font auto-sized to fill
// the height. Reads the working copy from the session; renders one CookRow per line.
interface CookListProps {
  session: CookSession;
  listRef: RefObject<HTMLDivElement>;
  fontSize: number;
}

export function CookList({ session: s, listRef, fontSize }: CookListProps) {
  const { t } = useTranslation();

  return (
    <div ref={listRef} className={styles.list} style={{ fontSize }}>
      {s.lines.length === 0 ? (
        <div className={styles.empty}>{t('meals.cook.empty')}</div>
      ) : (
        s.lines.map((line) => (
          <CookRow
            key={line.id}
            line={line}
            selected={s.selectedId === line.id}
            mode={s.mode}
            query={s.query}
            displayQty={s.displayQty(line)}
            onSelectName={() => s.selectName(line.id)}
            onSelectQty={() => s.selectQty(line.id)}
            onSetUnit={(unit, portionId) => s.setUnit(line.id, unit, portionId)}
          />
        ))
      )}
    </div>
  );
}

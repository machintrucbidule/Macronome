import { type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayDetail, MealProposal, MealProposalItem } from '@macronome/shared';
import { previewRemaining } from '../logic/remainingPreview';
import {
  lineKey,
  pinnedFromItem,
  stepPinned,
  type ExcludedFood,
  type PinnedLine,
} from '../logic/refineConstraints';
import { formatInt } from '../../../lib/format/number';
import { RemainingCards } from './RemainingCards';
import styles from './modals.module.css';

// Refine panel (mockup state 5, B-123 / Slice 11). Per line: a − / + quantity stepper (touching it
// "pins" the line — "use 2 not 3", §2.6) and an exclude ✕ ("Sans"). The accumulated constraints live
// in the parent dialog (re-sent on every call); this panel only edits them. The day targets are
// shown read-only ("Cibles inchangées") and never mutated here (CLAUDE.md rule 2).
interface Props {
  proposal: MealProposal;
  day: DayDetail;
  excluded: ExcludedFood[];
  setExcluded: Dispatch<SetStateAction<ExcludedFood[]>>;
  pinned: PinnedLine[];
  setPinned: Dispatch<SetStateAction<PinnedLine[]>>;
  note: string;
  onNoteChange: (note: string) => void;
}

/** Compact quantity label for a pin: portioned → "×n" / "1 label"; portionless → "n g". */
function pinLabel(line: PinnedLine): string {
  if (line.unit === 'portion') {
    return line.count >= 2 ? `×${formatInt(line.count)}` : `1 ${line.portion_label ?? ''}`.trim();
  }
  return `${formatInt(line.count)} g`;
}

function RefineLine({
  item,
  excluded,
  pin,
  onToggleExclude,
  onStep,
}: {
  item: MealProposalItem;
  excluded: boolean;
  pin: PinnedLine | undefined;
  onToggleExclude: () => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const view = pin ?? pinnedFromItem(item);
  if (excluded) {
    return (
      <div className={`${styles.rfRow} ${styles.rfExcluded}`}>
        <span className={styles.rfName}>{`${item.food_name} · ${pinLabel(view)}`}</span>
        <button type="button" className={styles.rfUndo} onClick={onToggleExclude}>
          {t('meals.proposals.refine.restore')}
        </button>
      </div>
    );
  }
  return (
    <div className={styles.rfRow}>
      <span className={styles.rfName}>{item.food_name}</span>
      <span className={`${styles.stepper} ${pin ? styles.pinned : ''}`}>
        <button type="button" onClick={() => onStep(-1)} aria-label="−">
          −
        </button>
        <span className={styles.stepVal}>{pinLabel(view)}</span>
        <button type="button" onClick={() => onStep(1)} aria-label="+">
          +
        </button>
      </span>
      <button
        type="button"
        className={styles.rfEx}
        title={t('meals.proposals.refine.exclude')}
        aria-label={t('meals.proposals.refine.exclude')}
        onClick={onToggleExclude}
      >
        ✕
      </button>
    </div>
  );
}

function ConstraintChips({
  excluded,
  pinned,
  onRestore,
  onUnpin,
}: {
  excluded: ExcludedFood[];
  pinned: PinnedLine[];
  onRestore: (foodId: string) => void;
  onUnpin: (key: string) => void;
}) {
  const { t } = useTranslation();
  if (excluded.length === 0 && pinned.length === 0) {
    return <div className={styles.consEmpty}>{t('meals.proposals.refine.constraintsEmpty')}</div>;
  }
  return (
    <div className={styles.consList}>
      {excluded.map((e) => (
        <div key={`x-${e.food_id}`} className={styles.cons}>
          <span className={`${styles.ck} ${styles.ckSans}`}>
            {t('meals.proposals.refine.sans')}
          </span>
          {e.food_name}
          <button type="button" className={styles.consX} onClick={() => onRestore(e.food_id)}>
            ×
          </button>
        </div>
      ))}
      {pinned.map((p) => (
        <div key={`p-${lineKey(p)}`} className={styles.cons}>
          <span className={`${styles.ck} ${styles.ckFixe}`}>
            {t('meals.proposals.refine.fixe')}
          </span>
          {`${p.food_name} · ${pinLabel(p)}`}
          <button type="button" className={styles.consX} onClick={() => onUnpin(lineKey(p))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function RefinePanel({
  proposal,
  day,
  excluded,
  setExcluded,
  pinned,
  setPinned,
  note,
  onNoteChange,
}: Props) {
  const { t } = useTranslation();
  const rem = previewRemaining(day.target_snapshot, day.totals);
  const isExcluded = (foodId: string): boolean => excluded.some((e) => e.food_id === foodId);
  const pinFor = (item: MealProposalItem): PinnedLine | undefined =>
    pinned.find((p) => lineKey(p) === lineKey(item));

  const toggleExclude = (item: MealProposalItem): void => {
    if (isExcluded(item.food_id)) {
      setExcluded((cur) => cur.filter((e) => e.food_id !== item.food_id));
      return;
    }
    setExcluded((cur) => [...cur, { food_id: item.food_id, food_name: item.food_name }]);
    setPinned((cur) => cur.filter((p) => p.food_id !== item.food_id));
  };
  const restore = (foodId: string): void =>
    setExcluded((cur) => cur.filter((e) => e.food_id !== foodId));
  const step = (item: MealProposalItem, dir: 1 | -1): void => {
    const next = stepPinned(pinFor(item) ?? pinnedFromItem(item), dir);
    setPinned((cur) => {
      const rest = cur.filter((p) => lineKey(p) !== lineKey(item));
      return [...rest, next];
    });
  };
  const unpin = (key: string): void => setPinned((cur) => cur.filter((p) => lineKey(p) !== key));

  return (
    <>
      <div className={styles.sub}>{t('meals.proposals.refine.intro')}</div>
      <div className={styles.refineGrid}>
        <div>
          <div className={styles.rfLines}>
            <div className={styles.gl}>{t('meals.proposals.refine.linesLabel')}</div>
            {proposal.items.map((item) => (
              <RefineLine
                key={lineKey(item)}
                item={item}
                excluded={isExcluded(item.food_id)}
                pin={pinFor(item)}
                onToggleExclude={() => toggleExclude(item)}
                onStep={(dir) => step(item, dir)}
              />
            ))}
          </div>
          <label className={styles.aiNoteField}>
            <span>{t('meals.proposals.refine.moreNoteLabel')}</span>
            <textarea
              value={note}
              maxLength={500}
              placeholder={t('meals.proposals.refine.notePlaceholder')}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </label>
          <div className={styles.charCount}>{`${note.length} / 500`}</div>
        </div>
        <div>
          <span className={styles.fieldLbl}>{t('meals.proposals.refine.constraintsLabel')}</span>
          <ConstraintChips
            excluded={excluded}
            pinned={pinned}
            onRestore={restore}
            onUnpin={unpin}
          />
          <span className={styles.fieldLbl}>{t('meals.proposals.refine.targetsUnchanged')}</span>
          <RemainingCards rem={rem} />
        </div>
      </div>
    </>
  );
}

import { useTranslation } from 'react-i18next';
import type { DayDetail, MealProposal } from '@macronome/shared';
import { ProposalCard } from './ProposalCard';
import styles from './modals.module.css';

// The AI proposals result (mockup state 4, B-123 / Slice 10): the 3 (or fewer) distinct proposals
// side by side. Display only — every number shown is the server-certified value from the
// `MealSuggestions` payload (CLAUDE.md rule 2). Meal names + the carb-ceiling flag come from the
// already-loaded day; nothing here is recomputed.
interface Props {
  proposals: MealProposal[];
  day: DayDetail;
  onRefine: (proposal: MealProposal) => void;
  onChoose: (proposal: MealProposal) => void;
  busy: boolean;
}

export function ProposalsList({ proposals, day, onRefine, onChoose, busy }: Props) {
  const { t } = useTranslation();
  const mealNames = new Map(day.meals.map((m) => [m.id, m.slot_name]));
  const hasCarbCeiling = day.target_snapshot.carb_ceiling_g !== null;

  return (
    <>
      <div className={styles.resIntro}>{t('meals.proposals.resultsIntro')}</div>
      <div className={styles.proposals}>
        {proposals.map((p, i) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            index={i}
            mealNames={mealNames}
            hasCarbCeiling={hasCarbCeiling}
            onRefine={() => onRefine(p)}
            onChoose={() => onChoose(p)}
            busy={busy}
          />
        ))}
      </div>
    </>
  );
}

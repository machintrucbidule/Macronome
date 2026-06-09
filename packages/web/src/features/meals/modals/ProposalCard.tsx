import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { MealProposal, MealProposalItem } from '@macronome/shared';
import { Stars } from '../../../components/RatingStars/Stars';
import { Button } from '../../../components/Button/Button';
import { formatInt } from '../../../lib/format/number';
import styles from './modals.module.css';

// One AI meal proposal (mockup state 4, B-123 / Slice 10). Renders ONLY server-certified numbers
// (CLAUDE.md rule 2): the day total, per-axis fit and gaps come from `MealProposal`, never
// recomputed here. The "Raffiner" action (refine, Slice 11) opens the refine panel; the per-card
// "Choisir" (apply, Slice 12) action is still deferred.
interface Props {
  proposal: MealProposal;
  index: number;
  mealNames: Map<string, string>;
  hasCarbCeiling: boolean;
  onRefine: () => void;
}

type Tone = 'inband' | 'over' | 'under';
type FloorGap = { short_g: number };

/** Calorie colour from certified data only: met ⇒ in band; else the sign of the calorie gap. */
function calorieTone(p: MealProposal): Tone {
  if (p.targets_met.calorie) return 'inband';
  const cal = p.gaps.find((g) => g.target === 'calorie');
  if (cal && 'delta_kcal' in cal) return cal.delta_kcal > 0 ? 'over' : 'under';
  return 'inband';
}

/** Quantity strings: portioned → head ("×3" / "1 dose") + grams; portionless → grams only. */
function quantity(item: MealProposalItem): { head: string | null; grams: string } {
  const grams = `${formatInt(item.served_grams)} g`;
  if (item.unit === 'portion' && item.portion_label) {
    const head =
      item.served_quantity >= 2 ? `×${formatInt(item.served_quantity)}` : `1 ${item.portion_label}`;
    return { head, grams };
  }
  return { head: null, grams };
}

/** User-facing residual text for a gap — no internal rationale (decisions.md). */
function gapText(gap: MealProposal['gaps'][number], t: TFunction): string {
  if (gap.target === 'calorie') {
    return gap.delta_kcal > 0
      ? t('meals.proposals.gapCalorieOver', { n: formatInt(gap.delta_kcal) })
      : t('meals.proposals.gapCalorieUnder', { n: formatInt(-gap.delta_kcal) });
  }
  const macro = t(
    gap.target === 'protein_floor'
      ? 'meals.proposals.gapMacro.protein'
      : 'meals.proposals.gapMacro.fat',
  );
  return t('meals.proposals.gapFloor', { n: formatInt(gap.short_g), macro });
}

function Line({ item }: { item: MealProposalItem }) {
  const { t } = useTranslation();
  const q = quantity(item);
  return (
    <div className={styles.pline}>
      <span className={styles.pn}>
        {item.food_name}{' '}
        {item.rating === null ? (
          <span className={styles.unrated}>{t('meals.proposals.unrated')}</span>
        ) : (
          <Stars rating={item.rating} />
        )}
      </span>
      <span className={styles.pq}>
        {q.head && <span className={styles.port}>{q.head}</span>}
        {q.head ? ` · ${q.grams}` : q.grams}
      </span>
    </div>
  );
}

function MealGroups({
  proposal,
  mealNames,
}: {
  proposal: MealProposal;
  mealNames: Map<string, string>;
}) {
  return (
    <>
      {[...mealNames].map(([mealId, name]) => {
        const lines = proposal.items.filter((it) => it.meal_id === mealId);
        if (lines.length === 0) return null;
        return (
          <div key={mealId} className={styles.pgroup}>
            <div className={styles.gl}>{name}</div>
            {lines.map((it) => (
              <Line key={`${it.food_id}-${it.portion_id ?? 'g'}`} item={it} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function MacroChip({
  label,
  value,
  met,
  gap,
}: {
  label: string;
  value: number;
  met: boolean;
  gap: FloorGap | undefined;
}) {
  const { t } = useTranslation();
  if (met) {
    return (
      <span className={`${styles.chip} ${styles.chipOk}`}>
        {t('meals.proposals.macroMet', { label, n: formatInt(value) })}
      </span>
    );
  }
  return (
    <span className={`${styles.chip} ${styles.chipWarn}`}>
      {t('meals.proposals.macroShort', {
        label,
        n: formatInt(value),
        short: formatInt(gap?.short_g ?? 0),
      })}
    </span>
  );
}

function CarbChip({
  value,
  met,
  hasCeiling,
}: {
  value: number;
  met: boolean;
  hasCeiling: boolean;
}) {
  const { t } = useTranslation();
  const label = t('meals.proposals.macro.carb');
  const n = formatInt(value);
  const text = !hasCeiling
    ? t('meals.proposals.macroPlain', { label, n })
    : t(met ? 'meals.proposals.carbUnder' : 'meals.proposals.carbOver', { label, n });
  return <span className={`${styles.chip} ${styles.chipSoft}`}>{text}</span>;
}

function FitStrip({
  proposal,
  hasCarbCeiling,
}: {
  proposal: MealProposal;
  hasCarbCeiling: boolean;
}) {
  const { t } = useTranslation();
  const proteinGap = proposal.gaps.find((g) => g.target === 'protein_floor');
  const fatGap = proposal.gaps.find((g) => g.target === 'fat_floor');
  return (
    <div className={styles.fitstrip}>
      <div className={styles.fitK}>
        <span className={styles.kl}>{t('meals.proposals.dayTotal')}</span>
        <span className={`${styles.kv} ${styles[calorieTone(proposal)]}`}>
          {t('meals.proposals.dayTotalKcal', { n: formatInt(proposal.day_total.kcal) })}
        </span>
      </div>
      <div className={styles.chips}>
        <MacroChip
          label={t('meals.proposals.macro.protein')}
          value={proposal.day_total.protein}
          met={proposal.targets_met.protein}
          gap={proteinGap && 'short_g' in proteinGap ? proteinGap : undefined}
        />
        <MacroChip
          label={t('meals.proposals.macro.fat')}
          value={proposal.day_total.fat}
          met={proposal.targets_met.fat}
          gap={fatGap && 'short_g' in fatGap ? fatGap : undefined}
        />
        <CarbChip
          value={proposal.day_total.carb}
          met={proposal.targets_met.carb}
          hasCeiling={hasCarbCeiling}
        />
      </div>
    </div>
  );
}

export function ProposalCard({ proposal, index, mealNames, hasCarbCeiling, onRefine }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.prop} ${proposal.fit === 'closest' ? styles.closest : ''}`}>
      <div className={styles.ptitle}>
        {t('meals.proposals.proposalTitle', { n: index + 1 })}
        <span
          className={`${styles.flag} ${proposal.fit === 'full' ? styles.flagFit : styles.flagNear}`}
        >
          {t(proposal.fit === 'full' ? 'meals.proposals.fit.full' : 'meals.proposals.fit.closest')}
        </span>
      </div>
      <MealGroups proposal={proposal} mealNames={mealNames} />
      <FitStrip proposal={proposal} hasCarbCeiling={hasCarbCeiling} />
      {proposal.fit === 'closest' && proposal.gaps.length > 0 && (
        <div className={styles.closestNote}>
          {proposal.gaps.map((g) => gapText(g, t)).join(' · ')}
        </div>
      )}
      <div className={styles.pactions}>
        <Button variant="ghost" onClick={onRefine}>
          {t('meals.proposals.refineButton')}
        </Button>
      </div>
    </div>
  );
}

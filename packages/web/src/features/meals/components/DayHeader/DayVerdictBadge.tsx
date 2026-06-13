import { useTranslation } from 'react-i18next';
import type { Verdict } from '@macronome/shared';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useMeals } from '../../MealsContext';
import { VerdictBadge } from '../../../../components/VerdictBadge/VerdictBadge';

// The day's OK/NOK/Auto badge (B-064): moved out of the totals-row verdict cluster onto the
// header date line. Builds the menu labels and emits the override (null = revert to auto);
// the verdict itself is server-computed.
interface Props {
  effective: Verdict | null;
  auto: Verdict | null;
  override: Verdict | null;
  /** Day in a real deficit (`constat.deficit ≤ 0`); tints a NOK badge orange instead of red (B-166). */
  belowBurn?: boolean | null | undefined;
}

export function DayVerdictBadge({ effective, auto, override, belowBurn }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { actions } = useMeals();

  // The badge sits next to the comment field in the mobile day bar, so its `auto`/`forcé`
  // sub-label is abbreviated to its first letter (A / F) ≤560px to keep the row compact. The
  // menu labels are untouched. Desktop shows the full words.
  const sub = (full: string): string => (isMobile ? full.charAt(0) : full);
  const labels = {
    forceOk: t('meals.verdict.forceOk'),
    forceNok: t('meals.verdict.forceNok'),
    autoCalc: (a: Verdict | null) =>
      a ? t('meals.verdict.autoCalcWith', { v: a }) : t('meals.verdict.autoCalc'),
    auto: sub(t('meals.verdict.auto')),
    forced: sub(t('meals.verdict.forced')),
  };

  return (
    <VerdictBadge
      effective={effective}
      auto={auto}
      override={override}
      labels={labels}
      onSet={(v) => void actions.setVerdict(v)}
      belowBurn={belowBurn}
    />
  );
}

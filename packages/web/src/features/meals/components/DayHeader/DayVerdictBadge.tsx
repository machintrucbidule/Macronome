import { useTranslation } from 'react-i18next';
import type { Verdict } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { VerdictBadge } from '../../../../components/VerdictBadge/VerdictBadge';

// The day's OK/NOK/Auto badge (B-064): moved out of the totals-row verdict cluster onto the
// header date line. Builds the menu labels and emits the override (null = revert to auto);
// the verdict itself is server-computed.
interface Props {
  effective: Verdict | null;
  auto: Verdict | null;
  override: Verdict | null;
}

export function DayVerdictBadge({ effective, auto, override }: Props) {
  const { t } = useTranslation();
  const { actions } = useMeals();

  const labels = {
    forceOk: t('meals.verdict.forceOk'),
    forceNok: t('meals.verdict.forceNok'),
    autoCalc: (a: Verdict | null) =>
      a ? t('meals.verdict.autoCalcWith', { v: a }) : t('meals.verdict.autoCalc'),
    auto: t('meals.verdict.auto'),
    forced: t('meals.verdict.forced'),
  };

  return (
    <VerdictBadge
      effective={effective}
      auto={auto}
      override={override}
      labels={labels}
      onSet={(v) => void actions.setVerdict(v)}
    />
  );
}

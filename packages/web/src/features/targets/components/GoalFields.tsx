import { useTranslation } from 'react-i18next';
import type { EngineReadout } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { DerivedField } from './DerivedField';
import { bmi1 } from '../format';
import type { TargetDraft } from '../draft';
import styles from '../cibles.module.css';

// "Objectif de poids" group of the manual-targets form: target weight + desired rate
// (both optional) and the derived target BMI read-out (server-computed, null without a
// target weight). Split out of TargetFields for modularity.
interface GoalFieldsProps {
  draft: TargetDraft;
  set: (patch: Partial<TargetDraft>) => void;
  engine: EngineReadout;
}

/** Field label suffixed with the "(optional)" hint. */
function OptionalLabel({ textKey }: { textKey: string }) {
  const { t } = useTranslation();
  return (
    <>
      {t(textKey)} <span className="hint">{t('common.optional')}</span>
    </>
  );
}

export function GoalFields({ draft, set, engine }: GoalFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.group} ${styles.groupSep}`}>
      <div className={styles.groupTitle}>{t('cibles.targets.goal')}</div>
      <div className={styles.grid2}>
        <NumberInput
          label={<OptionalLabel textKey="cibles.targets.targetWeight" />}
          suffix="kg"
          wrapperClassName={styles.inpW}
          min={0}
          step={0.1}
          value={draft.targetWeightKg}
          onChange={(e) => set({ targetWeightKg: e.target.value })}
        />
        <NumberInput
          label={<OptionalLabel textKey="cibles.targets.rate" />}
          suffix="kg/s"
          wrapperClassName={styles.inpW}
          min={0}
          step={0.01}
          value={draft.rateKgPerWeek}
          onChange={(e) => set({ rateKgPerWeek: e.target.value })}
        />
      </div>
      <DerivedField
        label={t('cibles.targets.targetBmi')}
        value={engine.target_bmi === null ? '—' : bmi1(engine.target_bmi)}
      />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { EngineReadout } from '@macronome/shared';
import { kcal, rate2 } from '../format';
import styles from '../targets.module.css';

// "Dépense & déficit" visual (targets mockup .defbar-wrap + .synth): a horizontal bar
// comparing the target-calorie midpoint (intake) against the estimated burn, a legend, and
// a one-paragraph synthesis. Every figure is server-computed (EngineReadout); the web only
// positions the bar (pure layout) and rounds for display — it computes no nutrition figure.
// The target midpoint is reconstructed from server outputs (burn + deficit_at_target). The
// optional "suggérer une cible" action lives elsewhere (SuggestDialog), not here.
interface DeficitBarProps {
  engine: EngineReadout;
}

export function DeficitBar({ engine }: DeficitBarProps) {
  const { t } = useTranslation();
  const burn = engine.estimated_burn;
  const deficit = engine.deficit_at_target;
  if (burn === null || deficit === null) return null;

  const intake = burn + deficit; // target midpoint = burn + (deficit at target)
  const max = Math.max(burn, intake, 1);
  const kgWeek = engine.kg_per_week;
  const kg = (n: number): string => (kgWeek === null ? '—' : rate2(Math.abs(n)));

  const synth =
    deficit < 0
      ? t('targets.deficit.synthDeficit', {
          intake: kcal(intake),
          burn: kcal(burn),
          deficit: kcal(Math.abs(deficit)),
          kg: kg(kgWeek ?? 0),
        })
      : deficit > 0
        ? t('targets.deficit.synthSurplus', {
            intake: kcal(intake),
            burn: kcal(burn),
            surplus: kcal(deficit),
            kg: kg(kgWeek ?? 0),
          })
        : t('targets.deficit.synthBalance');

  return (
    <>
      <div className={styles.defbarWrap}>
        <div className={styles.defbarHead}>
          <span>{t('targets.deficit.intakeLabel')}</span>
          <span>{t('targets.deficit.burnLabel')}</span>
        </div>
        <div className={styles.defbar}>
          <div className={styles.defbarBurn} style={{ width: `${(burn / max) * 100}%` }}>
            <span className={styles.defbarBurnLbl}>
              {t('targets.deficit.kcal', { value: kcal(burn) })}
            </span>
          </div>
          <div className={styles.defbarIntake} style={{ width: `${(intake / max) * 100}%` }}>
            <span className={styles.defbarIntakeLbl}>
              {t('targets.deficit.kcal', { value: kcal(intake) })}
            </span>
          </div>
        </div>
        <div className={styles.deflegend}>
          <span>
            <i className={styles.swIntake} />
            {t('targets.deficit.intakeLabel')}
          </span>
          <span>
            <i className={styles.swBurn} />
            {t('targets.deficit.burnLabel')}
          </span>
        </div>
      </div>
      <div className={styles.synth}>
        <p>{synth}</p>
      </div>
    </>
  );
}

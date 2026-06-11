import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityLevel, Period } from '@macronome/shared';
import { Modal } from '../../../components/Modal/Modal';
import { DASH, bmi1, kcal0, kg1, mult2, orDash, signed1, signedKcal0 } from '../format';
import { activityLevelFromMultiplier, signTone, type Tone } from '../period-style';
import wstyles from '../weight.module.css';
import styles from '../weight-mobile.module.css';

// Read-only detail sheet for one period (mobile-responsive S8, mockups/04-weight.html): the
// phone replacement for the desktop row's 15 columns, grouped Poids / Énergie / Contexte (none
// dropped). Every figure is server-derived; this only formats + picks a tone/level class
// (reusing format.ts + period-style.ts + the weight.module.css tint classes). "Modifier la
// pesée" opens the weigh-in modal (resolved by the parent to this period's ending
// weigh-in). Rendered as a bottom sheet on mobile.

// avg_activity PAL multiplier → nearest level → palette class (mirrors PeriodRow).
const LEVEL_CLASS: Record<ActivityLevel, string | undefined> = {
  sedentary: wstyles.sedentary,
  lightly_active: wstyles.lightly,
  moderately_active: wstyles.moderate,
  very_active: wstyles.veryActive,
  extremely_active: wstyles.extreme,
};

const toneClass = (tone: Tone): string =>
  (tone === 'pos' ? wstyles.pos : tone === 'neg' ? wstyles.neg : '') ?? '';

// A nullable figure formatted with an optional unit suffix, em dash when absent.
const withUnit = (n: number | null, fmt: (v: number) => string, unit?: string): string =>
  n === null ? DASH : unit ? `${fmt(n)} ${unit}` : fmt(n);

function Cell({
  label,
  children,
  tone,
  full,
}: {
  label: string;
  children: ReactNode;
  tone?: Tone;
  full?: boolean;
}) {
  return (
    <div className={full ? styles.cellFull : styles.cell}>
      <div className={styles.cellKey}>{label}</div>
      <div className={`${styles.cellVal} ${tone ? toneClass(tone) : ''}`}>{children}</div>
    </div>
  );
}

interface PeriodDetailSheetProps {
  period: Period;
  onClose: () => void;
  onEdit: () => void;
}

export function PeriodDetailSheet({ period, onClose, onEdit }: PeriodDetailSheetProps) {
  const { t } = useTranslation();
  const p = period;
  const title = `${p.start_date} → ${p.end_date}`;
  return (
    <Modal title={title} onClose={onClose}>
      <div className={styles.sheet}>
        <div className={styles.grid}>
          <div className={styles.sect}>{t('weight.detail.sectWeight')}</div>
          <Cell label={t('weight.col.weight')}>{withUnit(p.weight_end, kg1, 'kg')}</Cell>
          <Cell label={t('weight.col.trend')}>{withUnit(p.ema, kg1, 'kg')}</Cell>
          <Cell label={t('weight.col.delta')} tone={signTone(p.delta)}>
            {`${signed1(p.delta)} kg`}
          </Cell>
          <Cell
            label={t('weight.col.ecart')}
            tone={p.ecart_trajectoire === null ? null : signTone(p.ecart_trajectoire)}
          >
            {withUnit(p.ecart_trajectoire, signed1, 'kg')}
          </Cell>
          <Cell label={t('weight.col.bmi')}>{orDash(p.bmi, bmi1)}</Cell>
          <Cell label={t('weight.col.waist')}>{withUnit(p.waist, kg1, 'cm')}</Cell>

          <div className={styles.sect}>{t('weight.detail.sectEnergy')}</div>
          <Cell label={t('weight.col.intake')}>{withUnit(p.avg_intake, kcal0, 'kcal')}</Cell>
          <Cell label={t('weight.col.estBurn')}>{withUnit(p.estimated_burn, kcal0, 'kcal')}</Cell>
          <Cell label={t('weight.col.empBurn')}>{withUnit(p.empirical_burn, kcal0, 'kcal')}</Cell>
          <Cell
            label={t('weight.col.deficit')}
            tone={p.deficit_per_day === null ? null : signTone(p.deficit_per_day)}
          >
            {withUnit(p.deficit_per_day, signedKcal0, 'kcal')}
          </Cell>

          <div className={styles.sect}>{t('weight.detail.sectContext')}</div>
          <Cell label={t('weight.col.days')}>
            {t('weight.detail.daysShort', { count: p.days })}
          </Cell>
          <Cell label={t('weight.col.activity')}>
            {p.avg_activity === null ? (
              DASH
            ) : (
              <span
                className={`${wstyles.actTint} ${LEVEL_CLASS[activityLevelFromMultiplier(p.avg_activity)]}`}
              >
                {mult2(p.avg_activity)}
              </span>
            )}
          </Cell>
          <Cell label={t('weight.col.flag')}>
            <span className={p.diet_flag === 'in_diet' ? wstyles.flagDiet : wstyles.flagMaint}>
              {t(`weight.flag.${p.diet_flag}`)}
            </span>
          </Cell>
          <div className={styles.cellFull}>
            <div className={styles.cellKey}>{t('weight.col.note')}</div>
            <div className={styles.cellNote}>{p.note ?? DASH}</div>
          </div>
        </div>

        <button type="button" className={styles.editBtn} onClick={onEdit}>
          {t('weight.detail.edit')}
        </button>
      </div>
    </Modal>
  );
}

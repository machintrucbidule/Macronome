import { useTranslation } from 'react-i18next';
import type { Macros, RecipePreview } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { gramsDisplay, kcalDisplay } from '../format';
import styles from '../recipes.module.css';

// "Rendement & portions" panel (specifications/screens/recipe.md): editable batch weight,
// servings stepper, and a LIVE readout of total / per-100 g / per-portion figures. Per
// CLAUDE.md rule 2 the web never computes nutrition figures — they are read from the
// stateless preview endpoint (B-035) and refresh as ingredients/batch/servings change.
// `—` until the first line is ready to compute.
interface YieldPanelProps {
  servings: string;
  batch: string;
  preview: RecipePreview | undefined;
  onServings: (v: string) => void;
  onBatch: (v: string) => void;
}

const DASH = '—';

export function YieldPanel({ servings, batch, preview, onServings, onBatch }: YieldPanelProps) {
  const { t } = useTranslation();
  const n = Math.max(1, Math.round(Number(servings) || 1));
  const g = (v: number | undefined): string => (v === undefined ? DASH : gramsDisplay(v));
  const k = (v: number | undefined): string => (v === undefined ? DASH : kcalDisplay(v));
  const macros = (m: Pick<Macros, 'fat' | 'carb' | 'protein'> | undefined) => (
    <div className={styles.ppMacros}>
      <span>L {g(m?.fat)}</span>
      <span>G {g(m?.carb)}</span>
      <span>P {g(m?.protein)}</span>
    </div>
  );

  return (
    <div className={styles.yield}>
      <h4>{t('recipes.builder.yieldTitle')}</h4>

      <NumberInput
        label={t('recipes.builder.batch')}
        suffix="g"
        min={0}
        value={batch}
        placeholder={preview ? gramsDisplay(preview.total_ingredient_grams) : undefined}
        onChange={(e) => onBatch(e.target.value)}
      />
      <button type="button" className={styles.resetLink} onClick={() => onBatch('')}>
        {t('recipes.builder.resetBatch')}
      </button>

      <div className={styles.servings}>
        <span className={styles.servingsLabel}>{t('recipes.builder.servings')}</span>
        <div className={styles.stepper}>
          <button type="button" onClick={() => onServings(String(Math.max(1, n - 1)))}>
            −
          </button>
          <span className="num">{n}</span>
          <button type="button" onClick={() => onServings(String(n + 1))}>
            +
          </button>
        </div>
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionTotal')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.totalWeight')}</span>
          <span className="num">{g(preview?.total_ingredient_grams)} g</span>
        </div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcal')}</span>
          <span className="num">{k(preview?.total_macros.kcal)}</span>
        </div>
        {macros(preview?.total_macros)}
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionPer100')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcal')}</span>
          <span className="num">{k(preview?.kcal_per_100g)}</span>
        </div>
        {macros(
          preview
            ? {
                fat: preview.fat_per_100g,
                carb: preview.carb_per_100g,
                protein: preview.protein_per_100g,
              }
            : undefined,
        )}
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionPerPortion')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.weightPerPortion')}</span>
          <span className="num">{g(preview?.weight_per_portion_g)} g</span>
        </div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcalPerPortion')}</span>
          <span className="num">{k(preview?.per_portion.kcal)}</span>
        </div>
        {macros(preview?.per_portion)}
      </div>

      <div className={styles.ppNote}>{t('recipes.builder.computedNote')}</div>
    </div>
  );
}

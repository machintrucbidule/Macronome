import { useTranslation } from 'react-i18next';
import type { RecipeFull } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { gramsDisplay, kcalDisplay } from '../format';
import styles from '../recipes.module.css';

// "Rendement & portions" panel (specifications/screens/recipe.md): editable batch weight,
// servings stepper, and per-portion readout. Per-portion / per-100 g values are read from
// the server (CLAUDE.md rule 2) and refresh on save; for a new recipe they show — until the
// first save. Live-while-typing recompute is deferred to M9 (like the Cibles tiles).
interface YieldPanelProps {
  servings: string;
  batch: string;
  derived: RecipeFull | null;
  onServings: (v: string) => void;
  onBatch: (v: string) => void;
}

export function YieldPanel({ servings, batch, derived, onServings, onBatch }: YieldPanelProps) {
  const { t } = useTranslation();
  const n = Math.max(1, Math.round(Number(servings) || 1));
  const cell = (value: string | null | undefined): string => value ?? '—';

  return (
    <div className={styles.yield}>
      <h4>{t('recipes.builder.yieldTitle')}</h4>

      <NumberInput
        label={t('recipes.builder.batch')}
        suffix="g"
        min={0}
        value={batch}
        placeholder={derived ? gramsDisplay(derived.total_ingredient_grams) : undefined}
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
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.weightPerPortion')}</span>
          <span className="num">
            {cell(derived && gramsDisplay(derived.weight_per_portion_g))} g
          </span>
        </div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcalPerPortion')}</span>
          <span className="num">{cell(derived && kcalDisplay(derived.per_portion.kcal))}</span>
        </div>
        <div className={styles.ppMacros}>
          <span>L {cell(derived && gramsDisplay(derived.per_portion.fat))}</span>
          <span>G {cell(derived && gramsDisplay(derived.per_portion.carb))}</span>
          <span>P {cell(derived && gramsDisplay(derived.per_portion.protein))}</span>
        </div>
        <div className={styles.ppNote}>{t('recipes.builder.computedNote')}</div>
      </div>
    </div>
  );
}

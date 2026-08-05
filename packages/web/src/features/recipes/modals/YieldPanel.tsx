import { useTranslation } from 'react-i18next';
import type { Macros, RecipePreview } from '@macronome/shared';
import { NumberInput } from '../../../components/Form/NumberInput';
import { gramsDisplay, kcalDisplay } from '../format';
import styles from '../recipes.module.css';

// "Rendement & portions" panel (specifications/screens/recipe.md): batch weight governed
// by the persisted "Poids auto" toggle (RW-1 — auto ⇒ greyed field tracking the live
// ingredient sum; manual ⇒ editable cooked weight, seeded with the value displayed when
// switching), servings stepper, and a LIVE readout of total / per-100 g / per-portion
// figures. Per CLAUDE.md rule 2 the web never computes nutrition figures — they are read
// from the stateless preview endpoint (B-035) and refresh as ingredients/batch/servings
// change. `—` until the first line is ready to compute.
interface YieldPanelProps {
  servings: string;
  batch: string;
  batchAuto: boolean;
  preview: RecipePreview | undefined;
  onServings: (v: string) => void;
  onBatch: (v: string) => void;
  onBatchAuto: (auto: boolean) => void;
}

const DASH = '—';
const grams = (v: number | undefined): string => (v === undefined ? DASH : gramsDisplay(v));
const kcal = (v: number | undefined): string => (v === undefined ? DASH : kcalDisplay(v));

// B-052: render each macro as a readable labelled block (per the recipe mockup) instead of
// a cramped "L 15 G 63.9 P 479.9" line.
function MacroBlocks({ m }: { m: Pick<Macros, 'fat' | 'carb' | 'protein'> | undefined }) {
  const { t } = useTranslation();
  return (
    <div className={styles.ppMacros}>
      <div className={styles.ppMacro}>
        <span className={styles.num}>{grams(m?.fat)}</span>
        <span className={styles.ppMacroLabel}>{t('recipes.builder.macroFat')}</span>
      </div>
      <div className={styles.ppMacro}>
        <span className={styles.num}>{grams(m?.carb)}</span>
        <span className={styles.ppMacroLabel}>{t('recipes.builder.macroCarb')}</span>
      </div>
      <div className={styles.ppMacro}>
        <span className={styles.num}>{grams(m?.protein)}</span>
        <span className={styles.ppMacroLabel}>{t('recipes.builder.macroProtein')}</span>
      </div>
    </div>
  );
}

// Batch weight field + "Poids auto" toggle (RW-1): auto ⇒ disabled field mirroring the
// live ingredient sum; manual ⇒ editable, seeded with the value displayed at the switch.
function BatchWeightControl({
  batch,
  batchAuto,
  preview,
  onBatch,
  onBatchAuto,
}: Omit<YieldPanelProps, 'servings' | 'onServings'>) {
  const { t } = useTranslation();
  const displayedBatch = batchAuto
    ? preview
      ? gramsDisplay(preview.total_ingredient_grams)
      : ''
    : batch;
  const toManual = (): void => {
    if (!batchAuto) return;
    onBatch(displayedBatch); // seed the manual field with the value displayed at the switch
    onBatchAuto(false);
  };

  return (
    <>
      <NumberInput
        label={t('recipes.builder.batch')}
        suffix="g"
        min={0}
        value={displayedBatch}
        disabled={batchAuto}
        wrapperClassName={batchAuto ? styles.batchLocked : undefined}
        onChange={(e) => {
          if (!batchAuto) onBatch(e.target.value);
        }}
      />
      <div className={styles.batchAutoRow}>
        <span className={styles.batchAutoLabel}>{t('recipes.builder.batchAuto')}</span>
        <div className={styles.batchSeg}>
          <button type="button" aria-pressed={batchAuto} onClick={() => onBatchAuto(true)}>
            {t('recipes.builder.batchAutoOn')}
          </button>
          <button type="button" aria-pressed={!batchAuto} onClick={toManual}>
            {t('recipes.builder.batchAutoOff')}
          </button>
        </div>
      </div>
    </>
  );
}

export function YieldPanel({
  servings,
  batch,
  batchAuto,
  preview,
  onServings,
  onBatch,
  onBatchAuto,
}: YieldPanelProps) {
  const { t } = useTranslation();
  const n = Math.max(1, Math.round(Number(servings) || 1));
  const per100 = preview
    ? { fat: preview.fat_per_100g, carb: preview.carb_per_100g, protein: preview.protein_per_100g }
    : undefined;

  return (
    <div className={styles.yield}>
      <h4>{t('recipes.builder.yieldTitle')}</h4>

      <BatchWeightControl
        batch={batch}
        batchAuto={batchAuto}
        preview={preview}
        onBatch={onBatch}
        onBatchAuto={onBatchAuto}
      />

      <div className={styles.servings}>
        <span className={styles.servingsLabel}>{t('recipes.builder.servings')}</span>
        <div className={styles.stepper}>
          <button type="button" onClick={() => onServings(String(Math.max(1, n - 1)))}>
            −
          </button>
          <span className={styles.num}>{n}</span>
          <button type="button" onClick={() => onServings(String(n + 1))}>
            +
          </button>
        </div>
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionTotal')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.totalWeight')}</span>
          <span className={styles.num}>{grams(preview?.total_ingredient_grams)} g</span>
        </div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcal')}</span>
          <span className={styles.num}>{kcal(preview?.total_macros.kcal)}</span>
        </div>
        <MacroBlocks m={preview?.total_macros} />
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionPer100')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcal')}</span>
          <span className={styles.num}>{kcal(preview?.kcal_per_100g)}</span>
        </div>
        <MacroBlocks m={per100} />
      </div>

      <div className={styles.perPortion}>
        <div className={styles.ppHead}>{t('recipes.builder.sectionPerPortion')}</div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.weightPerPortion')}</span>
          <span className={styles.num}>{grams(preview?.weight_per_portion_g)} g</span>
        </div>
        <div className={styles.ppRow}>
          <span>{t('recipes.builder.kcalPerPortion')}</span>
          <span className={styles.num}>{kcal(preview?.per_portion.kcal)}</span>
        </div>
        <MacroBlocks m={preview?.per_portion} />
      </div>
    </div>
  );
}

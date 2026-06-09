import { useTranslation } from 'react-i18next';
import type { RecipeFull, RecipePreview } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { TextInput } from '../../../components/Form/TextInput';
import { RatingSelect } from '../../../components/RatingStars/RatingSelect';
import { IngredientBlock } from './IngredientBlock';
import { YieldPanel } from './YieldPanel';
import type { RecipeDraft } from './draft';
import styles from '../recipes.module.css';

// Body fields of the recipe builder (split out for modularity; the modal shell owns the
// header/actions). Pure presentational over the draft + a setter. Derived figures come
// from `full` (server); a save error surfaces as a banner.
interface BuilderFieldsProps {
  draft: RecipeDraft;
  full: RecipeFull | null;
  preview: RecipePreview | undefined;
  error: string | null;
  set: (patch: Partial<RecipeDraft>) => void;
}

export function BuilderFields({ draft, full, preview, error, set }: BuilderFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.nameRow}>
        <TextInput
          label={t('recipes.field.name')}
          value={draft.name}
          placeholder={t('recipes.field.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div>
          <div className="hint" style={{ marginBottom: 6 }}>
            {t('recipes.field.rating')}
          </div>
          <RatingSelect
            value={draft.rating}
            onChange={(rating) => set({ rating })}
            ariaLabel={t('recipes.field.rating')}
          />
        </div>
      </div>
      {error && (
        <Banner tone="warning">
          {error === 'would_create_cycle'
            ? t('recipes.builder.cycleError')
            : t('recipes.builder.saveError', { code: error })}
        </Banner>
      )}
      <div className={styles.builderGrid}>
        <IngredientBlock
          ingredients={draft.ingredients}
          disabledFoodId={full?.derived_food_id ?? null}
          onChange={(ingredients) => set({ ingredients })}
        />
        <YieldPanel
          servings={draft.servings}
          batch={draft.batch}
          batchAuto={draft.batchAuto}
          preview={preview}
          onServings={(servings) => set({ servings })}
          onBatch={(batch) => set({ batch })}
          onBatchAuto={(batchAuto) => set({ batchAuto })}
        />
      </div>
      <label className={styles.instructions}>
        <span>{t('recipes.field.instructions')}</span>
        <textarea
          value={draft.instructions}
          placeholder={t('recipes.field.instructionsPlaceholder')}
          onChange={(e) => set({ instructions: e.target.value })}
        />
      </label>
    </>
  );
}

import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import { NumberInput } from '../../../components/Form/NumberInput';
import { RatingPicker } from '../../../components/RatingStars/RatingPicker';
import { NamedPortionsEditor } from './NamedPortionsEditor';
import type { Draft } from './draft';
import styles from '../foods.module.css';

// Body fields of the food add/edit modal (split out for modularity; the modal shell
// owns the header/actions). Pure presentational over the draft + a setter.
interface FoodModalFieldsProps {
  draft: Draft;
  isEdit: boolean;
  showDup: boolean;
  set: (patch: Partial<Draft>) => void;
}

export function FoodModalFields({ draft, isEdit, showDup, set }: FoodModalFieldsProps) {
  const { t } = useTranslation();
  const macro = (label: string, key: 'kcal' | 'fat' | 'carb' | 'protein', suffix: string) => (
    <NumberInput
      label={
        <>
          {label} <span className="hint">/100g</span>
        </>
      }
      suffix={suffix}
      min={0}
      value={draft[key]}
      onChange={(e) => set({ [key]: e.target.value })}
    />
  );

  return (
    <>
      <div>
        <TextInput
          label={t('foods.field.name')}
          value={draft.name}
          placeholder={t('foods.field.namePlaceholder')}
          onChange={(e) => set({ name: e.target.value })}
          invalid={showDup}
        />
        {showDup && <div className={styles.dupwarn}>⚠ {t('foods.modal.duplicate')}</div>}
      </div>

      <div className={styles.grid4}>
        {macro(t('foods.field.kcal'), 'kcal', 'kcal')}
        {macro(t('foods.field.fat'), 'fat', 'g')}
        {macro(t('foods.field.carb'), 'carb', 'g')}
        {macro(t('foods.field.protein'), 'protein', 'g')}
      </div>

      <NamedPortionsEditor portions={draft.portions} onChange={(portions) => set({ portions })} />

      <div className={styles.grid2}>
        <div>
          <div className="hint" style={{ marginBottom: 6 }}>
            {t('foods.field.rating')}
          </div>
          <RatingPicker value={draft.rating} onChange={(rating) => set({ rating })} />
        </div>
        <div>
          <div className="hint" style={{ marginBottom: 6 }}>
            {t('foods.field.visibility')}
          </div>
          <div className={styles.visseg}>
            <button
              type="button"
              aria-pressed={draft.visibility === 'private'}
              onClick={() => set({ visibility: 'private' })}
            >
              {t('foods.visibility.private')}
            </button>
            <button
              type="button"
              aria-pressed={draft.visibility === 'shared'}
              onClick={() => set({ visibility: 'shared' })}
            >
              {t('foods.visibility.shared')}
            </button>
          </div>
        </div>
      </div>

      <TextInput
        label={
          <>
            {t('foods.field.comment')} <span className="hint">{t('common.optional')}</span>
          </>
        }
        value={draft.comment}
        onChange={(e) => set({ comment: e.target.value })}
      />

      {isEdit && <div className={styles.editnote}>{t('foods.modal.editNote')}</div>}
    </>
  );
}

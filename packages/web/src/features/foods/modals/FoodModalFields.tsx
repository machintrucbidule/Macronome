import { useTranslation } from 'react-i18next';
import type { FoodParseWarning } from '@macronome/shared';
import { TextInput } from '../../../components/Form/TextInput';
import { RatingPicker } from '../../../components/RatingStars/RatingPicker';
import { NamedPortionsEditor } from './NamedPortionsEditor';
import { MacroInputs } from './MacroInputs';
import type { Draft } from './draft';
import styles from '../foods.module.css';

// Body fields of the food add/edit modal (split out for modularity; the modal shell
// owns the header/actions). Pure presentational over the draft + a setter.
interface FoodModalFieldsProps {
  draft: Draft;
  isEdit: boolean;
  showDup: boolean;
  set: (patch: Partial<Draft>) => void;
  parseWarnings: FoodParseWarning[];
  onParse: () => void;
}

export function FoodModalFields({
  draft,
  isEdit,
  showDup,
  set,
  parseWarnings,
  onParse,
}: FoodModalFieldsProps) {
  const { t } = useTranslation();

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

      <MacroInputs draft={draft} set={set} parseWarnings={parseWarnings} onParse={onParse} />

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

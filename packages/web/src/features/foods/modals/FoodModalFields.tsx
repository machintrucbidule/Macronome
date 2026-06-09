import { useTranslation } from 'react-i18next';
import type { FoodParseWarning } from '@macronome/shared';
import { TextInput } from '../../../components/Form/TextInput';
import { RatingSelect } from '../../../components/RatingStars/RatingSelect';
import { NamedPortionsEditor } from './NamedPortionsEditor';
import { MacroInputs } from './MacroInputs';
import { Segmented } from './Segmented';
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

      <div className={styles.grid3}>
        <div>
          <div className="hint" style={{ marginBottom: 6 }}>
            {t('foods.field.rating')}
          </div>
          <RatingSelect
            value={draft.rating}
            onChange={(rating) => set({ rating })}
            ariaLabel={t('foods.field.rating')}
          />
        </div>
        <Segmented
          label={t('foods.field.visibility')}
          value={draft.visibility}
          options={[
            { value: 'private', label: t('foods.visibility.private') },
            { value: 'shared', label: t('foods.visibility.shared') },
          ]}
          onChange={(visibility) => set({ visibility })}
        />
        <Segmented
          label={t('foods.field.aiProposable')}
          value={draft.aiProposable}
          options={[
            { value: true, label: t('common.yes') },
            { value: false, label: t('common.no') },
          ]}
          onChange={(aiProposable) => set({ aiProposable })}
        />
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

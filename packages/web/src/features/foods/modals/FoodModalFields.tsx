import { useTranslation } from 'react-i18next';
import type { FoodParseWarning, FoodSource } from '@macronome/shared';
import { TextInput } from '../../../components/Form/TextInput';
import { RatingSelect } from '../../../components/RatingStars/RatingSelect';
import { NamedPortionsEditor } from './NamedPortionsEditor';
import { MacroInputs } from './MacroInputs';
import { ChronoSearchLink } from './ChronoSearchLink';
import { Segmented } from './Segmented';
import { useSourceOptions } from './useSourceOptions';
import type { Draft } from './draft';
import styles from '../foods.module.css';

// Body fields of the food add/edit modal (split out for modularity; the modal shell
// owns the header/actions). Pure presentational over the draft + a setter.
interface FoodModalFieldsProps {
  draft: Draft;
  /** Provenances present in the catalog — gates the Chronodrive option (B-295). */
  presentSources: FoodSource[];
  isEdit: boolean;
  showDup: boolean;
  set: (patch: Partial<Draft>) => void;
  parseWarnings: FoodParseWarning[];
  onParse: () => void;
  /** Macro keys left empty by a Chronodrive pre-fill (B-182) — drives the notice. */
  chronoMissing: string[];
  onChrono: () => void;
}

export function FoodModalFields({
  draft,
  presentSources,
  isEdit,
  showDup,
  set,
  parseWarnings,
  onParse,
  chronoMissing,
  onChrono,
}: FoodModalFieldsProps) {
  const { t } = useTranslation();
  const sourceOptions = useSourceOptions(presentSources, draft.source);

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
        <ChronoSearchLink onOpen={onChrono} />
      </div>

      <MacroInputs draft={draft} set={set} parseWarnings={parseWarnings} onParse={onParse} />
      {chronoMissing.length > 0 && (
        <div className={styles.parsenote}>ⓘ {t('foods.chrono.incomplete')}</div>
      )}

      <NamedPortionsEditor portions={draft.portions} onChange={(portions) => set({ portions })} />

      <div className={styles.grid4}>
        <div>
          <div className={styles.segLabel}>{t('foods.field.rating')}</div>
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
        {/* Provenance (B-295): stamped automatically by the Chronodrive prefill, but always
            correctable by hand — an edit never moves it on its own. */}
        <Segmented
          label={t('foods.field.source')}
          value={draft.source}
          options={sourceOptions}
          onChange={(source) => set({ source })}
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
            {t('foods.field.comment')} <span className={styles.hint}>{t('common.optional')}</span>
          </>
        }
        value={draft.comment}
        onChange={(e) => set({ comment: e.target.value })}
      />

      {isEdit && <div className={styles.editnote}>{t('foods.modal.editNote')}</div>}
    </>
  );
}

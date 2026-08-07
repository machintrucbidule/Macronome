import { useTranslation } from 'react-i18next';
import type { FoodSource } from '@macronome/shared';
import { TextInput } from '../../../components/Form/TextInput';
import { BulkRatingSelect } from '../../../components/BulkEdit';
import { Segmented } from './Segmented';
import { useSourceOptions } from './useSourceOptions';
import { KEEP, type FoodBulkDraft } from './bulk-draft';
import styles from '../foods.module.css';

// The five controls of the Aliments batch popup (BE-1/D15). Each is the single-food control with
// one extra state in front: **« Ne pas modifier »**, the default, which is what keeps a field out
// of the request entirely. Split from the modal shell so both stay well inside the file cap.

interface Props {
  draft: FoodBulkDraft;
  presentSources: FoodSource[];
  set: (patch: Partial<FoodBulkDraft>) => void;
}

export function FoodBulkFields({ draft, presentSources, set }: Props) {
  const { t } = useTranslation();
  // Typed on the literal, not widened to `string`, so each Segmented below still infers its own
  // narrow value union rather than falling back to `string`.
  const keep: { value: typeof KEEP; label: string } = { value: KEEP, label: t('bulk.keep') };
  // The single-food source options, minus the "current value" hint they carry (there is no single
  // current value here), with « Ne pas modifier » in front.
  const sourceOptions = [keep, ...useSourceOptions(presentSources, 'manual')];

  return (
    <>
      <div>
        <div className={styles.segLabel}>{t('foods.field.rating')}</div>
        <BulkRatingSelect
          value={draft.rating}
          onChange={(rating) => set({ rating })}
          ariaLabel={t('foods.field.rating')}
        />
      </div>

      <Segmented
        label={t('foods.field.visibility')}
        value={draft.visibility}
        options={[
          keep,
          { value: 'private' as const, label: t('foods.visibility.private') },
          { value: 'shared' as const, label: t('foods.visibility.shared') },
        ]}
        onChange={(visibility) => set({ visibility })}
      />

      <Segmented
        label={t('foods.field.aiProposable')}
        value={draft.aiProposable}
        options={[
          keep,
          { value: 'yes' as const, label: t('common.yes') },
          { value: 'no' as const, label: t('common.no') },
        ]}
        onChange={(aiProposable) => set({ aiProposable })}
      />

      <Segmented
        label={t('foods.field.source')}
        value={draft.source}
        options={sourceOptions}
        onChange={(source) => set({ source })}
      />

      <Segmented
        label={t('foods.field.comment')}
        value={draft.comment}
        options={[
          keep,
          { value: 'set' as const, label: t('bulk.comment.replace') },
          { value: 'clear' as const, label: t('bulk.comment.clear') },
        ]}
        onChange={(comment) => set({ comment })}
      />
      {draft.comment === 'set' && (
        <TextInput
          aria-label={t('bulk.comment.replace')}
          value={draft.commentText}
          onChange={(e) => set({ commentText: e.target.value })}
        />
      )}
    </>
  );
}

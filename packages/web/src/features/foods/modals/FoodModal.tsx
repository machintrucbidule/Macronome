import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChronoFoodPrefill, Food, FoodParseLabel, FoodParseWarning } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { FoodModalFields } from './FoodModalFields';
import { ParseLabelDialog } from './ParseLabelDialog';
import { ChronoSearchDialog } from './ChronoSearchDialog';
import { chronoPatch, draftToBody, initialDraft, parsedPatch, type Draft } from './draft';
import { useFoodMutations } from '../useFoods';

// Food add/edit modal shell (specifications/screens/food-db.md, modals.md). Editing
// macros affects future logs only (server freezes history). The duplicate-name hint
// is a live client heuristic; the server returns the authoritative `duplicate_name`
// warning on save (non-blocking). The body fields live in FoodModalFields.
interface FoodModalProps {
  food: Food | null;
  isDuplicate: (name: string) => boolean;
  onClose: () => void;
  onArchive: (food: Food) => void;
}

export function FoodModal({ food, isDuplicate, onClose, onArchive }: FoodModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(food));
  const [showParse, setShowParse] = useState(false);
  const [showChrono, setShowChrono] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<FoodParseWarning[]>([]);
  const [chronoMissing, setChronoMissing] = useState<string[]>([]);
  const { create, update, restore } = useFoodMutations();
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }));

  // Apply parsed macros (PM-1/B-114) — patch built in draft.ts; missing ones untouched.
  const applyParsed = (macros: FoodParseLabel, warnings: FoodParseWarning[]): void => {
    set(parsedPatch(macros));
    setParseWarnings(warnings);
    setShowParse(false);
  };

  // Apply a Chronodrive product (B-182) — server-side mapping; a null macro empties its
  // field and the missing keys drive the "à compléter" notice. No named portion added.
  const applyChrono = (prefill: ChronoFoodPrefill, missing: string[]): void => {
    set(chronoPatch(prefill, draft.name));
    setChronoMissing(missing);
    setShowChrono(false);
  };

  const isEdit = food !== null;
  const trimmedName = draft.name.trim();
  const showDup = trimmedName.length > 0 && isDuplicate(trimmedName);
  const pending = create.isPending || update.isPending;

  const save = (): void => {
    if (!trimmedName) return;
    const body = draftToBody(draft);
    if (isEdit) update.mutate({ id: food.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal title={t(isEdit ? 'foods.modal.editTitle' : 'foods.modal.addTitle')} onClose={onClose}>
      <div className={modalStyles.sub}>{t('foods.modal.sub')}</div>
      <div className={modalStyles.body}>
        <FoodModalFields
          draft={draft}
          isEdit={isEdit}
          showDup={showDup}
          set={set}
          parseWarnings={parseWarnings}
          onParse={() => setShowParse(true)}
          chronoMissing={chronoMissing}
          onChrono={() => setShowChrono(true)}
        />
      </div>

      {showParse && (
        <ParseLabelDialog onClose={() => setShowParse(false)} onApplied={applyParsed} />
      )}
      {showChrono && (
        <ChronoSearchDialog onClose={() => setShowChrono(false)} onApplied={applyChrono} />
      )}

      <div className={modalStyles.actions}>
        {isEdit && food.archived_at === null ? (
          <Button variant="danger" onClick={() => onArchive(food)}>
            {t('foods.archive')}
          </Button>
        ) : isEdit && food.archived_at !== null ? (
          <Button variant="ghost" onClick={() => restore.mutate(food.id, { onSuccess: onClose })}>
            {t('foods.restore')}
          </Button>
        ) : (
          <span />
        )}
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={pending || !trimmedName}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

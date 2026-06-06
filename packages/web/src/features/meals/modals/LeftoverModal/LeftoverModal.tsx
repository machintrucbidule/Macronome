import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeftoverGroup, Meal } from '@macronome/shared';
import { Modal } from '../../../../components/Modal/Modal';
import { useMeals } from '../../MealsContext';
import { LeftoverList } from './LeftoverList';
import { LeftoverForm } from './LeftoverForm';
import type { LeftoverInitial } from './useLeftoverForm';

// Leftover modal router (B-047). The ⊟ Restes button opens the LIST of applied leftovers;
// from there the user creates a new one or edits/removes an existing one. Create → POST,
// edit → PATCH, remove → DELETE; all run server-side proration and refetch the day. The meal
// prop is re-resolved from the day query on each render, so the list reflects fresh groups.
interface LeftoverModalProps {
  meal: Meal;
}

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; group: LeftoverGroup };

/** Build the edit-form seed from a saved group (gross as string for the input). */
function editInitial(group: LeftoverGroup): LeftoverInitial {
  return {
    groupId: group.id,
    gross: String(group.gross_grams),
    entryIds: group.entry_ids,
    containerName: group.container_name,
    tareG: group.tare_g,
  };
}

export function LeftoverModal({ meal }: LeftoverModalProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [view, setView] = useState<View>({ kind: 'list' });

  const titleKey =
    view.kind === 'list'
      ? 'meals.leftover.listTitle'
      : view.kind === 'edit'
        ? 'meals.leftover.editTitle'
        : 'meals.leftover.title';
  const backToList = (): void => setView({ kind: 'list' });

  return (
    <Modal title={`${t(titleKey)} — ${meal.slot_name}`} onClose={actions.closeLeftover}>
      {view.kind === 'list' && (
        <LeftoverList
          meal={meal}
          onNew={() => setView({ kind: 'create' })}
          onEdit={(group) => setView({ kind: 'edit', group })}
        />
      )}
      {view.kind === 'create' && (
        <LeftoverForm meal={meal} onDone={backToList} onCancel={backToList} />
      )}
      {view.kind === 'edit' && (
        <LeftoverForm
          meal={meal}
          initial={editInitial(view.group)}
          onDone={backToList}
          onCancel={backToList}
        />
      )}
    </Modal>
  );
}

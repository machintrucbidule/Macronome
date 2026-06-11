import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeftoverGroup, Meal } from '@macronome/shared';
import { Modal } from '../../../../components/Modal/Modal';
import { useMeals } from '../../MealsContext';
import { LeftoverList } from './LeftoverList';
import { LeftoverForm } from './LeftoverForm';
import type { LeftoverInitial } from './useLeftoverForm';

// Leftover modal router (B-047). With existing leftovers the ⊟ Restes button opens the LIST
// (edit/remove + "new"); with NONE it opens the create form directly (no empty intermediate
// list). Create → POST, edit → PATCH, remove → DELETE; all run server-side proration and
// refetch the day. The meal prop is re-resolved from the day query on each render.
interface LeftoverModalProps {
  meal: Meal;
}

// `fromList` tracks whether the create form was reached via the list (Cancel/Done returns
// there) or opened directly on an empty meal (Cancel/Done closes the modal — no empty list).
type View =
  | { kind: 'list' }
  | { kind: 'create'; fromList: boolean }
  | { kind: 'edit'; group: LeftoverGroup };

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
  const [view, setView] = useState<View>(() =>
    meal.leftover_groups.length > 0 ? { kind: 'list' } : { kind: 'create', fromList: false },
  );

  const titleKey =
    view.kind === 'list'
      ? 'meals.leftover.listTitle'
      : view.kind === 'edit'
        ? 'meals.leftover.editTitle'
        : 'meals.leftover.title';
  const backToList = (): void => setView({ kind: 'list' });
  // Create reached directly (empty meal) returns to nothing → close; reached via the list → back.
  const leaveCreate = (fromList: boolean): void =>
    fromList ? backToList() : actions.closeLeftover();

  return (
    <Modal title={`${t(titleKey)} — ${meal.slot_name}`} onClose={actions.closeLeftover}>
      {view.kind === 'list' && (
        <LeftoverList
          meal={meal}
          onNew={() => setView({ kind: 'create', fromList: true })}
          onEdit={(group) => setView({ kind: 'edit', group })}
        />
      )}
      {view.kind === 'create' && (
        <LeftoverForm
          meal={meal}
          onDone={() => leaveCreate(view.fromList)}
          onCancel={() => leaveCreate(view.fromList)}
        />
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

import { CopyMealConfirm } from './CopyMealConfirm';
import { MealDeleteConfirm } from './MealDeleteConfirm';

// The meal column's two confirm modals, kept together so MealColumn stays within the
// per-function line cap. Both are mounted conditionally: the delete confirm always guards its
// action, the copy confirm only when the meal has content to lose (CP-2/B-248).
interface Props {
  name: string;
  copying: boolean;
  deleting: boolean;
  onCancelCopy: () => void;
  onConfirmCopy: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function MealColumnConfirms({
  name,
  copying,
  deleting,
  onCancelCopy,
  onConfirmCopy,
  onCancelDelete,
  onConfirmDelete,
}: Props) {
  return (
    <>
      {copying && <CopyMealConfirm name={name} onCancel={onCancelCopy} onConfirm={onConfirmCopy} />}
      {deleting && (
        <MealDeleteConfirm name={name} onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
      )}
    </>
  );
}

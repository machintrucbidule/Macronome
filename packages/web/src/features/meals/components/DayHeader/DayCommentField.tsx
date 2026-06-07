import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeals } from '../../MealsContext';
import styles from '../../meals.module.css';

// Editable day comment (B-063): lives on the header's date line. Local state, saved on blur
// (a focus/blur without an edit never writes). Maps to DayLog.comment.
interface Props {
  comment: string | null;
}

export function DayCommentField({ comment }: Props) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [value, setValue] = useState(comment ?? '');

  useEffect(() => setValue(comment ?? ''), [comment]);

  return (
    <div className={styles.dayComment}>
      <input
        value={value}
        placeholder={t('meals.commentPlaceholder')}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== (comment ?? '') && void actions.setComment(value)}
      />
    </div>
  );
}

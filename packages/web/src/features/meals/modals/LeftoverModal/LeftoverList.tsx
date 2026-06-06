import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeftoverGroup, Meal } from '@macronome/shared';
import { modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';
import { Banner } from '../../../../components/Banner/Banner';
import { ApiError } from '../../../../api/client';
import { useMeals } from '../../MealsContext';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Leftover list view (B-047): the meal's applied leftovers, each editable / removable, plus
// a "＋ Nouveau reste" action. Removing a group reverts its lines to fully consumed (DELETE).
interface LeftoverListProps {
  meal: Meal;
  onNew: () => void;
  onEdit: (group: LeftoverGroup) => void;
}

export function LeftoverList({ meal, onNew, onEdit }: LeftoverListProps) {
  const { t } = useTranslation();
  const { mutations } = useMeals();
  const [error, setError] = useState<string | null>(null);
  const groups = meal.leftover_groups;

  const remove = async (groupId: string): Promise<void> => {
    setError(null);
    try {
      await mutations.removeLeftover.mutateAsync(groupId);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed');
    }
  };

  return (
    <>
      <p className={modalStyles.sub}>{t('meals.leftover.listSub')}</p>
      <div className={modalStyles.body}>
        <div className={styles.loList}>
          {groups.length === 0 && (
            <div className={styles.loEmptyList}>{t('meals.leftover.noGroups')}</div>
          )}
          {groups.map((g) => (
            <div key={g.id} className={styles.loGroup}>
              <div className={styles.loGroupMain}>
                <span className={styles.loGroupName}>{g.container_name}</span>
                <span className={styles.loGroupMeta}>
                  {t('meals.leftover.groupMeta', {
                    net: r0(g.leftover_net_grams),
                    count: g.entry_ids.length,
                  })}
                </span>
              </div>
              <div className={styles.loGroupActions}>
                <Button variant="ghost" onClick={() => onEdit(g)}>
                  {t('meals.leftover.edit')}
                </Button>
                <Button
                  variant="danger"
                  disabled={mutations.removeLeftover.isPending}
                  onClick={() => void remove(g.id)}
                >
                  {t('meals.leftover.delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        {error && <Banner tone="warning">{t('meals.leftover.serverError')}</Banner>}
      </div>
      <div className={modalStyles.actions}>
        <span className={modalStyles.actionsRight}>
          <Button variant="primary" onClick={onNew}>
            ＋ {t('meals.leftover.new')}
          </Button>
        </span>
      </div>
    </>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MealTemplateItem as Item, PantryItem } from '@macronome/shared';
import { useMealTemplate, useMealTemplateMutations } from '../useMealTemplate';
import { usePantry } from '../usePantry';
import { useFoodIndex } from '../useFoodPicker';
import { MealTemplateItem } from './MealTemplateItem';
import styles from '../settings.module.css';

// Structure de journée par défaut card (screens/settings.md): the ordered meal template +
// each meal's garde-manger. Reorder swaps adjacent order_index values; rename/delete/add map
// to the meal-template API. Editing here never touches already-created days.
export function MealTemplateCard() {
  const { t } = useTranslation();
  const list = useMealTemplate();
  const { create, update, remove } = useMealTemplateMutations();
  const pantry = usePantry();
  const foodName = useFoodIndex();
  const [newName, setNewName] = useState('');

  const items = list.data?.data ?? [];
  const pantryBySlot = (slot: string): PantryItem[] =>
    (pantry.data?.data ?? []).filter((p) => p.meal_slot_name === slot);

  const move = (index: number, dir: -1 | 1): void => {
    const a = items[index];
    const b = items[index + dir];
    if (!a || !b) return;
    update.mutate({ id: a.id, body: { order_index: b.order_index } });
    update.mutate({ id: b.id, body: { order_index: a.order_index } });
  };
  const rename = (item: Item, name: string): void => update.mutate({ id: item.id, body: { name } });
  const del = (item: Item): void => remove.mutate(item.id);
  const add = (): void => {
    const name = newName.trim();
    if (!name) return;
    create.mutate({ name });
    setNewName('');
  };

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{t('settings.template.title')}</span>
        <span className={styles.meta}>{t('settings.template.meta')}</span>
      </div>
      <div className={styles.cb}>
        <div className={styles.block}>
          <span className={styles.lab}>
            {t('settings.template.meals')}
            <span className={styles.desc}>{t('settings.template.note')}</span>
          </span>
          <div style={{ marginTop: 'var(--sp-3)' }}>
            {items.map((item, index) => (
              <MealTemplateItem
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                pantry={pantryBySlot(item.name)}
                foodName={foodName}
                onMove={move}
                onRename={rename}
                onDelete={del}
              />
            ))}
          </div>
          <div className={styles.add}>
            <input
              value={newName}
              placeholder={t('settings.template.addPlaceholder')}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
            />
            <button type="button" className={styles.addChip} onClick={add}>
              {t('settings.template.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

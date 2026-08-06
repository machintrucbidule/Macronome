import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MealTemplateItem as Item, PantryItem } from '@macronome/shared';
import { useMealTemplate, useMealTemplateMutations } from '../useMealTemplate';
import { notifyUndoable } from '../../../components/Toast/notify';
import { usePantry } from '../usePantry';
import { MealLinesFields } from './MealLinesFields';
import { MealTemplateItem } from './MealTemplateItem';
import { SettingsCard } from './SettingsCard';
import styles from '../settings.module.css';

// Structure de journée par défaut card (screens/settings.md): the ordered meal template +
// each meal's garde-manger. Reorder swaps adjacent order_index values; rename/delete/add map
// to the meal-template API. Editing here never touches already-created days. It also hosts the
// two per-meal displayed-line floors (B-203, MealLinesFields — saved on the settings blob).
export function MealTemplateCard() {
  const { t } = useTranslation();
  const list = useMealTemplate();
  const { create, update, remove } = useMealTemplateMutations();
  const pantry = usePantry();
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
  // B-261: undo re-creates the slot at its original position (the create takes order_index).
  const del = (item: Item): void =>
    remove.mutate(item.id, {
      onSuccess: () =>
        notifyUndoable('mealSlotDeleted', () =>
          create.mutateAsync({ name: item.name, order_index: item.order_index }),
        ),
    });
  const add = (): void => {
    const name = newName.trim();
    if (!name) return;
    create.mutate({ name });
    setNewName('');
  };

  return (
    <SettingsCard
      id="template"
      title={t('settings.template.title')}
      aside={<span className={styles.meta}>{t('settings.template.meta')}</span>}
      flow
      defaultOpen={false}
    >
      <MealLinesFields />
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
    </SettingsCard>
  );
}

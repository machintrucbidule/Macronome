import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MealTemplateItem as Item, PantryItem } from '@macronome/shared';
import { PantryEditor } from './PantryEditor';
import { MealTemplateDeleteConfirm } from './MealTemplateDeleteConfirm';
import styles from '../settings.module.css';

// One default-meal row: reorder (↑/↓), rename, delete, and its garde-manger sub-editor.
// Rename uses a native prompt; delete uses the shared styled confirm modal (B-009 —
// design/components/modals.md: destructive flows use the confirm modal). Names are user data.
interface Props {
  item: Item;
  index: number;
  count: number;
  pantry: PantryItem[];
  foodName: (id: string) => string;
  onMove: (index: number, dir: -1 | 1) => void;
  onRename: (item: Item, name: string) => void;
  onDelete: (item: Item) => void;
}

export function MealTemplateItem({
  item,
  index,
  count,
  pantry,
  foodName,
  onMove,
  onRename,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const rename = (): void => {
    const next = window.prompt(t('settings.template.renamePrompt'), item.name)?.trim();
    if (next && next !== item.name) onRename(item, next);
  };

  return (
    <div className={styles.tmplItem}>
      <div className={styles.tmplHead}>
        <div className={styles.ord}>
          <button
            type="button"
            title={t('settings.template.moveUp')}
            style={{ visibility: index === 0 ? 'hidden' : 'visible' }}
            onClick={() => onMove(index, -1)}
          >
            ▲
          </button>
          <button
            type="button"
            title={t('settings.template.moveDown')}
            style={{ visibility: index === count - 1 ? 'hidden' : 'visible' }}
            onClick={() => onMove(index, 1)}
          >
            ▼
          </button>
        </div>
        <span className={styles.nm}>{item.name}</span>
        <button
          type="button"
          className={styles.iconbtn}
          title={t('settings.template.rename')}
          onClick={rename}
        >
          ✎
        </button>
        <button
          type="button"
          className={styles.iconbtn}
          title={t('settings.template.delete')}
          onClick={() => setConfirming(true)}
        >
          ×
        </button>
      </div>
      <PantryEditor mealSlotName={item.name} items={pantry} foodName={foodName} />
      {confirming && (
        <MealTemplateDeleteConfirm
          item={item}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDelete(item);
          }}
        />
      )}
    </div>
  );
}

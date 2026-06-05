import { useTranslation } from 'react-i18next';
import type { MealTemplateItem as Item, PantryItem } from '@macronome/shared';
import { PantryEditor } from './PantryEditor';
import styles from '../settings.module.css';

// One default-meal row: reorder (↑/↓), rename, delete, and its garde-manger sub-editor.
// Rename/delete use native prompt/confirm (parity with the mockup); names are user data.
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

  const rename = (): void => {
    const next = window.prompt(t('settings.template.renamePrompt'), item.name)?.trim();
    if (next && next !== item.name) onRename(item, next);
  };
  const del = (): void => {
    if (window.confirm(t('settings.template.deletePrompt', { name: item.name }))) onDelete(item);
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
          onClick={del}
        >
          ×
        </button>
      </div>
      <PantryEditor mealSlotName={item.name} items={pantry} foodName={foodName} />
    </div>
  );
}

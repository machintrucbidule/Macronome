import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { useContextMenuZone } from '../../components/ContextMenu/ContextMenuContext';

// Aliments zone resolver for the installed-window context menu (B-195): a food row
// (tr[data-food]) offers Modifier · Archiver/Restaurer — the screens' existing archive
// vocabulary and confirm flow, never a hard "Supprimer" (owner pick).
export function useFoodsContextMenu(
  foods: Food[],
  onOpen: (f: Food) => void,
  onArchive: (f: Food) => void,
  onRestore: (f: Food) => void,
): void {
  const { t } = useTranslation();
  useContextMenuZone((target) => {
    const id = target.closest<HTMLElement>('tr[data-food]')?.getAttribute('data-food');
    const food = id ? foods.find((f) => f.id === id) : undefined;
    if (!food) return null;
    return {
      items: [
        { key: 'edit', label: t('contextMenu.edit'), onSelect: () => onOpen(food) },
        food.archived_at !== null
          ? { key: 'restore', label: t('foods.restore'), onSelect: () => onRestore(food) }
          : {
              key: 'archive',
              label: t('foods.archive'),
              danger: true,
              onSelect: () => onArchive(food),
            },
      ],
    };
  });
}

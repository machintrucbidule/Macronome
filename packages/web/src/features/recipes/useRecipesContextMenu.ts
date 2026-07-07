import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { useContextMenuZone } from '../../components/ContextMenu/ContextMenuContext';

// Recettes zone resolver for the installed-window context menu (B-195): a recipe row
// (tr[data-recipe]) offers Modifier (the builder) · Archiver/Restaurer — the screens'
// existing archive vocabulary and confirm flow (owner pick).
export function useRecipesContextMenu(opts: {
  recipes: RecipeSummary[];
  onOpen: (r: RecipeSummary) => void;
  onArchive: (r: RecipeSummary) => void;
  onRestore: (r: RecipeSummary) => void;
}): void {
  const { t } = useTranslation();
  useContextMenuZone((target) => {
    const id = target.closest<HTMLElement>('tr[data-recipe]')?.getAttribute('data-recipe');
    const recipe = id ? opts.recipes.find((r) => r.id === id) : undefined;
    if (!recipe) return null;
    return {
      items: [
        { key: 'edit', label: t('contextMenu.edit'), onSelect: () => opts.onOpen(recipe) },
        recipe.archived_at !== null
          ? { key: 'restore', label: t('recipes.restore'), onSelect: () => opts.onRestore(recipe) }
          : {
              key: 'archive',
              label: t('recipes.archive'),
              danger: true,
              onSelect: () => opts.onArchive(recipe),
            },
      ],
    };
  });
}

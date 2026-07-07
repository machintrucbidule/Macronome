import { useTranslation } from 'react-i18next';
import type { WeighIn } from '@macronome/shared';
import { useContextMenuZone } from '../../../components/ContextMenu/ContextMenuContext';
import type { WeightController } from '../useWeightController';

// Poids zone resolver for the installed-window context menu (B-195): a closed-period row
// (tr[data-period] whose end date has a weigh-in) offers Modifier / Supprimer on the
// ending weigh-in; anywhere else on the screen — background, chart, the open-period lead
// row — offers "Ajouter une pesée" ahead of the generic block (owner pick). Registered
// from WeightDesktop only, so it is scoped to the Poids screen's lifetime.
export function useWeightContextMenu(opts: {
  ctl: WeightController;
  byDate: Map<string, WeighIn> | null;
  onDelete: (w: WeighIn) => void;
}): void {
  const { t } = useTranslation();
  useContextMenuZone((target) => {
    const rowEl = target.closest<HTMLElement>('tr[data-period]');
    const w = rowEl ? opts.byDate?.get(rowEl.getAttribute('data-period') ?? '') : undefined;
    if (!w) {
      return {
        appendGeneric: true,
        items: [
          {
            key: 'addWeighIn',
            label: t('contextMenu.addWeighIn'),
            onSelect: () => opts.ctl.openAdd(),
          },
        ],
      };
    }
    return {
      items: [
        { key: 'edit', label: t('contextMenu.edit'), onSelect: () => opts.ctl.openEdit(w) },
        {
          key: 'delete',
          label: t('contextMenu.deleteWeighIn'),
          danger: true,
          onSelect: () => opts.onDelete(w),
        },
      ],
    };
  });
}

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContextMenuZone } from '../../components/ContextMenu/ContextMenuContext';

// Journal zone resolver for the installed-window context menu (B-195): a day row
// (tr[data-date]) offers "Ouvrir le jour" only — the inline edits (verdict, activity,
// comment…) stay inline, not duplicated in the menu (owner pick).
export function useJournalContextMenu(): void {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useContextMenuZone((target) => {
    const date = target.closest<HTMLElement>('tr[data-date]')?.getAttribute('data-date');
    if (!date) return null;
    return {
      items: [
        {
          key: 'open',
          label: t('contextMenu.openDay'),
          onSelect: () => void navigate(`/day/${date}`),
        },
      ],
    };
  });
}

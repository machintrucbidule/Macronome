import { useTranslation } from 'react-i18next';
import { chromeStyles } from '../ListChrome';

// The batch-edit control on a phone (BE-1, owner follow-up). A text button on its own row cost the
// list a whole band of vertical space; this is one more **icon-only square toolbar button**, in the
// row's normal place just left of Filtrer — the standing convention for list-screen chrome
// controls (design/components/data-tables.md §Shared mobile list chrome). The count is not shown
// on mobile: the ticked cards already say it, and the toolbar has no room for a second read-out.

interface Props {
  count: number;
  onClick: () => void;
}

export function BulkIconButton({ count, onClick }: Props) {
  const { t } = useTranslation();
  const label = t('bulk.edit');
  return (
    <button
      type="button"
      className={`${chromeStyles.toolBtn} ${count > 0 ? chromeStyles.toolBtnActive : ''}`}
      aria-label={label}
      title={label}
      disabled={count === 0}
      onClick={onClick}
    >
      {/* A checklist: two ticked lines over a third — "act on what is ticked". */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 6l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 14l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 6h10M11 15h10" strokeLinecap="round" />
      </svg>
    </button>
  );
}

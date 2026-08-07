import { useTranslation } from 'react-i18next';
import { chromeStyles } from '../ListChrome';

// The batch-edit control on a phone (BE-1, owner follow-up). A text button on its own row cost the
// list a whole band of vertical space; this is one more **icon-only square toolbar button**, in the
// row's normal place just left of Filtrer — the standing convention for list-screen chrome controls
// (design/components/data-tables.md §Shared mobile list chrome).
//
// It is rendered **only while something is ticked** (the caller decides): at zero it would be a
// dead control, and the toolbar row is tight enough that the space belongs to the search field.
// The count is not shown on mobile — the ticked cards already say it.

interface Props {
  onClick: () => void;
}

export function BulkIconButton({ onClick }: Props) {
  const { t } = useTranslation();
  const label = t('bulk.edit');
  return (
    <button
      type="button"
      className={`${chromeStyles.toolBtn} ${chromeStyles.toolBtnActive}`}
      aria-label={label}
      title={label}
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

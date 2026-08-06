import { useTranslation } from 'react-i18next';
import { SearchSheet, type SearchSheetItem } from '../../../components/SearchSheet';

// The garde-manger food picker on phones (MOB-1, specifications/screens/settings.md §Interactions).
// Presentation only: the caller owns the query and the already-pinned filtering, so the data source
// stays the pantry's own (`GET /foods?sort=usage&dir=desc` — foods only, no recipes, unlike the two
// /search/loggable pickers).
//
// Mounted only behind `useIsMobile()`, and never alongside the inline dropdown: PantryEditor closes
// its picker on a document `mousedown` outside the card, and this sheet is portalled to <body>, so
// the first tap inside the sheet would dismiss it.
interface PantryPickerSheetProps {
  query: string;
  onQueryChange: (query: string) => void;
  items: SearchSheetItem[];
  onPick: (item: SearchSheetItem) => void;
  onClose: () => void;
}

export function PantryPickerSheet({
  query,
  onQueryChange,
  items,
  onPick,
  onClose,
}: PantryPickerSheetProps) {
  const { t } = useTranslation();

  return (
    <SearchSheet
      title={t('settings.pantry.pickerTitle')}
      placeholder={t('settings.pantry.searchPlaceholder')}
      emptyLabel={t('settings.pantry.searchEmpty')}
      query={query}
      onQueryChange={onQueryChange}
      items={items}
      // No custom-food option: the pantry pins existing foods only.
      onPick={onPick}
      onClose={onClose}
    />
  );
}

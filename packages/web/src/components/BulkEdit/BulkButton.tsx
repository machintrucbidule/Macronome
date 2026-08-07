import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';

// The batch-edit control of a desktop catalogue toolbar (BE-1): a plain ghost button, disabled at
// zero — there is nothing to edit. At one selected it opens the ordinary single-row form, which the
// caller decides; this component only reports the click.
//
// It carries no count: the count belongs under the toolbar's own "N aliments" read-out (owner
// follow-up), where it costs the search field no width.

interface Props {
  count: number;
  onClick: () => void;
}

export function BulkButton({ count, onClick }: Props) {
  const { t } = useTranslation();
  return (
    <Button variant="ghost" onClick={onClick} disabled={count === 0}>
      {t('bulk.edit')}
    </Button>
  );
}

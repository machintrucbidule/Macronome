import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import styles from './BulkEdit.module.css';

// The batch-edit control of a catalogue toolbar (BE-1): the count of what is ticked, then the
// button that opens the editor. Disabled at zero — there is nothing to edit — and at one it opens
// the ordinary single-row form, which the caller decides; this component only reports the click.

interface Props {
  count: number;
  onClick: () => void;
}

export function BulkButton({ count, onClick }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {count > 0 && <span className={styles.count}>{t('bulk.selected', { count })}</span>}
      <Button variant="ghost" onClick={onClick} disabled={count === 0}>
        {t('bulk.edit')}
      </Button>
    </>
  );
}

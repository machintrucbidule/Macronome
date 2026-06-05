import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { SearchField } from '../../../components/Form/SearchField';
import styles from '../containers.module.css';

// Contenants toolbar: title + count, accent-insensitive search, and the add button.
interface Props {
  count: number;
  q: string;
  onQ: (q: string) => void;
  onAdd: () => void;
}

export function ContainersToolbar({ count, q, onQ, onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <div>
        <span className={styles.title}>{t('containers.title')}</span>
        <span className={styles.count}>{t('containers.count', { count })}</span>
      </div>
      <div className={styles.tools}>
        <SearchField
          placeholder={t('containers.searchPlaceholder')}
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
        <Button variant="primary" onClick={onAdd}>
          {t('containers.add')}
        </Button>
      </div>
    </div>
  );
}

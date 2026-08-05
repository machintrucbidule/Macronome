import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { ContainerTable, type SortKey } from './ContainerTable';
import { ContainersToolbar } from './ContainersToolbar';
import styles from '../containers.module.css';

// Desktop Contenants tree (mobile-responsive follow-up): the screen exactly as before — the
// toolbar (title + count + search + add), the lead, and the sortable table. Rendered when
// useIsMobile() is false → byte-identical to the former inline ContainersPage body.
interface ContainersDesktopProps {
  rows: Container[];
  loading: boolean;
  count: number;
  q: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onQ: (q: string) => void;
  onSort: (key: SortKey) => void;
  onAdd: () => void;
  onOpen: (c: Container) => void;
  onDelete: (c: Container) => void;
}

export function ContainersDesktop(props: ContainersDesktopProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.wrap}>
      <ContainersToolbar count={props.count} q={props.q} onQ={props.onQ} onAdd={props.onAdd} />
      <p className={styles.lead}>{t('containers.lead')}</p>

      {props.loading ? (
        <SkeletonTableRows />
      ) : props.rows.length === 0 ? (
        <EmptyState>{t('containers.empty')}</EmptyState>
      ) : (
        <ContainerTable
          rows={props.rows}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
          onEdit={props.onOpen}
          onDelete={props.onDelete}
        />
      )}
    </div>
  );
}

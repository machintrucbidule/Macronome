import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { SearchField } from '../../../components/Form/SearchField';
import { ListToolbar, SortSheet, type SortOption } from '../../../components/ListChrome';
import { Fab } from '../../../app/Fab';
import { ContainerCards } from './ContainerCards';
import type { SortKey } from './ContainerTable';

// Mobile Contenants view (mobile-responsive follow-up, same pattern as Aliments/Recettes). A
// sticky search toolbar + Trier sheet over a card list, with a FAB opening the add sheet (bottom
// sheet, owner decision). The app bar already shows the "Contenants" title (S3), so no page
// title/count here, and the desktop lead hint is omitted on mobile (owner request). Consumes the
// shared ListChrome/Fab read-only; renders only — desktop is untouched (this never mounts ≥561px).
interface ContainersMobileProps {
  rows: Container[];
  loading: boolean;
  q: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onQ: (q: string) => void;
  onSort: (key: SortKey) => void;
  onAdd: () => void;
  onOpen: (c: Container) => void;
}

export function ContainersMobile(props: ContainersMobileProps) {
  const { t } = useTranslation();

  const sortOptions: SortOption<SortKey>[] = [
    { key: 'name', label: t('containers.col.name') },
    { key: 'weight', label: t('containers.col.weight') },
  ];

  const body = ((): ReactNode => {
    if (props.loading) return <SkeletonRows />;
    if (props.rows.length === 0) return <EmptyState>{t('containers.empty')}</EmptyState>;
    return <ContainerCards containers={props.rows} onOpen={props.onOpen} />;
  })();

  return (
    <>
      <ListToolbar
        leading={
          <SearchField
            value={props.q}
            placeholder={t('containers.searchPlaceholder')}
            onChange={(e) => props.onQ(e.target.value)}
          />
        }
      >
        <SortSheet
          options={sortOptions}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
          fabSafe
        />
      </ListToolbar>

      {body}

      <Fab onClick={props.onAdd} label={t('containers.add')} />
    </>
  );
}

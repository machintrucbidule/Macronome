import type { ReactNode } from 'react';
import type { Food } from '@macronome/shared';
import { useIsMobile } from '../../../lib/useIsMobile';
import { FoodsDesktop } from './FoodsDesktop';
import { FoodsMobile } from './FoodsMobile';
import type { FoodsLibrary } from '../useFoodsFilters';

// "Mes aliments" mode of the Aliments screen (B-292): the desktop/mobile switch that was
// FoodsPage's whole body before the catalog arrived. Purely presentational — the page owns the
// `useFoodsLibrary` bundle, because it also needs its `foods`/`sources` for the food form.
interface LibraryViewProps {
  library: FoodsLibrary;
  q: string;
  onQ: (q: string) => void;
  modeToggle: ReactNode;
  onAdd: () => void;
  onOpen: (food: Food) => void;
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
  /** Batch edit (BE-1): the page decides which modal opens, since 1 selected means the single
   *  food form and 2+ the batch popup. */
  onBulkEdit: () => void;
}

export function LibraryView({ library, ...props }: LibraryViewProps) {
  const isMobile = useIsMobile();
  const common = {
    ...library,
    q: props.q,
    onQ: props.onQ,
    modeToggle: props.modeToggle,
    onAdd: props.onAdd,
    onOpen: props.onOpen,
    onBulkEdit: props.onBulkEdit,
  };
  return isMobile ? (
    <FoodsMobile {...common} />
  ) : (
    <FoodsDesktop {...common} onArchive={props.onArchive} onRestore={props.onRestore} />
  );
}

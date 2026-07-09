import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChronoFoodPrefill, ChronoProductSummary } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { SearchField } from '../../../components/Form/SearchField';
import { ApiError } from '../../../api/client';
import { useKeyboardViewport } from '../../../lib/useKeyboardViewport';
import { useChronoProduct, useChronoSearch } from '../useChronoSearch';
import styles from '../foods.module.css';

// Chronodrive search sub-dialog (B-182, specifications/screens/food-db.md): debounced
// search (min 3 chars), ≤ 10 compact rows from the gateway proxy, "Choisir" fetches the
// product detail and hands its SERVER-SIDE food_prefill back to the food modal. The
// thumbnail loads browser-side from the gateway's public URL (dropped on error).
const KNOWN_GATEWAY_ERRORS = new Set([
  'gateway_not_configured',
  'gateway_unauthorized',
  'gateway_unavailable',
  'gateway_unreachable',
  'gateway_bad_response',
  'gateway_not_found',
]);

const MACRO_KEYS = ['kcal_per_100g', 'fat_per_100g', 'carb_per_100g', 'protein_per_100g'] as const;

function errorKey(err: unknown): string {
  return err instanceof ApiError && KNOWN_GATEWAY_ERRORS.has(err.code)
    ? `integrations.errors.${err.code}`
    : 'foods.chrono.error';
}

function ChronoResultRow(props: { product: ChronoProductSummary; onChoose: () => void }) {
  const { t } = useTranslation();
  const { product, onChoose } = props;
  const meta = [
    product.unit_quantity_label,
    product.price_eur != null ? `${product.price_eur} €` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={styles.chronoRow}>
      {product.image_url && (
        <img
          className={styles.chronoThumb}
          src={product.image_url}
          alt=""
          onError={(e) => e.currentTarget.remove()}
        />
      )}
      <div className={styles.chronoInfo}>
        <div className={styles.chronoName}>
          {[product.brand, product.name].filter(Boolean).join(' ')}
        </div>
        {meta && <div className={styles.chronoMeta}>{meta}</div>}
      </div>
      {product.product_url && (
        <a
          className={styles.chronoPageLink}
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('foods.chrono.openPage')}
          title={t('foods.chrono.openPage')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"
            />
          </svg>
        </a>
      )}
      <button type="button" className={styles.chronoChoose} onClick={onChoose}>
        {t('foods.chrono.choose')}
      </button>
    </div>
  );
}

interface ChronoSearchDialogProps {
  onClose: () => void;
  onApplied: (prefill: ChronoFoodPrefill, missing: string[]) => void;
}

export function ChronoSearchDialog({ onClose, onApplied }: ChronoSearchDialogProps) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const search = useChronoSearch(q);
  const pick = useChronoProduct();
  const searchRef = useRef<HTMLInputElement>(null);
  // Keyboard-aware sheet (B-206): publishes --kb-inset while this dialog is open.
  useKeyboardViewport();

  const choose = (id: string): void => {
    pick.mutate(id, {
      onSuccess: (res) => {
        const prefill = res.data.food_prefill;
        onApplied(
          prefill,
          MACRO_KEYS.filter((k) => prefill[k] === null),
        );
      },
    });
  };

  const tooShort = q.trim().length < 3;
  const results = search.data ?? [];
  const busy = search.isFetching || pick.isPending;
  const failed = search.isError ? search.error : pick.isError ? pick.error : null;

  return (
    <Modal
      title={t('foods.chrono.title')}
      size="md"
      onClose={onClose}
      initialFocusRef={searchRef}
      fillBody
    >
      <div className={modalStyles.sub}>{t('foods.chrono.sub')}</div>
      <div className={`${modalStyles.body} ${styles.chronoBody}`}>
        <div className={styles.chronoSearchRow}>
          <SearchField
            ref={searchRef}
            value={q}
            placeholder={t('foods.chrono.placeholder')}
            onChange={(e) => setQ(e.target.value)}
          />
          {busy && <span className={styles.chronoSpinner} aria-hidden="true" />}
        </div>
        {tooShort && <div className="hint">{t('foods.chrono.hint')}</div>}
        {failed !== null && <div className={styles.parseerror}>⚠ {t(errorKey(failed))}</div>}
        {!tooShort && search.isSuccess && !busy && results.length === 0 && (
          <div className="hint">{t('foods.chrono.empty')}</div>
        )}
        <div className={styles.chronoList}>
          {results.map((p) => (
            <ChronoResultRow key={p.id} product={p} onChoose={() => choose(p.id)} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

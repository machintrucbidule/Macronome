import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DishPhotoMacros } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { useIsMobile } from '../../../lib/useIsMobile';
import { useDishPhotoMacros } from '../hooks/useAi';
import { ACCEPT, readAsDataUrl } from '../lib/imagePick';
import { mapAiError } from '../lib/aiError';
import styles from './modals.module.css';

// "Analyse par IA" sub-dialog (design/components/ai-dish-analysis.md, B-118). Mirrors the foods
// ParseLabelDialog: up to 4 dish photos AND/OR a note (at least one) → POST /ai/dish-photo-macros,
// and on success pre-fill the parent custom-entry form. Persists nothing; reads images to data URLs.
// ACCEPT/readAsDataUrl/error-mapping are shared with the mobile one-tap entry (lib/, QP-1/B-158).
const MAX_IMAGES = 4;

/** Selected-image thumbnails with a remove (×) each. */
function Thumbnails({
  images,
  disabled,
  onRemove,
}: {
  images: { url: string; name: string }[];
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (images.length === 0) return null;
  return (
    <div className={styles.aiThumbs}>
      {images.map((im, i) => (
        <div key={`${im.name}-${i}`} className={styles.aiThumb}>
          <img src={im.url} alt={im.name} />
          {!disabled && (
            <button type="button" aria-label={t('common.remove')} onClick={() => onRemove(i)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Image picker: gallery + (mobile) camera buttons + thumbnails. Reports selected data URLs up. */
function AiImagePicker({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (urls: string[]) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => onChange(images.map((im) => im.url)), [images, onChange]);

  const onInput = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const accepted = [...files].filter((f) => ACCEPT.includes(f.type)).slice(0, room);
    const picked = await Promise.all(
      accepted.map(async (f) => ({ url: await readAsDataUrl(f), name: f.name })),
    );
    if (picked.length) setImages((cur) => [...cur, ...picked]);
  };

  return (
    <>
      <div className={styles.aiPick}>
        <button
          type="button"
          className={styles.aiDrop}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {t('meals.aiAnalysis.addImages')}
        </button>
        {/* Mobile-only: shoot a photo with the device camera (B-143). Single-shot capture,
            same picker/base64 path; desktop keeps only the gallery button. */}
        {isMobile && (
          <button
            type="button"
            className={styles.aiDrop}
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            {t('meals.aiAnalysis.takePhoto')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => void onInput(e)}
      />
      {isMobile && (
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          hidden
          onChange={(e) => void onInput(e)}
        />
      )}
      <div className={styles.aiHint}>{t('meals.aiAnalysis.imagesHint')}</div>
      <Thumbnails
        images={images}
        disabled={disabled}
        onRemove={(i) => setImages((c) => c.filter((_, idx) => idx !== i))}
      />
    </>
  );
}

interface AiDishAnalysisDialogProps {
  onClose: () => void;
  onApplied: (result: DishPhotoMacros) => void;
}

export function AiDishAnalysisDialog({ onClose, onApplied }: AiDishAnalysisDialogProps) {
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [noFood, setNoFood] = useState(false);
  const analyse = useDishPhotoMacros();

  const busy = analyse.isPending;
  const canSubmit = imageUrls.length > 0 || note.trim().length > 0;

  const submit = (): void => {
    if (!canSubmit || busy) return;
    setErrorCode(null);
    setErrorDetail(null);
    setNoFood(false);
    analyse.mutate(
      { images: imageUrls, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        // DS-1/B-160: no food identified → keep the dialog open with an info message, no pre-fill.
        onSuccess: (res) => {
          if (!res.data.detected) {
            setNoFood(true);
            return;
          }
          onApplied(res.data);
        },
        onError: (err) => {
          const { code, detail } = mapAiError(err);
          setErrorCode(code);
          setErrorDetail(detail);
        },
      },
    );
  };

  return (
    <Modal title={t('meals.aiAnalysis.title')} size="confirm" onClose={onClose}>
      <div className={modalStyles.body}>
        <div className={styles.aiHint}>{t('meals.aiAnalysis.intro')}</div>
        <AiImagePicker disabled={busy} onChange={setImageUrls} />
        <label className={styles.aiNoteField}>
          <span>{t('meals.aiAnalysis.note')}</span>
          <textarea
            value={note}
            maxLength={500}
            disabled={busy}
            placeholder={t('meals.aiAnalysis.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {busy && (
          <div className={styles.aiBusy}>
            <span className={styles.aiSpinner} aria-hidden="true" />
            {t('meals.aiAnalysis.busy')}
          </div>
        )}
        {noFood && <Banner tone="info">{t('meals.aiAnalysis.noFood')}</Banner>}
        {errorCode && (
          <Banner tone="warning">
            {t(`meals.aiAnalysis.errors.${errorCode}`)}
            {errorDetail && <span className={styles.aiErrDetail}>{errorDetail}</span>}
          </Banner>
        )}
      </div>

      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={busy || !canSubmit}>
            {busy && <span className={styles.aiSpinner} aria-hidden="true" />}
            {busy ? t('meals.aiAnalysis.analyzing') : t('meals.aiAnalysis.analyze')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

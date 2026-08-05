import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DishPhotoMacros } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { Textarea } from '../../../components/Form/Textarea';
import { useDishPhotoMacros } from '../hooks/useAi';
import { mapAiError } from '../lib/aiError';
import { AiImagePicker } from './AiImagePicker';
import styles from './modals.module.css';

// "Analyse par IA" sub-dialog (design/components/ai-dish-analysis.md, B-118). Mirrors the foods
// ParseLabelDialog: up to 4 dish photos AND/OR a note (at least one) → POST /ai/dish-photo-macros,
// and on success pre-fill the parent custom-entry form. Persists nothing; reads images to data
// URLs. The picker (file inputs + drop zone + clipboard paste, B-184) lives in AiImagePicker.tsx.

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
        <Textarea
          label={t('meals.aiAnalysis.note')}
          wrapperClassName={styles.aiNoteField}
          value={note}
          maxLength={500}
          disabled={busy}
          placeholder={t('meals.aiAnalysis.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
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

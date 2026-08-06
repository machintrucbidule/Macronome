import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../lib/useIsMobile';
import { ACCEPT, imageFilesOf, readAsDataUrl } from '../lib/imagePick';
import styles from './modals.module.css';

// Image picker for the "Analyse par IA" dialog (design/components/ai-dish-analysis.md, B-118 +
// B-184). Three import paths feed one addFiles core (ACCEPT filter + 4-image cap + base64 read):
// the gallery/(mobile) camera file inputs, the drop zone (the gallery button itself), and a
// clipboard paste listener — intercepted only when the clipboard carries image files, so text
// paste in the note textarea stays native. Ignored files (cap reached / unsupported type) show a
// faint transient hint. Split out of AiDishAnalysisDialog for the 300-line rule.
export const MAX_IMAGES = 4;

type Hint = 'cap' | 'type';

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

/** Import state + the three input paths' shared core (split out of the component for the
 *  per-function line cap). `renameBase` covers clipboard files whose names are generic
 *  ("image.png") → capture-N. Wrong-type wins over the cap when both apply. */
function useImageImport(disabled: boolean, onChange: (urls: string[]) => void) {
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const hintTimer = useRef<number | null>(null);

  useEffect(() => onChange(images.map((im) => im.url)), [images, onChange]);
  useEffect(
    () => () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    },
    [],
  );

  const showHint = (h: Hint | null): void => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setHint(h);
    if (h) hintTimer.current = window.setTimeout(() => setHint(null), 4000);
  };

  const addFiles = async (files: File[], renameBase?: string): Promise<void> => {
    if (files.length === 0) return;
    const typed = files.filter((f) => ACCEPT.includes(f.type));
    const accepted = typed.slice(0, MAX_IMAGES - images.length);
    showHint(typed.length < files.length ? 'type' : accepted.length < typed.length ? 'cap' : null);
    const base = images.length;
    const picked = await Promise.all(
      accepted.map(async (f, i) => ({
        url: await readAsDataUrl(f),
        name: renameBase ? `${renameBase}-${base + i + 1}` : f.name,
      })),
    );
    if (picked.length) setImages((cur) => [...cur, ...picked]);
  };
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  // Clipboard paste (B-184): intercept ONLY when image files are present — text paste (the
  // note textarea, spellcheck) stays native. Latest addFiles via ref (listener bound once).
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent): void => {
      const files = imageFilesOf(e.clipboardData);
      if (!files.some((f) => ACCEPT.includes(f.type))) return;
      e.preventDefault();
      void addFilesRef.current(files, 'capture');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled]);

  return { images, setImages, hint, addFiles };
}

/** Image picker: gallery/camera inputs + drop zone + paste. Reports selected data URLs up. */
export function AiImagePicker({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (urls: string[]) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { images, setImages, hint, addFiles } = useImageImport(disabled, onChange);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const onInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files ? [...e.target.files] : [];
    e.target.value = '';
    void addFiles(files);
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) void addFiles(imageFilesOf(e.dataTransfer));
  };

  return (
    <>
      <div className={styles.aiPick}>
        <button
          type="button"
          className={`${styles.aiDrop} ${dragOver ? styles.aiDropOver : ''}`}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => !disabled && setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
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
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={onInput} />
      {isMobile && (
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          hidden
          onChange={onInput}
        />
      )}
      <div className={styles.aiHint}>{t('meals.aiAnalysis.imagesHint')}</div>
      {hint && (
        <div className={styles.aiIgnoredHint} role="status">
          {t(hint === 'cap' ? 'meals.aiAnalysis.hintCap' : 'meals.aiAnalysis.hintType')}
        </div>
      )}
      <Thumbnails
        images={images}
        disabled={disabled}
        onRemove={(i) => setImages((c) => c.filter((_, idx) => idx !== i))}
      />
    </>
  );
}

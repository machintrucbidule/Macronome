import { useTranslation } from 'react-i18next';
import { Banner } from '../../../../components/Banner/Banner';
import type { MealPhotoEntry } from '../../hooks/useMealPhotoEntry';
import styles from './meal-column.module.css';

// The mobile one-tap photo entry's non-button UI (QP-1/B-158): the hidden capture input + the
// busy / error / no-food banner under the meal header. The 📷 button itself sits in the header slot
// (MealPhotoButton); both are driven by the same useMealPhotoEntry instance held in MealColumn.
export function MealPhotoFeedback({ photo }: { photo: MealPhotoEntry }) {
  const { t } = useTranslation();
  if (!photo.ready) return null;
  return (
    <>
      <input ref={photo.inputRef} {...photo.inputProps} />
      {photo.message && (
        <Banner
          tone={photo.message.tone}
          {...(photo.message.dismissible ? { onDismiss: photo.dismiss } : {})}
        >
          {t(photo.message.key)}
          {photo.message.detail && (
            <span className={styles.photoErrDetail}>{photo.message.detail}</span>
          )}
        </Banner>
      )}
    </>
  );
}

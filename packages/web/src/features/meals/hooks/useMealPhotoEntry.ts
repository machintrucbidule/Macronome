import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { Meal } from '@macronome/shared';
import { useIsMobile } from '../../../lib/useIsMobile';
import { useSettingsQuery } from '../../settings/useSettings';
import { useMeals } from '../MealsContext';
import { firstFreeSlot } from '../logic/lineRows';
import { ACCEPT, macrosToCustomValues, readAsDataUrl } from '../lib/imagePick';
import { mapAiError } from '../lib/aiError';
import { useDishPhotoMacros } from './useAi';

// Mobile one-tap photo → AI → custom line (QP-1/B-158). Composes existing pieces: a single-shot
// camera capture (B-143), the dish-photo estimate (B-118), the "no food detected" status (DS-1),
// the first-free-slot insertion (B-028), and the prefilled CustomFoodModal. Persists nothing here —
// the AI estimate just opens the custom modal prefilled; the user validates to create the line.

export interface PhotoMessage {
  tone: 'info' | 'warning';
  /** i18n key (reuses meals.aiAnalysis.busy / .noFood / .errors.<code>). */
  key: string;
  detail?: string | null;
  /** A busy notice is not dismissible; result notices (error / no-food) are. */
  dismissible: boolean;
}

interface PhotoInputProps {
  type: 'file';
  accept: string;
  capture: 'environment';
  hidden: true;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export interface MealPhotoEntry {
  /** Shown only on the phone layout when the dish-photo AI task is configured. */
  ready: boolean;
  busy: boolean;
  message: PhotoMessage | null;
  trigger: () => void;
  dismiss: () => void;
  /** Apply to the hidden capture input as `<input ref={inputRef} {...inputProps} />`. */
  inputRef: RefObject<HTMLInputElement>;
  inputProps: PhotoInputProps;
}

export function useMealPhotoEntry(meal: Meal): MealPhotoEntry {
  const isMobile = useIsMobile();
  const settings = useSettingsQuery().data?.data;
  const { actions } = useMeals();
  const analyse = useDishPhotoMacros();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<PhotoMessage | null>(null);

  // Configured = link set (api key present) + a vision model picked for this task (B-117).
  const ai = settings?.ai ?? null;
  const ready = isMobile && !!ai && ai.api_key_set && ai.tasks.dish_photo_macros.model !== null;

  const onInput = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ACCEPT.includes(file.type)) return;
    setBusy(true);
    setMessage({ tone: 'info', key: 'meals.aiAnalysis.busy', dismissible: false });
    let url: string;
    try {
      url = await readAsDataUrl(file);
    } catch {
      setBusy(false);
      setMessage({
        tone: 'warning',
        key: 'meals.aiAnalysis.errors.ai_bad_response',
        dismissible: true,
      });
      return;
    }
    analyse.mutate(
      { images: [url] },
      {
        onSuccess: (res) => {
          // DS-1/B-160: no food identified → message, don't open the modal.
          if (!res.data.detected) {
            setMessage({ tone: 'info', key: 'meals.aiAnalysis.noFood', dismissible: true });
            return;
          }
          setMessage(null);
          actions.openCustom(
            meal.id,
            meal.order_index,
            null,
            firstFreeSlot(meal.entries),
            macrosToCustomValues(res.data),
          );
        },
        onError: (err) => {
          const { code, detail } = mapAiError(err);
          setMessage({
            tone: 'warning',
            key: `meals.aiAnalysis.errors.${code}`,
            detail,
            dismissible: true,
          });
        },
        onSettled: () => setBusy(false),
      },
    );
  };

  return {
    ready,
    busy,
    message,
    trigger: () => inputRef.current?.click(),
    dismiss: () => setMessage(null),
    inputRef,
    inputProps: {
      type: 'file',
      accept: ACCEPT,
      capture: 'environment',
      hidden: true,
      onChange: (e) => void onInput(e),
    },
  };
}

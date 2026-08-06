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
  /** The AI dish-photo task is usable (link + key + vision model) — WITHOUT the mobile check.
   *  `ready` is this AND the phone layout; the desktop drop/paste needs only this (B-271). */
  configured: boolean;
  /** Analyse one image and open the pre-filled custom form — the shared core of the phone
   *  button and the desktop drop/paste. Rejects a non-image visibly rather than silently. */
  analyseFile: (file: File) => void;
  busy: boolean;
  message: PhotoMessage | null;
  trigger: () => void;
  dismiss: () => void;
  /** Apply to the hidden capture input as `<input ref={inputRef} {...inputProps} />`. */
  inputRef: RefObject<HTMLInputElement>;
  inputProps: PhotoInputProps;
}

/** A dismissible warning notice (the shape the banner renders). */
const warn = (key: string, detail?: string | null): PhotoMessage => ({
  tone: 'warning',
  key,
  ...(detail === undefined ? {} : { detail }),
  dismissible: true,
});

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
  // Two conditions that used to be one. The phone button needs both; the desktop drop/paste
  // (B-271) needs only the configuration — it is the same flow with a different file source.
  const configured = !!ai && ai.api_key_set && ai.tasks.dish_photo_macros.model !== null;
  const ready = isMobile && configured;

  const run = async (file: File): Promise<void> => {
    if (!ACCEPT.includes(file.type)) {
      // B-271: a wrong-type drop is refused visibly. The camera input cannot produce one (its
      // `accept` filters), so this only ever fires for a drop or a paste.
      setMessage(warn('meals.aiAnalysis.notAnImage'));
      return;
    }
    setBusy(true);
    setMessage({ tone: 'info', key: 'meals.aiAnalysis.busy', dismissible: false });
    const url = await readAsDataUrl(file).catch(() => null);
    if (url === null) {
      setBusy(false);
      setMessage(warn('meals.aiAnalysis.errors.ai_bad_response'));
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
          setMessage(warn(`meals.aiAnalysis.errors.${code}`, detail));
        },
        onSettled: () => setBusy(false),
      },
    );
  };

  return {
    ready,
    configured,
    analyseFile: (file: File) => void run(file),
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
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-picking the same file
        if (file) void run(file);
      },
    },
  };
}

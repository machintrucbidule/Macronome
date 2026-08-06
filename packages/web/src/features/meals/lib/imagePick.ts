import type { DishPhotoMacros } from '@macronome/shared';
import type { CustomValues } from '../hooks/mealActions';

// Shared image-pick helpers for the AI dish-photo flows (the in-modal "Analyse par IA" dialog and
// the mobile one-tap meal-header entry, QP-1/B-158). Kept tiny + framework-free so both consumers
// reuse the exact same accept list, base64 read, and result→form mapping.

/** Accepted image MIME list for the file inputs (matches spec/api/ai.md jpeg/png/webp). */
export const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Read a picked File to a base64 data URL (the body shape POST /ai/dish-photo-macros expects). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });
}

/** Map an AI dish-photo estimate (totals, SI units) to the custom-entry form values — 1:1, the same
 *  mapping as CustomFoodModal.applyAnalysis (spec/logic/ai-dish-photo-macros.md §5). A 0 served
 *  weight maps to null (the form treats served weight as optional). */
export function macrosToCustomValues(r: DishPhotoMacros): CustomValues {
  return {
    name: r.dish_name,
    kcal: r.kcal,
    servedGrams: r.weight_g > 0 ? r.weight_g : null,
    snap: { kcal: r.kcal, fat: r.fat_g, carb: r.carb_g, protein: r.protein_g },
  };
}

/** Image files of a drop/paste payload; some sources expose them via `items` only — which is what
 *  makes a pasted screenshot work at all, since the clipboard often carries no `files` entry.
 *  Shared by the "Analyse par IA" dialog and the meal-column drop/paste (B-271). */
export function imageFilesOf(data: DataTransfer | null): File[] {
  const files = data?.files ? [...data.files] : [];
  if (files.length > 0) return files;
  if (!data?.items) return [];
  return [...data.items]
    .filter((it) => it.kind === 'file')
    .map((it) => it.getAsFile())
    .filter((f): f is File => f !== null);
}

/** The first file the AI dish analysis will accept, or null. `ACCEPT` is the contract's list. */
export function firstAcceptedImage(files: File[]): File | null {
  return files.find((f) => ACCEPT.includes(f.type)) ?? null;
}

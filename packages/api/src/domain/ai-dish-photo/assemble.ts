import { DISH_PHOTO_FORMAT_INSTRUCTION } from './format.js';

// Prompt assembly (spec/logic/ai-dish-photo-macros.md §2). One `user` message with multimodal
// content: a single text part (configured scope prompt, then the optional note, then the
// hard-coded format instruction, then the dish-name language clause — in that order) followed by
// one image_url part per image. The format instruction always closes the schema so the return
// shape is guaranteed; the language clause localises only `dish_name` (B-119).

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user';
  content: ChatContentPart[];
}

const LANGUAGE_NAME: Record<'fr' | 'en', string> = { fr: 'French', en: 'English' };

/** Instruct the model to return `dish_name` in the user's UI language (numbers unaffected). */
function dishNameLanguageClause(locale: 'fr' | 'en'): string {
  return `Write the "dish_name" in ${LANGUAGE_NAME[locale]}.`;
}

export function buildDishPhotoMessages(
  prompt: string,
  note: string | undefined,
  images: string[],
  locale: 'fr' | 'en',
): ChatMessage[] {
  const noteBlock = note && note.trim() !== '' ? `\n\n${note.trim()}` : '';
  const text = `${prompt}${noteBlock}\n\n${DISH_PHOTO_FORMAT_INSTRUCTION}\n\n${dishNameLanguageClause(locale)}`;
  const content: ChatContentPart[] = [
    { type: 'text', text },
    ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  return [{ role: 'user', content }];
}

import { DISH_PHOTO_FORMAT_INSTRUCTION } from './format.js';

// Prompt assembly (spec/logic/ai-dish-photo-macros.md §2). One `user` message with multimodal
// content: a single text part (configured scope prompt, then the optional note, then the
// hard-coded format instruction — in that order) followed by one image_url part per image.
// The format instruction always closes the text part so the return shape is guaranteed.

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user';
  content: ChatContentPart[];
}

export function buildDishPhotoMessages(
  prompt: string,
  note: string | undefined,
  images: string[],
): ChatMessage[] {
  const noteBlock = note && note.trim() !== '' ? `\n\n${note.trim()}` : '';
  const text = `${prompt}${noteBlock}\n\n${DISH_PHOTO_FORMAT_INSTRUCTION}`;
  const content: ChatContentPart[] = [
    { type: 'text', text },
    ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  return [{ role: 'user', content }];
}

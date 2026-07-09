import type { ChatMessage } from '../ai-dish-photo/index.js';
import { ADVICE_FORMAT_INSTRUCTION, adviceLanguageClause } from './format.js';
import type { AdvicePayload } from './payload.js';

// Prompt assembly for the advice use (spec/logic/ai-advice.md §2). One `user` message, single text
// part assembled in order: (1) the configured scope prompt, (2) the aggregated context block, (3) the
// hard-coded Markdown format instruction, (4) the locale language clause. The scope prompt is never
// trusted to define the output shape or language — (3)+(4) always close the text part. Reuses the
// ChatMessage type of the dish-photo domain (a text-only message here — no vision).

/** Serialise the compact §2.2 payload as a labelled JSON block the model reads deterministically. */
export function contextBlock(payload: AdvicePayload): string {
  return `TRACKING DATA (JSON):\n${JSON.stringify(payload)}`;
}

export function buildAdviceMessages(
  prompt: string,
  payload: AdvicePayload,
  locale: 'fr' | 'en',
): ChatMessage[] {
  const text =
    `${prompt}\n\n${contextBlock(payload)}\n\n` +
    `${ADVICE_FORMAT_INSTRUCTION}\n\n${adviceLanguageClause(locale)}`;
  return [{ role: 'user', content: [{ type: 'text', text }] }];
}

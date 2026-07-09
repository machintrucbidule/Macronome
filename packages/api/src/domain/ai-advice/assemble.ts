import type { ChatMessage } from '../ai-dish-photo/index.js';
import {
  ADVICE_ANALYSIS_INSTRUCTION,
  ADVICE_FORMAT_INSTRUCTION,
  adviceAvoidancesClause,
  adviceLanguageClause,
} from './format.js';
import type { AdvicePayload } from './payload.js';

// Prompt assembly for the advice use (spec/logic/ai-advice.md §2). One `user` message, single text
// part assembled in order: (1) the configured scope prompt, (2) the aggregated context block, (3) the
// app-owned "foods to avoid" clause when the user set avoidances (B-216), (4) the app-owned analysis
// instruction (B-212), (5) the hard-coded Markdown format instruction, (6) the locale language clause.
// The scope prompt is never trusted to define the output shape, analysis, or language — (4)+(5)+(6)
// always close the text part. Reuses the ChatMessage type of the dish-photo domain (text-only here).

/** Serialise the compact §2.2 payload as a labelled JSON block the model reads deterministically. */
export function contextBlock(payload: AdvicePayload): string {
  return `TRACKING DATA (JSON):\n${JSON.stringify(payload)}`;
}

export function buildAdviceMessages(
  prompt: string,
  payload: AdvicePayload,
  locale: 'fr' | 'en',
  avoidances?: string,
): ChatMessage[] {
  const avoid = adviceAvoidancesClause(avoidances);
  const text =
    `${prompt}\n\n${contextBlock(payload)}\n\n` +
    (avoid === '' ? '' : `${avoid}\n\n`) +
    `${ADVICE_ANALYSIS_INSTRUCTION}\n\n` +
    `${ADVICE_FORMAT_INSTRUCTION}\n\n${adviceLanguageClause(locale)}`;
  return [{ role: 'user', content: [{ type: 'text', text }] }];
}

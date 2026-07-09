// Public surface of the ai-advice domain (spec/logic/ai-advice.md, B-202). Pure prompt assembly,
// payload shaping, and the trivial Markdown parse — no DB, no request. The aggregator service
// (services/advice-data.ts) feeds it plain read-service outputs; services/ai.ts orchestrates.
export {
  ADVICE_ANALYSIS_INSTRUCTION,
  ADVICE_FORMAT_INSTRUCTION,
  adviceAvoidancesClause,
  adviceLanguageClause,
} from './format.js';
export { buildAdviceMessages, contextBlock } from './assemble.js';
export { parseAdvice, type AdviceParseResult } from './parse.js';
export {
  buildAdvicePayload,
  sliceRecentJournal,
  windowStart,
  type AdvicePayload,
  type AdvicePayloadInputs,
  type AdviceDayMeals,
  type AdviceMealLine,
  type AdviceJournalDay,
} from './payload.js';

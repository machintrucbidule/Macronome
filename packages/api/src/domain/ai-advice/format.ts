// Hard-coded response-format contract for the advice use (spec/logic/ai-advice.md §2.3). App-owned,
// English, NOT stored in settings — appended verbatim at call time so the OUTPUT FORMAT (Markdown,
// non-paternalistic delivery, no meta-preamble) is guaranteed regardless of the user-editable scope
// prompt (owner decision, B-202: Markdown is enforced here, never in the prompt).
export const ADVICE_FORMAT_INSTRUCTION =
  'Respond in Markdown only — no code fences, no JSON, no HTML, and no preamble about being an AI ' +
  'or about the data you were given. Write directly to the person being coached: short paragraphs ' +
  'and bullet lists where they help, with clear sub-headings if the advice is long. Keep a warm, ' +
  'respectful, non-judgmental tone; give concrete, actionable suggestions and acknowledge what is ' +
  'going well. Never scold, shame, or moralise.';

const LANGUAGE_NAME: Record<'fr' | 'en', string> = { fr: 'French', en: 'English' };

/** Instruct the model to reply in the user's UI language (spec/logic/ai-advice.md §2 (4)) — the ONLY
 *  thing that sets the output language, so editing the scope prompt can never change it. */
export function adviceLanguageClause(locale: 'fr' | 'en'): string {
  return `Respond in ${LANGUAGE_NAME[locale]}.`;
}

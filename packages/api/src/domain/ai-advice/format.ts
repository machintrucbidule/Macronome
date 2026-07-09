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

// App-owned analysis instruction (spec/logic/ai-advice.md §2.3, B-212). Always appended — like the
// format instruction — so it holds regardless of how the user rewrites the editable scope prompt
// (owner decision: always-applied, not baked into the default prompt). Directs the coach to judge
// balance over the average and flag deficiency RISKS (macro + qualitative from food names), while
// being honest that the app tracks NO micronutrients — risk hints, never measured deficiencies.
export const ADVICE_ANALYSIS_INSTRUCTION =
  'Assess balance over the average of the period, not meal by meal: judge whether the overall ' +
  'intake is balanced and flag deficiency RISKS — both at the macro level and qualitatively from ' +
  'the food names provided (for example, few omega-3 sources such as oily fish, or few vegetables ' +
  'and little fibre). Be explicit that these are risk hints inferred from food names and macros, ' +
  'not measured deficiencies: this app does not track micronutrients, so never claim a measured ' +
  'micronutrient shortfall.';

/** App-owned "foods to avoid" clause built from the user's persisted avoidances free text
 *  (spec/logic/ai-advice.md §2, B-216) — allergies / disliked foods the coach must never propose.
 *  Empty (or whitespace-only) avoidances → `''` (no section). Trimmed. */
export function adviceAvoidancesClause(avoidances?: string): string {
  const text = (avoidances ?? '').trim();
  if (text === '') return '';
  return (
    `FOODS TO AVOID (user allergies/dislikes): ${text}\n` +
    'Never recommend, suggest, or build advice around these foods.'
  );
}

const LANGUAGE_NAME: Record<'fr' | 'en', string> = { fr: 'French', en: 'English' };

/** Instruct the model to reply in the user's UI language (spec/logic/ai-advice.md §2 (4)) — the ONLY
 *  thing that sets the output language, so editing the scope prompt can never change it. */
export function adviceLanguageClause(locale: 'fr' | 'en'): string {
  return `Respond in ${LANGUAGE_NAME[locale]}.`;
}

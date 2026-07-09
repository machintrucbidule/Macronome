// Response parsing for the advice use (spec/logic/ai-advice.md §5). The output is FREE Markdown, so
// the parse is trivial: strip an optional outer code fence, trim, and reject an empty reply. The
// `{ ok } | { ok:false }` shape mirrors the other AI parsers so the service's
// `if (!parsed.ok) throw AiBadResponse` line stays identical. No structural validation — the
// Markdown is stored as-is and sanitised at render time (web slice).

export type AdviceParseResult = { ok: true; data: string } | { ok: false };

// Whole-reply fence like ```markdown\n…\n``` or ```\n…\n``` — some models wrap the answer.
const FENCED = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```$/;

export function parseAdvice(text: string): AdviceParseResult {
  const trimmed = text.trim();
  const fence = FENCED.exec(trimmed);
  const content = (fence ? (fence[1] ?? '') : trimmed).trim();
  if (content === '') return { ok: false };
  return { ok: true, data: content };
}

// Cookie NAMES for the black box — never values (security.md §7). Knowing that
// `macronome.csrf` arrived but `macronome.sid` did not is what names a cookie/proxy
// misconfiguration; the values would only be credentials.
//
// Names are attacker-influenced (any client can send arbitrary cookies), so they are filtered to
// the RFC 6265 token charset, length-clamped, deduped and capped before they can reach a file.
const MAX_NAMES = 32;
const MAX_NAME_LEN = 64;
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function sanitise(names: string[]): string[] {
  const kept = new Set<string>();
  for (const raw of names) {
    const name = raw.trim().slice(0, MAX_NAME_LEN);
    if (name && TOKEN.test(name)) kept.add(name);
    if (kept.size >= MAX_NAMES) break;
  }
  return [...kept].sort();
}

/** Names present in a request `Cookie` header. */
export function cookieNamesFromHeader(header?: string): string[] {
  if (!header) return [];
  return sanitise(header.split(';').map((part) => part.split('=')[0] ?? ''));
}

/** Names in whatever `res.getHeader('set-cookie')` returned (string, array, or absent). */
export function setCookieNames(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return sanitise(list.map((entry) => String(entry).split(';')[0]?.split('=')[0] ?? ''));
}

/**
 * The raw value of one request cookie. Used only to answer "is the presented session cookie this
 * session?" — the value is compared, reduced to a boolean, and never stored (see session-found.ts).
 */
export function rawCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

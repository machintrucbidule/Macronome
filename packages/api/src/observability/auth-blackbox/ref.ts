import { randomBytes } from 'node:crypto';

// The diagnostic code shown on the login screen and stored with the black-box record, so the
// operator can quote it instead of hunting logs (B-231, spec/api/00-conventions.md).
//
// Crockford base32 (no I/L/O/U) grouped as XXXX-XXXX: unambiguous when read off a phone screen and
// typed back, 40 bits of entropy — far more than the ~1000 retained records need. It identifies a
// record; it is not a secret and carries no information about the user or the session.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REF_BYTES = 5;

/** Format 5 bytes as `XXXX-XXXX`. Pure, so the alphabet and grouping are pinned by tests. */
export function formatRef(bytes: Uint8Array): string {
  let chars = '';
  for (const byte of bytes.slice(0, REF_BYTES)) {
    chars += ALPHABET[byte % ALPHABET.length];
  }
  // 5 bytes → 5 chars; pad defensively so the shape is stable for a short input.
  const padded = chars.padEnd(8, '0').slice(0, 8);
  return `${padded.slice(0, 4)}-${padded.slice(4)}`;
}

export function newRef(): string {
  return formatRef(randomBytes(8));
}

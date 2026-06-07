// Pure display helpers for the À propos screen (web-side formatting only — the server sends
// full-precision bytes/seconds, CLAUDE.md rule 2). No React, no tokens.

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Human-readable size from a byte count (binary 1024 steps): 1536 → "1.5 KB", 0 → "0 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const i = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${BYTE_UNITS[i]}`;
}

/** Coarse duration from seconds: "1 j 1 h 1 min" (days/hours dropped when 0; minutes always
 *  shown so a fresh process reads "0 min"). */
export function formatDuration(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} j`);
  if (hours) parts.push(`${hours} h`);
  parts.push(`${minutes} min`);
  return parts.join(' ');
}

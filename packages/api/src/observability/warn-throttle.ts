// Rate gate for a repeating operational warning: let one through per interval and count the
// rest, so a misconfiguration stays visible for as long as it lasts without flooding the log.
//
// This replaces the one-shot `warned` latch of secure-cookie-warn.ts (B-231, prescribed work 3):
// a latch could be consumed by an unrelated early request and then never fire again for the life
// of the process. A throttle re-arms, so it cannot be permanently silenced.
//
// Pure: the clock is injected, so the window is testable without fake timers.
export interface WarnThrottle {
  /** True when this occurrence should be logged; false when it is suppressed (and counted). */
  allow(now: number): boolean;
  /** Number of occurrences suppressed since the last allowed one; resets on read. */
  drain(): number;
}

export function createThrottle(intervalMs: number): WarnThrottle {
  let openedAt = Number.NEGATIVE_INFINITY;
  let suppressed = 0;

  return {
    allow(now: number): boolean {
      if (now - openedAt < intervalMs) {
        suppressed += 1;
        return false;
      }
      openedAt = now;
      return true;
    },
    drain(): number {
      const count = suppressed;
      suppressed = 0;
      return count;
    },
  };
}

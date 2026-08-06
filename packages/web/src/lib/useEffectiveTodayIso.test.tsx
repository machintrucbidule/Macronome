import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { msUntilNextRollover } from './effectiveDay';
import { useEffectiveTodayIso } from './useEffectiveTodayIso';

// B-294 / D16: the app shell is a layout route mounted once per session, so reading
// `effectiveTodayIso()` in a render left an app open past 03:00 stuck on yesterday's date —
// and therefore on yesterday's colour and app-icon badge.

describe('msUntilNextRollover', () => {
  it('counts to today 03:00 before the boundary', () => {
    expect(msUntilNextRollover(new Date(2026, 5, 9, 2, 30))).toBe(30 * 60_000);
  });

  it('counts to tomorrow 03:00 from the boundary on', () => {
    expect(msUntilNextRollover(new Date(2026, 5, 9, 3, 0))).toBe(24 * 3600_000);
    expect(msUntilNextRollover(new Date(2026, 5, 9, 23, 0))).toBe(4 * 3600_000);
  });
});

describe('useEffectiveTodayIso (B-294)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rolls over to the new day at 03:00 without a remount', () => {
    vi.setSystemTime(new Date(2026, 5, 9, 2, 59));
    // Nothing wraps the hook: it must be self-sufficient, exactly as the shell consumes it.
    const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;
    const { result } = renderHook(() => useEffectiveTodayIso(), { wrapper });
    expect(result.current).toBe('2026-06-08'); // still yesterday, before the boundary

    act(() => void vi.advanceTimersByTime(60_000 + 1));
    expect(result.current).toBe('2026-06-09');
  });

  it('re-arms for the following day', () => {
    vi.setSystemTime(new Date(2026, 5, 9, 2, 59));
    const { result } = renderHook(() => useEffectiveTodayIso());
    act(() => void vi.advanceTimersByTime(60_000 + 1));
    act(() => void vi.advanceTimersByTime(24 * 3600_000));
    expect(result.current).toBe('2026-06-10');
  });
});

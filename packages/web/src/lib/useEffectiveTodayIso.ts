import { useEffect, useState } from 'react';
import { effectiveTodayIso, msUntilNextRollover } from './effectiveDay';

// The effective day as a REACTIVE value (B-294). `effectiveTodayIso()` read straight in a render
// is only correct until the next 03:00: nothing forces a re-render at the boundary, so a component
// that never remounts — the app shell is a layout route mounted once per session (B-274) — keeps
// yesterday's date, and with it yesterday's colour and app-icon badge, until the app is restarted.
//
// The timer is armed on the boundary rather than ticking: one timeout per day, no polling. On fire
// the value is recomputed FROM THE CLOCK, so a machine that slept through 03:00 still lands on the
// right date once the timeout finally runs.

export function useEffectiveTodayIso(): string {
  const [iso, setIso] = useState(effectiveTodayIso);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (): void => {
      timer = setTimeout(() => {
        setIso(effectiveTodayIso());
        schedule();
      }, msUntilNextRollover());
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return iso;
}

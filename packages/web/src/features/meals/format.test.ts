import { describe, expect, it } from 'vitest';
import { formatDateLabel, formatDateLabelShort } from './format';

// formatDateLabelShort() backs the mobile day bar (S4): short weekday + day + month + 2-digit
// year. Locale-driven formatting is logic, so it is unit-tested (the day-bar layout itself is
// verified by inspection).

describe('formatDateLabelShort', () => {
  it('renders a short French day label with a 2-digit year', () => {
    // 2026-06-10 is a Wednesday → "mer. 10 juin 26".
    expect(formatDateLabelShort('2026-06-10', 'fr')).toBe('mer. 10 juin 26');
  });

  it('drops the full weekday and 4-digit year that the long label keeps', () => {
    const long = formatDateLabel('2026-06-10', 'fr');
    const short = formatDateLabelShort('2026-06-10', 'fr');
    expect(long).toContain('mercredi');
    expect(long).toContain('2026');
    expect(short).not.toContain('mercredi');
    expect(short).not.toContain('2026');
    expect(short).toContain('26');
  });

  it('abbreviates a long month to its first 4 letters (B-153)', () => {
    // 2026-09-10 → September: "septembre" must collapse to "sept" so the mobile date row stays
    // on one line; juin/juil and June/July stay distinct under the same 4-letter rule.
    const short = formatDateLabelShort('2026-09-10', 'fr');
    expect(short).toContain('sept');
    expect(short).not.toContain('septembre');
  });

  it('is locale-aware (English short form)', () => {
    // en short weekday + month-day order; just assert it stays compact and 2-digit-year.
    const short = formatDateLabelShort('2026-06-10', 'en');
    expect(short).toContain('26');
    expect(short).not.toContain('2026');
  });
});

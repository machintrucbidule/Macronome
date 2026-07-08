import { describe, expect, it } from 'vitest';
import { launchTargetPath } from './launchQueue';

// B-183 follow-up: a LaunchQueue target resolves to the in-app path to navigate to, or null
// when there's nothing to do (plain focus / same screen / missing/unparseable target).
describe('launchTargetPath', () => {
  it('returns the target path+search when it differs from the current location', () => {
    expect(launchTargetPath('https://app.example/history', '/')).toBe('/history');
    expect(launchTargetPath('https://app.example/stats', '/weight')).toBe('/stats');
  });

  it('keeps the search string (the /weight?action=add deep link)', () => {
    expect(launchTargetPath('https://app.example/weight?action=add', '/weight')).toBe(
      '/weight?action=add',
    );
  });

  it('returns null when the target equals the current location (plain focus / same screen)', () => {
    expect(launchTargetPath('https://app.example/', '/')).toBeNull();
    expect(launchTargetPath('https://app.example/stats', '/stats')).toBeNull();
  });

  it('returns null for a missing or empty target', () => {
    expect(launchTargetPath(undefined, '/')).toBeNull();
    expect(launchTargetPath('', '/')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { credentialsValid, targetsValid, type SetupDraft } from './useSetup';

// B-004: the owner account is non-recoverable in-app, so the credentials step requires the
// password entered twice and matched (and ≥8 chars) before it is considered valid.
// B-059: the wizard also collects the initial targets (calorie range + g/kg ratios).
const BASE: SetupDraft = {
  username: 'owner',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
  sex: '',
  birthdate: '',
  heightCm: '',
  calorieMin: '1950',
  calorieMax: '2050',
  proteinGPerKg: '1.8',
  fatGPerKg: '0.8',
};

describe('credentialsValid (B-004 confirm-password)', () => {
  it('is valid when username is set and both passwords match (≥8 chars)', () => {
    expect(credentialsValid(BASE)).toBe(true);
  });

  it('is invalid when the confirmation does not match', () => {
    expect(credentialsValid({ ...BASE, confirmPassword: 'correct-hors' })).toBe(false);
  });

  it('is invalid when the confirmation is empty', () => {
    expect(credentialsValid({ ...BASE, confirmPassword: '' })).toBe(false);
  });

  it('is invalid when matched but shorter than 8 characters', () => {
    expect(credentialsValid({ ...BASE, password: 'short', confirmPassword: 'short' })).toBe(false);
  });

  it('is invalid when the username is blank even if passwords match', () => {
    expect(credentialsValid({ ...BASE, username: '   ' })).toBe(false);
  });
});

describe('targetsValid (B-059 targets step)', () => {
  it('accepts the pre-filled defaults (1950–2050 kcal, 1.8 / 0.8 g/kg)', () => {
    expect(targetsValid(BASE)).toBe(true);
  });

  it('rejects a calorie max below the min', () => {
    expect(targetsValid({ ...BASE, calorieMin: '2100', calorieMax: '2050' })).toBe(false);
  });

  it('rejects a non-positive calorie min', () => {
    expect(targetsValid({ ...BASE, calorieMin: '0' })).toBe(false);
  });

  it('rejects a negative ratio', () => {
    expect(targetsValid({ ...BASE, proteinGPerKg: '-1' })).toBe(false);
  });

  it('rejects a blank/NaN field', () => {
    expect(targetsValid({ ...BASE, fatGPerKg: '' })).toBe(false);
  });
});

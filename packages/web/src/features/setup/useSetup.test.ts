import { describe, expect, it } from 'vitest';
import { credentialsValid, type SetupDraft } from './useSetup';

// B-004: the owner account is non-recoverable in-app, so the credentials step requires the
// password entered twice and matched (and ≥8 chars) before it is considered valid.
const BASE: SetupDraft = {
  username: 'owner',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
  sex: '',
  birthdate: '',
  heightCm: '',
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

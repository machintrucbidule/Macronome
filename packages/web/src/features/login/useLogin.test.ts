import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { classifyLoginError, safeNext, useLogin } from './useLogin';

// B-219: after login the user is returned to the ?next= route (the originally-requested
// protected page), falling back to / for an absent/unsafe target. `safeNext` is the pure
// gate; the hook wires it to the post-login navigate.

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const { loginMock } = vi.hoisted(() => ({
  loginMock: vi.fn().mockResolvedValue({ user: { username: 'x' } }),
}));
vi.mock('../../api/auth', () => ({ authApi: { login: loginMock } }));

// The login error → banner mapping (states.md §Login). 429/lockout is handled separately by the
// hook (countdown), so it is not classified here. The key case: a 403 CSRF (the symptom of the
// COOKIE_SECURE/trust-proxy trap) must NOT read as bad credentials.
describe('classifyLoginError', () => {
  it('401 invalid_credentials → credentials', () => {
    expect(classifyLoginError(new ApiError(401, 'invalid_credentials'))).toBe('credentials');
  });

  it('403 csrf_invalid → technical (not credentials)', () => {
    expect(classifyLoginError(new ApiError(403, 'csrf_invalid'))).toBe('technical');
  });

  it('5xx server error → technical', () => {
    expect(classifyLoginError(new ApiError(500, 'error'))).toBe('technical');
  });

  it('a non-ApiError (fetch/network failure) → network', () => {
    expect(classifyLoginError(new TypeError('Failed to fetch'))).toBe('network');
  });
});

describe('safeNext (B-219)', () => {
  it('accepts a same-origin app path', () => {
    expect(safeNext('/weight')).toBe('/weight');
    expect(safeNext('/day/2026-07-09?edit=1')).toBe('/day/2026-07-09?edit=1');
  });

  it('falls back to / for absent, public, or off-origin targets', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext('/login')).toBe('/');
    expect(safeNext('/setup')).toBe('/');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('relative')).toBe('/');
  });
});

function wrapper(initialEntry: string) {
  return ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [initialEntry] }, children),
    );
  };
}

describe('useLogin post-login redirect (B-219)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function submitFrom(entry: string): Promise<void> {
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper(entry) });
    await act(async () => {
      await result.current.submit('user', 'pw', true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }

  it('returns to the ?next= page on success', async () => {
    await submitFrom('/login?next=/weight');
    expect(navigateMock).toHaveBeenCalledWith('/weight');
  });

  it('falls back to / when ?next= is a public path', async () => {
    await submitFrom('/login?next=/login');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('falls back to / when there is no ?next=', async () => {
    await submitFrom('/login');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});

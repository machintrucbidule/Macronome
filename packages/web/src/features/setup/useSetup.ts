import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Sex } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/auth';
import { SESSION_KEY } from '../../app/useSession';
import { SETUP_STATE_KEY } from '../../app/useSetupState';

// First-run wizard state (M8). Two steps — credentials then profile — collected as a
// string draft; on submit the owner account is created and the session opened, then we
// route home. If an owner already exists (409) the wizard hands off to /login.
export interface SetupDraft {
  username: string;
  password: string;
  confirmPassword: string;
  sex: Sex | '';
  birthdate: string;
  heightCm: string;
}

const EMPTY: SetupDraft = {
  username: '',
  password: '',
  confirmPassword: '',
  sex: '',
  birthdate: '',
  heightCm: '',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The owner account is non-recoverable in-app (no "forgot password"), so the password must be
// entered twice and match before we let it through (B-004). The confirmation is a client guard
// only — the API still receives a single password.
export function credentialsValid(d: SetupDraft): boolean {
  return d.username.trim().length > 0 && d.password.length >= 8 && d.password === d.confirmPassword;
}

export function profileValid(d: SetupDraft): boolean {
  return d.sex !== '' && DATE_RE.test(d.birthdate) && Number(d.heightCm) > 0;
}

export function useSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SetupDraft>(EMPTY);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);

  const set = (patch: Partial<SetupDraft>): void => setDraft((d) => ({ ...d, ...patch }));

  async function create(): Promise<void> {
    if (submitting.current) return; // guard against a double submit racing the redirect
    if (!credentialsValid(draft) || !profileValid(draft)) return;
    submitting.current = true;
    setFailed(false);
    setPending(true);
    try {
      await authApi.setup({
        username: draft.username.trim(),
        password: draft.password,
        sex: draft.sex as Sex,
        birthdate: draft.birthdate,
        height_cm: Number(draft.heightCm),
      });
      // The owner now exists. Flip the cached first-run probe and route home in the same
      // synchronous tick so AppGate never sees the transient "setup done but still on
      // /setup" state (which its second rule would bounce to /login). Refresh the session
      // user afterwards (fire-and-forget — the home screen reads it on mount).
      queryClient.setQueryData(SETUP_STATE_KEY, { setup_required: false });
      void navigate('/');
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'setup_already_completed') {
        void navigate('/login');
        return;
      }
      setFailed(true);
    } finally {
      setPending(false);
      submitting.current = false;
    }
  }

  return {
    draft,
    set,
    step,
    next: () => setStep(1),
    back: () => setStep(0),
    create,
    pending,
    failed,
  };
}

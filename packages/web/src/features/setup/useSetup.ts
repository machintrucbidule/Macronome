import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Sex } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/auth';
import { targetApi } from '../../api/target';
import { SESSION_KEY } from '../../app/useSession';
import { SETUP_STATE_KEY } from '../../app/useSetupState';

// First-run wizard state (M8). Three steps — credentials, profile, then targets (B-059) —
// collected as a string draft; on submit the owner account is created, the session opened, the
// initial targets persisted, then we route home. If an owner already exists (409) the wizard
// hands off to /login.
export interface SetupDraft {
  username: string;
  password: string;
  confirmPassword: string;
  sex: Sex | '';
  birthdate: string;
  heightCm: string;
  calorieMin: string;
  calorieMax: string;
  proteinGPerKg: string;
  fatGPerKg: string;
}

// Sensible starting targets (B-059), pre-filled and editable. They mirror the Cibles guidance
// presets (protein "actif", fat "minimum") and a ~2000 kcal range.
const EMPTY: SetupDraft = {
  username: '',
  password: '',
  confirmPassword: '',
  sex: '',
  birthdate: '',
  heightCm: '',
  calorieMin: '1950',
  calorieMax: '2050',
  proteinGPerKg: '1.8',
  fatGPerKg: '0.8',
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

// The targets step (B-059) needs a valid calorie range and non-negative ratios before the owner
// account can be created. Mirrors the Cibles `isSavable` rule (min > 0, max ≥ min).
export function targetsValid(d: SetupDraft): boolean {
  const fields = [d.calorieMin, d.calorieMax, d.proteinGPerKg, d.fatGPerKg];
  if (fields.some((f) => f.trim() === '')) return false; // a blank field is not "0"
  const min = Number(d.calorieMin);
  const max = Number(d.calorieMax);
  const protein = Number(d.proteinGPerKg);
  const fat = Number(d.fatGPerKg);
  return (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min > 0 &&
    max >= min &&
    Number.isFinite(protein) &&
    protein >= 0 &&
    Number.isFinite(fat) &&
    fat >= 0
  );
}

// `inviteToken` switches the wizard to the invite-registration mode (B-193): same
// steps, but the submit posts /auth/register bound to the token, a dead link flips
// `deadLink` (the hosting InvitePage shows the error screen), and username_taken
// bounces back to the credentials step.
export function useSetup({ inviteToken }: { inviteToken?: string | undefined } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SetupDraft>(EMPTY);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deadLink, setDeadLink] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const submitting = useRef(false);

  const set = (patch: Partial<SetupDraft>): void => setDraft((d) => ({ ...d, ...patch }));

  // Server verdicts → wizard states (kept out of create() for readability/complexity).
  const onCreateError = (err: unknown): void => {
    const code = err instanceof ApiError ? err.code : '';
    if (code === 'setup_already_completed') void navigate('/login');
    else if (code === 'token_invalid')
      setDeadLink(true); // invite died mid-flow
    else if (code === 'username_taken') {
      setUsernameTaken(true);
      setStep(0); // back to the credentials step; the invite is not consumed
    } else setFailed(true);
  };

  async function create(): Promise<void> {
    if (submitting.current) return; // guard against a double submit racing the redirect
    if (!credentialsValid(draft) || !profileValid(draft) || !targetsValid(draft)) return;
    submitting.current = true;
    setFailed(false);
    setUsernameTaken(false);
    setPending(true);
    try {
      const fields = {
        username: draft.username.trim(),
        password: draft.password,
        sex: draft.sex as Sex,
        birthdate: draft.birthdate,
        height_cm: Number(draft.heightCm),
      };
      if (inviteToken) await authApi.register({ ...fields, token: inviteToken });
      else await authApi.setup(fields);
      // The account now exists and the session is open: persist the initial targets (B-059).
      // A failure here must not strand the owner on /setup — the account exists and targets stay
      // editable on Cibles — so we swallow it and still enter the app.
      try {
        await targetApi.create({
          calorie_min: Number(draft.calorieMin),
          calorie_max: Number(draft.calorieMax),
          protein_g_per_kg: Number(draft.proteinGPerKg),
          fat_g_per_kg: Number(draft.fatGPerKg),
          target_weight_kg: null,
          rate_kg_per_week: null,
          effective_from: new Date().toISOString().slice(0, 10),
        });
      } catch {
        // Non-blocking — the owner can set targets later on Cibles.
      }
      // The owner now exists. Flip the cached first-run probe and route home in the same
      // synchronous tick so AppGate never sees the transient "setup done but still on
      // /setup" state (which its second rule would bounce to /login). Refresh the session
      // user afterwards (fire-and-forget — the home screen reads it on mount).
      queryClient.setQueryData(SETUP_STATE_KEY, { setup_required: false });
      void navigate('/');
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    } catch (err) {
      onCreateError(err);
    } finally {
      setPending(false);
      submitting.current = false;
    }
  }

  return {
    draft,
    set,
    step,
    next: () => setStep((s) => Math.min(s + 1, 2)),
    back: () => setStep((s) => Math.max(s - 1, 0)),
    create,
    pending,
    failed,
    deadLink,
    usernameTaken,
  };
}

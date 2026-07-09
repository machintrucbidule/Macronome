import { describe, expect, it } from 'vitest';
import type {
  Cartouche,
  EngineReadout,
  JournalRow,
  MonthlyStat,
  Profile,
  TargetVersion,
} from '@macronome/shared';
import { buildAdviceMessages } from './assemble.js';
import { parseAdvice } from './parse.js';
import {
  buildAdvicePayload,
  sliceRecentJournal,
  windowStart,
  type AdvicePayload,
  type AdvicePayloadInputs,
} from './payload.js';

// B-202 neutral oracles (spec/logic/ai-advice.md §8): the pure payload shaping (30-day slice,
// all-history monthly pass-through, rounding), the prompt order + locale clause, and the trivial
// Markdown parse. No personal data.

const cartouche: Cartouche = {
  current: 80,
  delta_prev: -0.5,
  bmi: 24.7,
  bmi_category: 'normal',
  waist: 88,
  waist_delta: -1,
  gap_to_goal: 5,
  projection: { status: 'projected', date: '2026-12-01', days: 150 },
};

const engine: EngineReadout = {
  age: 40,
  bmr: 1730.4,
  current_weight_kg: 80,
  recent_avg_activity: 1.5,
  estimated_burn: 2460.6,
  empirical_burn: null,
  protein_floor_g: 140.2,
  fat_floor_g: 50.8,
  carb_ceiling_g: 150.5,
  deficit_at_target: -480.9,
  kg_per_week: -0.44,
  target_bmi: 23.1,
};

const profile: Profile = { sex: 'male', birthdate: '1986-01-01', height_cm: 180 };

function jRow(date: string, kcal: number, L: number, G: number, P: number): JournalRow {
  return {
    date,
    kcal,
    macros: { L, G, P },
    verdict_auto: 'OK',
    verdict_override: null,
    effective_verdict: 'OK',
    kcal_gap: 0,
    burn_gap: 0,
    activity_level: 'sedentary',
    comment: null,
    kind: 'detailed',
    state: 'green',
    editable_kcal: true,
  } as unknown as JournalRow;
}

const monthly: MonthlyStat[] = [
  { month: 4 } as unknown as MonthlyStat,
  { month: 5 } as unknown as MonthlyStat,
  { month: 6 } as unknown as MonthlyStat,
];

function inputs(over: Partial<AdvicePayloadInputs> = {}): AdvicePayloadInputs {
  return {
    today: '2026-06-30',
    profile,
    engine,
    target: null,
    targetHistory: [{ id: 't1' } as unknown as TargetVersion],
    cartouche,
    ema: [
      { date: '2026-06-01', value: 80.4 },
      { date: '2026-06-30', value: 79.9 },
    ],
    trajectory: [{ date: '2026-06-30', value: 79.5 }],
    periods: [],
    rolling: [],
    adherenceMonthly: monthly,
    adherenceKey: null,
    signals: [],
    records: null,
    journal: [],
    meals30d: [],
    ...over,
  };
}

describe('parseAdvice', () => {
  it('accepts plain Markdown (trimmed)', () => {
    expect(parseAdvice('  ## Bilan\n\nTu progresses bien.  ')).toEqual({
      ok: true,
      data: '## Bilan\n\nTu progresses bien.',
    });
  });
  it('strips an outer code fence', () => {
    expect(parseAdvice('```markdown\n## Bilan\n- point\n```')).toEqual({
      ok: true,
      data: '## Bilan\n- point',
    });
  });
  it('rejects an empty / whitespace reply', () => {
    expect(parseAdvice('   \n  ')).toEqual({ ok: false });
    expect(parseAdvice('```\n\n```')).toEqual({ ok: false });
  });
});

describe('sliceRecentJournal', () => {
  it('keeps only the last 30 days, oldest→newest, rounding kcal', () => {
    const rows = [
      jRow('2026-05-01', 2000.6, 60.4, 200, 150), // before the window
      jRow('2026-06-01', 1980.4, 55, 210, 140),
      jRow('2026-06-30', 2010.5, 58, 205, 145),
    ];
    expect(windowStart('2026-06-30')).toBe('2026-06-01'); // 30-day inclusive window
    const out = sliceRecentJournal(rows, '2026-06-30');
    expect(out.map((d) => d.date)).toEqual(['2026-06-01', '2026-06-30']);
    expect(out[0]).toMatchObject({ kcal: 1980, fat: 55, carb: 210, protein: 140, verdict: 'OK' });
  });
});

describe('buildAdvicePayload', () => {
  const payload: AdvicePayload = buildAdvicePayload(
    inputs({ journal: [jRow('2026-06-15', 1950.7, 50, 200, 130)] }),
  );

  it('rounds the engine figures and pulls sex/height from the profile', () => {
    expect(payload.profile_engine).toMatchObject({
      age: 40,
      sex: 'male',
      height_cm: 180,
      bmr: 1730,
      estimated_burn: 2461,
      protein_floor_g: 140,
      carb_ceiling_g: 151,
      target_bmi: 23.1,
    });
  });
  it('passes target history, all-history monthly, and last EMA/trajectory through', () => {
    expect(payload.target_history).toHaveLength(1);
    expect(payload.adherence.monthly).toHaveLength(3); // ALL months, not a window
    expect(payload.weight_body.ema_last).toBe(79.9);
    expect(payload.weight_body.trajectory_last).toBe(79.5);
  });
  it('slices the journal to the 30-day window', () => {
    expect(payload.journal_30d.map((d) => d.date)).toEqual(['2026-06-15']);
  });
});

describe('buildAdviceMessages', () => {
  it('orders scope → data → format → locale clause; language only in the clause', () => {
    const [msg] = buildAdviceMessages('SCOPE_PROMPT', buildAdvicePayload(inputs()), 'fr');
    const text = (msg!.content[0] as { text: string }).text;
    expect(text.indexOf('SCOPE_PROMPT')).toBe(0);
    expect(text.indexOf('TRACKING DATA')).toBeGreaterThan(0);
    expect(text.indexOf('Respond in Markdown only')).toBeGreaterThan(text.indexOf('TRACKING DATA'));
    expect(text.trimEnd().endsWith('Respond in French.')).toBe(true);
    // The scope prompt carries no language/format text (that lives in the clause + instruction).
    expect('SCOPE_PROMPT').not.toContain('French');
  });
  it('uses the English clause for locale en', () => {
    const [msg] = buildAdviceMessages('S', buildAdvicePayload(inputs()), 'en');
    expect(
      (msg!.content[0] as { text: string }).text.trimEnd().endsWith('Respond in English.'),
    ).toBe(true);
  });
});

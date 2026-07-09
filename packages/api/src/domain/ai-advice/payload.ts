import type {
  Cartouche,
  EngineReadout,
  JournalRow,
  KeyFigures,
  MonthlyStat,
  Period,
  Profile,
  RollingWindow,
  Signal,
  Target,
  TargetVersion,
  WeightRecords,
} from '@macronome/shared';

// Advice payload assembly (spec/logic/ai-advice.md §2.2 / §3). PURE: given the plain outputs the
// aggregator service already fetched (read-services + repos) plus `today`, shape the compact §2.2
// object that is BOTH the prompt context and the archived snapshot. No new nutrition maths (rule 2)
// — only slicing (last 30 days), re-packaging, and display rounding. Deterministic given the inputs.

const ADVICE_JOURNAL_DAYS = 30;
const r0 = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v));

/** One consumed meal food-line the coach can reason about (name + amount + macros). */
export interface AdviceMealLine {
  name: string;
  quantity: number;
  unit: string;
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}
export interface AdviceDayMeals {
  date: string;
  meals: { slot_name: string; lines: AdviceMealLine[] }[];
}
export interface AdviceJournalDay {
  date: string;
  kcal: number | null;
  fat: number | null;
  carb: number | null;
  protein: number | null;
  verdict: string | null;
  activity_level: string;
}

export interface AdvicePayload {
  profile_engine: {
    age: number | null;
    sex: string | null;
    height_cm: number | null;
    current_weight_kg: number | null;
    bmr: number | null;
    estimated_burn: number | null;
    empirical_burn: number | null;
    deficit_at_target: number | null;
    protein_floor_g: number | null;
    fat_floor_g: number | null;
    carb_ceiling_g: number | null;
    target_bmi: number | null;
  };
  current_target: Target | null;
  target_history: TargetVersion[];
  weight_body: {
    cartouche: Cartouche;
    ema_last: number | null;
    trajectory_last: number | null;
    periods: Period[];
  };
  rolling: RollingWindow[];
  adherence: {
    monthly: MonthlyStat[];
    key: KeyFigures | null;
    signals: Signal[];
    records: WeightRecords | null;
  };
  journal_30d: AdviceJournalDay[];
  meals_30d: AdviceDayMeals[];
}

export interface AdvicePayloadInputs {
  today: string; // YYYY-MM-DD
  profile: Profile | null;
  engine: EngineReadout;
  target: Target | null;
  targetHistory: TargetVersion[];
  cartouche: Cartouche;
  ema: { date: string; value: number }[];
  trajectory: { date: string; value: number }[];
  periods: Period[];
  rolling: RollingWindow[];
  adherenceMonthly: MonthlyStat[];
  adherenceKey: KeyFigures | null;
  signals: Signal[];
  records: WeightRecords | null;
  journal: JournalRow[]; // every logged day (any order)
  meals30d: AdviceDayMeals[]; // already sliced + name/consumed-resolved by the aggregator
}

/** Inclusive lower bound of the 30-day window ending at `today` (YYYY-MM-DD lexicographic-safe). */
export function windowStart(today: string, days = ADVICE_JOURNAL_DAYS): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/** The logged journal rows in [today−29, today], oldest→newest, mapped to the compact day shape. */
export function sliceRecentJournal(
  rows: JournalRow[],
  today: string,
  days = ADVICE_JOURNAL_DAYS,
): AdviceJournalDay[] {
  const from = windowStart(today, days);
  return rows
    .filter((r) => r.date >= from && r.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((r) => ({
      date: r.date,
      kcal: r0(r.kcal),
      fat: r0(r.macros?.L ?? null),
      carb: r0(r.macros?.G ?? null),
      protein: r0(r.macros?.P ?? null),
      verdict: r.effective_verdict,
      activity_level: r.activity_level,
    }));
}

const lastValue = (series: { value: number }[]): number | null =>
  series.length ? (series[series.length - 1]?.value ?? null) : null;

export function buildAdvicePayload(inp: AdvicePayloadInputs): AdvicePayload {
  return {
    profile_engine: {
      age: inp.engine.age,
      sex: inp.profile?.sex ?? null,
      height_cm: inp.profile?.height_cm ?? null,
      current_weight_kg: inp.engine.current_weight_kg,
      bmr: r0(inp.engine.bmr),
      estimated_burn: r0(inp.engine.estimated_burn),
      empirical_burn: r0(inp.engine.empirical_burn),
      deficit_at_target: r0(inp.engine.deficit_at_target),
      protein_floor_g: r0(inp.engine.protein_floor_g),
      fat_floor_g: r0(inp.engine.fat_floor_g),
      carb_ceiling_g: r0(inp.engine.carb_ceiling_g),
      target_bmi: inp.engine.target_bmi,
    },
    current_target: inp.target,
    target_history: inp.targetHistory,
    weight_body: {
      cartouche: inp.cartouche,
      ema_last: lastValue(inp.ema),
      trajectory_last: lastValue(inp.trajectory),
      periods: inp.periods,
    },
    rolling: inp.rolling,
    adherence: {
      monthly: inp.adherenceMonthly,
      key: inp.adherenceKey,
      signals: inp.signals,
      records: inp.records,
    },
    journal_30d: sliceRecentJournal(inp.journal, inp.today),
    meals_30d: inp.meals30d,
  };
}

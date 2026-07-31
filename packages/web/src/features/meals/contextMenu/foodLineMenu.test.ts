import { describe, expect, it, vi } from 'vitest';
import type { MealEntry } from '@macronome/shared';
import { buildFoodLineItems } from './foodLineMenu';

// B-195 — pure item builder for the Repas food-line context menu: owner-approved lists per
// line kind, "Déplacer vers" excludes the current meal, actions are wired with the right args.
const t = (k: string): string => k;
const meals = [
  { id: 'm1', slot_name: 'Déjeuner' },
  { id: 'm2', slot_name: 'Dîner' },
];

const makeActions = () => ({
  focusQty: vi.fn(),
  setQty: vi.fn(),
  startEdit: vi.fn(),
  openCustom: vi.fn(),
  togglePin: vi.fn(),
  deleteEntry: vi.fn(),
  moveEntry: vi.fn(),
});

const entry = (over: Partial<MealEntry>): MealEntry =>
  ({
    id: 'e1',
    kind: 'referenced',
    is_pinned: false,
    order_index: 2,
    served_quantity: 120,
    unit: 'g',
    portion_id: null,
    ...over,
  }) as MealEntry;

const build = (e: MealEntry | null, actions = makeActions()) => ({
  actions,
  result: buildFoodLineItems({
    mealId: 'm1',
    mealIndex: 0,
    row: 2,
    entry: e,
    meals,
    t,
    actions,
  }),
});

describe('buildFoodLineItems (B-195)', () => {
  it('referenced persisted line → qty · zero qty · change food · move ▸ · pin · delete', () => {
    const { result, actions } = build(entry({}));
    expect(result.items.map((i) => i.key)).toEqual([
      'qty',
      'zeroQty',
      'changeFood',
      'moveTo',
      'pin',
      'delete',
    ]);
    expect(result.appendGeneric).toBeUndefined();
    // "Déplacer vers" lists only the OTHER meals; picking one calls the B-187 move action.
    const moveTo = result.items.find((i) => i.key === 'moveTo');
    expect(moveTo?.children?.map((c) => c.label)).toEqual(['Dîner']);
    moveTo?.children?.[0]?.onSelect?.();
    expect(actions.moveEntry).toHaveBeenCalledWith('m1', 'e1', 'm2');
    result.items.find((i) => i.key === 'delete')?.onSelect?.();
    expect(actions.deleteEntry).toHaveBeenCalledWith('m1', 'e1');
    result.items.find((i) => i.key === 'qty')?.onSelect?.();
    expect(actions.focusQty).toHaveBeenCalledWith('e1');
  });

  it('pin label flips with the pinned state', () => {
    expect(
      build(entry({ is_pinned: false })).result.items.find((i) => i.key === 'pin')?.label,
    ).toBe('contextMenu.pin');
    expect(build(entry({ is_pinned: true })).result.items.find((i) => i.key === 'pin')?.label).toBe(
      'contextMenu.unpin',
    );
  });

  it('custom persisted line → edit · zero qty · move ▸ · delete (no pin, no qty focus)', () => {
    const { result, actions } = build(entry({ kind: 'custom' }));
    expect(result.items.map((i) => i.key)).toEqual(['edit', 'zeroQty', 'moveTo', 'delete']);
    result.items.find((i) => i.key === 'edit')?.onSelect?.();
    expect(actions.openCustom).toHaveBeenCalledWith('m1', 0, 'e1');
  });

  it('scaffold pre-fill line (empty id) → change food only', () => {
    const { result, actions } = build(entry({ id: '' }));
    expect(result.items.map((i) => i.key)).toEqual(['changeFood']);
    result.items[0]?.onSelect?.();
    expect(actions.startEdit).toHaveBeenCalledWith('m1', 0, '');
  });

  it('empty row → add here · manual values, then the generic block', () => {
    const { result, actions } = build(null);
    expect(result.items.map((i) => i.key)).toEqual(['add', 'manual']);
    expect(result.appendGeneric).toBe(true);
    result.items[0]?.onSelect?.();
    expect(actions.startEdit).toHaveBeenCalledWith('m1', 0, null, 2);
    result.items[1]?.onSelect?.();
    expect(actions.openCustom).toHaveBeenCalledWith('m1', 0, null, 2);
  });

  it('single-meal day: no "Déplacer vers" submenu', () => {
    const actions = makeActions();
    const result = buildFoodLineItems({
      mealId: 'm1',
      mealIndex: 0,
      row: 2,
      entry: entry({}),
      meals: meals.slice(0, 1),
      t,
      actions,
    });
    expect(result.items.some((i) => i.key === 'moveTo')).toBe(false);
  });
});

// B-249 — "Remettre à zéro": zero the served quantity from the menu that already gathers the
// line's actions, keeping the line itself. Shown disabled (never dropped) when already 0, so the
// items below never shift.
describe('buildFoodLineItems — remettre à zéro (B-249)', () => {
  it('zeroes the quantity, keeping the unit, the portion and the line', () => {
    const { result, actions } = build(entry({ unit: 'portion', portion_id: 'p1' }));
    const item = result.items.find((i) => i.key === 'zeroQty');
    expect(item?.disabled).toBeFalsy();

    item?.onSelect?.();
    expect(actions.setQty).toHaveBeenCalledWith(
      'm1',
      0,
      expect.objectContaining({ id: 'e1', unit: 'portion', portion_id: 'p1' }),
      0,
      'portion',
      'p1',
    );
    // Nothing destructive was wired to it.
    expect(actions.deleteEntry).not.toHaveBeenCalled();
    expect(actions.togglePin).not.toHaveBeenCalled();
  });

  it('is disabled — not removed — when the line is already at 0', () => {
    const { result } = build(entry({ served_quantity: 0 }));
    const keys = result.items.map((i) => i.key);
    expect(keys).toContain('zeroQty');
    // The position is unchanged between the two states: that is the point of disabling it.
    expect(keys).toEqual(['qty', 'zeroQty', 'changeFood', 'moveTo', 'pin', 'delete']);
    expect(result.items.find((i) => i.key === 'zeroQty')?.disabled).toBe(true);
  });

  it('is absent where nothing is persisted (scaffold pre-fill line, empty row)', () => {
    expect(build(entry({ id: '' })).result.items.map((i) => i.key)).not.toContain('zeroQty');
    expect(build(null).result.items.map((i) => i.key)).not.toContain('zeroQty');
  });
});

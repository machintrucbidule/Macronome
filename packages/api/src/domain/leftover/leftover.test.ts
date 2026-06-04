import { expect, test } from 'vitest';
import { netLeftover, prorateConsumed, scaleMacros, validate } from './leftover.js';

// Neutral CI oracle — the canonical plate from spec/logic/leftover-proration.md §8–9.
const round1 = (n: number): number => Number(n.toFixed(1));

test('canonical plate: net 100 over 1000 served → consumed 450/270/180, ×0.9 (§8)', () => {
  const served = { A: 500, B: 300, C: 200 };
  const servedTotal = served.A + served.B + served.C; // 1000
  const net = netLeftover(508, 408); // 100
  expect(net).toBe(100);
  expect(validate(net, servedTotal)).toEqual({ ok: true });

  const consumedA = prorateConsumed(served.A, net, servedTotal);
  const consumedB = prorateConsumed(served.B, net, servedTotal);
  const consumedC = prorateConsumed(served.C, net, servedTotal);
  expect(round1(consumedA)).toBe(450);
  expect(round1(consumedB)).toBe(270);
  expect(round1(consumedC)).toBe(180);

  // Each selected line's macros scale by consumed/served = 0.9.
  const snap = { kcal: 1000, fat: 100, carb: 100, protein: 100 };
  const scaled = scaleMacros(snap, consumedA, served.A);
  expect(round1(scaled.kcal)).toBe(900);
  expect(round1(scaled.fat)).toBe(90);
});

test('a line not in any group is fully consumed (Side D 125 untouched)', () => {
  expect(prorateConsumed(125, 0, 1000)).toBe(125);
});

test('block: gross < tare → gross_below_tare, nothing prorated (§9)', () => {
  const net = netLeftover(300, 408); // −108
  expect(validate(net, 1000)).toEqual({ ok: false, code: 'gross_below_tare' });
});

test('block: net > served_total → leftover_exceeds_served (§9)', () => {
  const net = netLeftover(1500, 408); // 1092
  expect(validate(net, 1000)).toEqual({ ok: false, code: 'leftover_exceeds_served' });
});

test('re-edit recomputes consumed from retained served (a smaller net = more eaten)', () => {
  // Same plate re-opened with gross 458 → net 50 → consumed A 475 (×0.95).
  const net = netLeftover(458, 408);
  expect(net).toBe(50);
  expect(round1(prorateConsumed(500, net, 1000))).toBe(475);
});

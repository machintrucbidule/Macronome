import { describe, expect, test } from 'vitest';
import { evalQuantity } from './parse';

// Arithmetic quantity input (B-108): evaluate on commit, store the result; invalid → null.

describe('evalQuantity', () => {
  test('evaluates the four operators, parens and precedence', () => {
    expect(evalQuantity('950/2')).toBe(475);
    expect(evalQuantity('1,5*2')).toBe(3); // French decimal comma
    expect(evalQuantity('(1+2)*3')).toBe(9);
    expect(evalQuantity('10-3')).toBe(7);
    expect(evalQuantity('2*3+4')).toBe(10); // precedence
  });

  test('passes plain numbers through (incl. comma decimal)', () => {
    expect(evalQuantity('250')).toBe(250);
    expect(evalQuantity('1,5')).toBe(1.5);
    expect(evalQuantity('  42  ')).toBe(42);
  });

  test('empty input is 0 (clears the field)', () => {
    expect(evalQuantity('')).toBe(0);
    expect(evalQuantity('   ')).toBe(0);
  });

  test('rejects invalid input → null', () => {
    expect(evalQuantity('abc')).toBeNull();
    expect(evalQuantity('5/')).toBeNull();
    expect(evalQuantity('1.2.3')).toBeNull();
    expect(evalQuantity('5/0')).toBeNull(); // division by zero → not finite
    expect(evalQuantity('(1+2')).toBeNull();
    expect(evalQuantity('2**3')).toBeNull();
  });
});

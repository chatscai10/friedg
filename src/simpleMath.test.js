import { describe, it, expect } from 'vitest';
import { add, multiply } from './simpleMath';

describe('算術函數測試', () => {
  it('add 函數可以正確相加兩個數', () => {
    expect(add(1, 2)).toBe(3);
    expect(add(-1, 1)).toBe(0);
    expect(add(5, 3)).toBe(8);
  });

  it('multiply 函數可以正確相乘兩個數', () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(-2, 3)).toBe(-6);
    expect(multiply(0, 5)).toBe(0);
  });
});

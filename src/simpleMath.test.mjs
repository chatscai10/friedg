import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { add, multiply } from './simpleMath.js';

describe('算術函數測試', () => {
  it('add 函數可以正確相加兩個數', () => {
    assert.equal(add(1, 2), 3);
    assert.equal(add(-1, 1), 0);
    assert.equal(add(5, 3), 8);
  });

  it('multiply 函數可以正確相乘兩個數', () => {
    assert.equal(multiply(2, 3), 6);
    assert.equal(multiply(-2, 3), -6);
    assert.equal(multiply(0, 5), 0);
  });
}); 
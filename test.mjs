import { strict as assert } from 'node:assert';

// 簡單的函數測試
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

// 測試 add 函數
console.log('測試 add 函數...');
assert.equal(add(1, 2), 3, '1 + 2 應該等於 3');
assert.equal(add(-1, 1), 0, '-1 + 1 應該等於 0');
assert.equal(add(5, 3), 8, '5 + 3 應該等於 8');
console.log('add 函數測試通過！');

// 測試 multiply 函數
console.log('測試 multiply 函數...');
assert.equal(multiply(2, 3), 6, '2 * 3 應該等於 6');
assert.equal(multiply(-2, 3), -6, '-2 * 3 應該等於 -6');
assert.equal(multiply(0, 5), 0, '0 * 5 應該等於 0');
console.log('multiply 函數測試通過！');

console.log('所有測試已成功通過！'); 
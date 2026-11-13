import assert from 'node:assert/strict';
import test from 'node:test';
import { INPUT_LIMITS, INPUT_PATTERNS, sanitizeInputValue } from '../src/constants/inputLimits.ts';

test('ingredient names preserve supported Unicode characters and remove invalid pasted characters', () => {
  const value = sanitizeInputValue('Café 🍗  Chicken+', 'ingredientName');

  assert.equal(value, 'Café Chicken');
  assert.equal(INPUT_PATTERNS.ingredientName.test(value), true);
  assert.equal(value.length <= INPUT_LIMITS.ingredientName.max, true);
});

test('numeric filters reject signs, letters, and extra decimal places', () => {
  assert.equal(sanitizeInputValue('1e+2', 'inventoryQuantity'), '12');
  assert.equal(sanitizeInputValue('12.3456', 'inventoryQuantity'), '12.345');
  assert.equal(sanitizeInputValue('-12.999', 'amount'), '12.99');
});

test('promo codes are uppercased and limited to supported characters', () => {
  assert.equal(sanitizeInputValue('save-10%!', 'promoCode'), 'SAVE-10');
});

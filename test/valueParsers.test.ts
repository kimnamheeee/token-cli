import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSupportedTokenGroup,
  parseColorValue,
  parseDeclarationValue,
  parseSpacingValue,
} from '../src/utils/valueParsers.js';

test('getSupportedTokenGroup maps supported properties to token groups', () => {
  assert.equal(getSupportedTokenGroup('color'), 'color');
  assert.equal(getSupportedTokenGroup('paddingTop'), 'spacing');
  assert.equal(getSupportedTokenGroup('borderRadius'), 'radius');
  assert.equal(getSupportedTokenGroup('fontSize'), null);
});

test('parseColorValue normalizes supported color formats', () => {
  assert.equal(parseColorValue(' #FFAA00 '), '#ffaa00');
  assert.equal(parseColorValue('rgb(255, 0, 0)'), 'rgb(255, 0, 0)');
  assert.equal(parseColorValue('hsla(10, 20%, 30%, 0.5)'), 'hsla(10, 20%, 30%, 0.5)');
  assert.equal(parseColorValue('var(--color-primary)'), null);
});

test('parseSpacingValue handles numeric and unit-based spacing values', () => {
  assert.equal(parseSpacingValue('16px', 'string'), '16');
  assert.equal(parseSpacingValue(' 1.5rem ', 'string'), '1.5rem');
  assert.equal(parseSpacingValue('8', 'number'), '8');
  assert.equal(parseSpacingValue('12px', 'number'), null);
  assert.equal(parseSpacingValue('auto', 'string'), null);
});

test('parseDeclarationValue ignores unsupported properties and parses supported ones', () => {
  assert.deepEqual(
    parseDeclarationValue({
      property: 'borderRadius',
      rawValue: '12px',
      valueType: 'string',
      line: 1,
      column: 1,
    }),
    {
      tokenGroup: 'radius',
      normalizedValue: '12',
    },
  );

  assert.equal(
    parseDeclarationValue({
      property: 'fontSize',
      rawValue: '16px',
      valueType: 'string',
      line: 1,
      column: 1,
    }),
    null,
  );
});

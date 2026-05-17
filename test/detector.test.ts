import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectHardcodedValues,
  detectHardcodedValuesInBlock,
} from '../src/detector/detectHardcodedValues.js';
import type { InlineStyleBlock } from '../src/types/index.js';

const block: InlineStyleBlock = {
  filePath: 'sample.tsx',
  line: 2,
  column: 4,
  declarations: [
    {
      property: 'color',
      rawValue: '#FF0000',
      valueType: 'string',
      line: 2,
      column: 10,
    },
    {
      property: 'paddingTop',
      rawValue: '16px',
      valueType: 'string',
      line: 3,
      column: 10,
    },
    {
      property: 'fontSize',
      rawValue: '14px',
      valueType: 'string',
      line: 4,
      column: 10,
    },
  ],
};

test('detectHardcodedValuesInBlock keeps only supported declarations with normalized values', () => {
  const detected = detectHardcodedValuesInBlock(block);

  assert.deepEqual(detected, [
    {
      filePath: 'sample.tsx',
      line: 2,
      column: 10,
      property: 'color',
      rawValue: '#FF0000',
      normalizedValue: '#ff0000',
      valueType: 'string',
      tokenGroup: 'color',
    },
    {
      filePath: 'sample.tsx',
      line: 3,
      column: 10,
      property: 'paddingTop',
      rawValue: '16px',
      normalizedValue: '16',
      valueType: 'string',
      tokenGroup: 'spacing',
    },
  ]);
});

test('detectHardcodedValues flattens detection results across blocks', () => {
  const detected = detectHardcodedValues([
    block,
    {
      ...block,
      filePath: 'other.tsx',
      declarations: [
        {
          property: 'borderRadius',
          rawValue: '12',
          valueType: 'number',
          line: 1,
          column: 1,
        },
      ],
    },
  ]);

  assert.equal(detected.length, 3);
  assert.equal(detected[2]?.tokenGroup, 'radius');
});

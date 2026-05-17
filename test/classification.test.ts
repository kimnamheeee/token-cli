import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyIssues } from '../src/classifier/classifyIssues.js';
import {
  findExactMatchingTokens,
  matchTokens,
} from '../src/matcher/matchTokens.js';
import type {
  DetectedHardcodedValue,
  LoadedTokens,
  TokenRecord,
} from '../src/types/index.js';

function createRecord(
  id: string,
  normalizedResolvedValue: string,
  type: TokenRecord['type'],
): TokenRecord {
  return {
    id,
    path: id.split('.'),
    rawValue: normalizedResolvedValue,
    resolvedValue: normalizedResolvedValue,
    normalizedResolvedValue,
    type,
    level: 'semantic',
    source: '<test>',
  };
}

function createLoadedTokens(records: TokenRecord[]): LoadedTokens {
  return {
    sourcePath: '<test>',
    tree: {},
    records,
    recordsById: new Map(records.map((record) => [record.id, record])),
    recordsByNormalizedValue: new Map([
      ['#ff0000', records.filter((record) => record.normalizedResolvedValue === '#ff0000')],
      ['8', records.filter((record) => record.normalizedResolvedValue === '8')],
      ['12', records.filter((record) => record.normalizedResolvedValue === '12')],
    ]),
    entries: [],
    entriesByPath: new Map(),
    entriesByNormalizedValue: new Map(),
  };
}

function createDetectedValue(
  overrides: Partial<DetectedHardcodedValue> = {},
): DetectedHardcodedValue {
  return {
    filePath: 'sample.tsx',
    line: 3,
    column: 10,
    property: 'color',
    rawValue: '#ff0000',
    normalizedValue: '#ff0000',
    valueType: 'string',
    tokenGroup: 'color',
    ...overrides,
  };
}

test('findExactMatchingTokens filters by normalized value and token group', () => {
  const tokens = createLoadedTokens([
    createRecord('semantic.color.text.primary', '#ff0000', 'color'),
    createRecord('semantic.spacing.md', '#ff0000', 'spacing'),
  ]);

  const matches = findExactMatchingTokens(createDetectedValue(), tokens);

  assert.deepEqual(matches.map((match) => match.id), ['semantic.color.text.primary']);
});

test('matchTokens returns only deterministic exact matches', () => {
  const tokens = createLoadedTokens([
    createRecord('semantic.color.text.primary', '#ff0000', 'color'),
    createRecord('semantic.color.icon.primary', '#ff0000', 'color'),
    createRecord('semantic.spacing.md', '8', 'spacing'),
  ]);

  const matches = matchTokens(
    [
      createDetectedValue(),
      createDetectedValue({
        property: 'padding',
        rawValue: '8',
        normalizedValue: '8',
        valueType: 'number',
        tokenGroup: 'spacing',
      }),
    ],
    tokens,
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.suggestion, 'semantic.spacing.md');
});

test('classifyIssues splits values into deterministic, ambiguous, no-candidate, and unsupported', () => {
  const tokens = createLoadedTokens([
    createRecord('semantic.color.text.primary', '#ff0000', 'color'),
    createRecord('semantic.color.icon.primary', '#ff0000', 'color'),
    createRecord('semantic.spacing.md', '8', 'spacing'),
  ]);

  const classified = classifyIssues(
    [
      createDetectedValue({
        property: 'padding',
        rawValue: '8',
        normalizedValue: '8',
        valueType: 'number',
        tokenGroup: 'spacing',
      }),
      createDetectedValue(),
      createDetectedValue({
        rawValue: '#00ff00',
        normalizedValue: '#00ff00',
      }),
      createDetectedValue({
        property: 'borderRadius',
        rawValue: '12',
        normalizedValue: '12',
        tokenGroup: 'radius',
      }),
    ],
    tokens,
  );

  assert.equal(classified.deterministic.length, 1);
  assert.equal(classified.deterministic[0]?.suggestion, 'semantic.spacing.md');

  assert.equal(classified.ambiguous.length, 1);
  assert.deepEqual(classified.ambiguous[0]?.candidates, [
    'semantic.color.text.primary',
    'semantic.color.icon.primary',
  ]);

  assert.equal(classified.noCandidate.length, 1);
  assert.match(
    classified.noCandidate[0]?.reason ?? '',
    /no token with the same normalized value/i,
  );

  assert.equal(classified.unsupported.length, 1);
  assert.match(classified.unsupported[0]?.reason ?? '', /radius token category/i);
});

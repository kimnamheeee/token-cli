import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyIssues } from '../src/classifier/classifyIssues.js';
import {
  findExactMatchingTokens,
  matchTokens,
} from '../src/matcher/matchTokens.js';
import { rankTokenCandidates } from '../src/matcher/rankTokenCandidates.js';
import type {
  DetectedHardcodedValue,
  LoadedTokens,
  TokenRecord,
} from '../src/types/index.js';

function createRecord(
  id: string,
  normalizedResolvedValue: string,
  type: TokenRecord['type'],
  overrides: Partial<TokenRecord> = {},
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
    ...overrides,
  };
}

function groupRecordsByNormalizedValue(
  records: TokenRecord[],
): Map<string, TokenRecord[]> {
  const recordsByNormalizedValue = new Map<string, TokenRecord[]>();

  for (const record of records) {
    const bucket = recordsByNormalizedValue.get(record.normalizedResolvedValue);

    if (bucket) {
      bucket.push(record);
      continue;
    }

    recordsByNormalizedValue.set(record.normalizedResolvedValue, [record]);
  }

  return recordsByNormalizedValue;
}

function createLoadedTokens(records: TokenRecord[]): LoadedTokens {
  return {
    sourcePath: '<test>',
    tree: {},
    records,
    recordsById: new Map(records.map((record) => [record.id, record])),
    recordsByNormalizedValue: groupRecordsByNormalizedValue(records),
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

test('rankTokenCandidates prioritizes property role matches over raw primitive tokens', () => {
  const candidates = [
    createRecord('primitive.color.slate900', '#ff0000', 'color', {
      level: 'primitive',
    }),
    createRecord('semantic.color.text.primary', '#ff0000', 'color', {
      aliasOf: 'primitive.color.slate900',
    }),
    createRecord('semantic.color.surface.default', '#ff0000', 'color', {
      aliasOf: 'primitive.color.slate900',
    }),
  ];

  const rankedCandidates = rankTokenCandidates(createDetectedValue(), candidates);

  assert.deepEqual(
    rankedCandidates.map((candidate) => candidate.id),
    [
      'semantic.color.text.primary',
      'semantic.color.surface.default',
      'primitive.color.slate900',
    ],
  );
  assert.ok(rankedCandidates[0]?.score ?? 0 > (rankedCandidates[1]?.score ?? 0));
  assert.match(rankedCandidates[0]?.reasons.join(' ') ?? '', /color role keyword/i);
});

test('rankTokenCandidates uses component context without making component tokens globally preferred', () => {
  const candidates = [
    createRecord('semantic.color.surface.default', '#ff0000', 'color', {
      aliasOf: 'primitive.color.white',
    }),
    createRecord('component.card.default.backgroundColor', '#ff0000', 'color', {
      level: 'component',
      aliasOf: 'semantic.color.surface.default',
      metadata: {
        component: 'card',
        role: 'backgroundColor',
      },
    }),
  ];

  const productCardRanking = rankTokenCandidates(
    createDetectedValue({
      filePath: 'ProductCard.tsx',
      property: 'backgroundColor',
    }),
    candidates,
  );

  assert.equal(
    productCardRanking[0]?.id,
    'component.card.default.backgroundColor',
  );
  assert.match(productCardRanking[0]?.reasons.join(' ') ?? '', /file context/i);

  const unrelatedRanking = rankTokenCandidates(
    createDetectedValue({
      filePath: 'SettingsPanel.tsx',
      property: 'backgroundColor',
    }),
    candidates,
  );

  assert.equal(unrelatedRanking[0]?.id, 'semantic.color.surface.default');
});

test('classifyIssues attaches ranked candidates without changing ambiguous classification', () => {
  const tokens = createLoadedTokens([
    createRecord('primitive.color.slate900', '#ff0000', 'color', {
      level: 'primitive',
    }),
    createRecord('semantic.color.text.primary', '#ff0000', 'color', {
      aliasOf: 'primitive.color.slate900',
    }),
  ]);

  const classified = classifyIssues([createDetectedValue()], tokens);

  assert.equal(classified.ambiguous.length, 1);
  assert.deepEqual(classified.ambiguous[0]?.candidates, [
    'primitive.color.slate900',
    'semantic.color.text.primary',
  ]);
  assert.deepEqual(
    classified.ambiguous[0]?.rankedCandidates?.map((candidate) => candidate.id),
    [
      'semantic.color.text.primary',
      'primitive.color.slate900',
    ],
  );
});

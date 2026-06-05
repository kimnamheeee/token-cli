import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClassifiedReportSummary } from '../src/reporter/buildReportSummary.js';
import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
} from '../src/types/index.js';

function createDetectedValue(
  overrides: Partial<DetectedHardcodedValue> = {},
): DetectedHardcodedValue {
  return {
    filePath: 'src/Button.tsx',
    line: 10,
    column: 5,
    property: 'color',
    rawValue: '#ff0000',
    normalizedValue: '#ff0000',
    valueType: 'string',
    tokenGroup: 'color',
    ...overrides,
  };
}

function createAmbiguousIssue(
  overrides: Partial<AmbiguousTokenMatch> = {},
): AmbiguousTokenMatch {
  return {
    ...createDetectedValue(),
    case: 'ambiguous',
    candidates: ['semantic.color.text.primary', 'primitive.color.red500'],
    rankedCandidates: [
      {
        id: 'semantic.color.text.primary',
        score: 45,
        reasons: ['matches color role keyword: text'],
      },
      {
        id: 'primitive.color.red500',
        score: 15,
        reasons: ['primitive token is a fallback candidate'],
      },
    ],
    reason: 'multiple token candidates were found',
    ...overrides,
  };
}

test('buildClassifiedReportSummary returns counts, hotspots, and prioritized recommendations', () => {
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [
      {
        ...createDetectedValue({
          filePath: 'src/Button.tsx',
          line: 20,
          property: 'padding',
          rawValue: '8',
          normalizedValue: '8',
          valueType: 'number',
          tokenGroup: 'spacing',
        }),
        case: 'deterministic',
        suggestion: 'semantic.spacing.md',
        reason: 'single exact token candidate was found',
      },
    ],
    ambiguous: [
      createAmbiguousIssue(),
      createAmbiguousIssue({
        filePath: 'src/Card.tsx',
        line: 3,
        property: 'backgroundColor',
        rankedCandidates: [
          {
            id: 'semantic.color.surface.default',
            score: 35,
            reasons: ['matches color role keyword: surface'],
          },
          {
            id: 'primitive.color.red500',
            score: 30,
            reasons: ['primitive token is a fallback candidate'],
          },
        ],
      }),
    ],
    noCandidate: [
      {
        ...createDetectedValue({
          filePath: 'src/Button.tsx',
          line: 30,
          rawValue: '#00ff00',
          normalizedValue: '#00ff00',
        }),
        case: 'no-candidate',
        reason: 'no token with the same normalized value was found',
      },
    ],
    unsupported: [],
  };

  const summary = buildClassifiedReportSummary(classifiedIssues, {
    recommendationLimit: 2,
  });

  assert.equal(summary.totalIssues, 4);
  assert.deepEqual(summary.cases, {
    deterministic: 1,
    ambiguous: 2,
    'no-candidate': 1,
    unsupported: 0,
  });
  assert.deepEqual(summary.confidence, {
    high: 1,
    medium: 0,
    low: 1,
  });
  assert.deepEqual(summary.decisions, {
    'safe-replacement': 2,
    ambiguous: 1,
    unknown: 1,
    unsupported: 0,
  });
  assert.deepEqual(summary.severity, {
    error: 2,
    warning: 1,
    info: 0,
    unknown: 1,
  });
  assert.deepEqual(summary.hotspots.files[0], {
    value: 'src/Button.tsx',
    count: 3,
  });
  assert.deepEqual(summary.hotspots.values[0], {
    value: '#ff0000',
    count: 2,
  });
  assert.equal(
    summary.recommendations[0]?.token,
    'semantic.color.text.primary',
  );
  assert.equal(summary.recommendations[0]?.confidence, 'high');
  assert.equal(summary.recommendations[1]?.token, 'semantic.spacing.md');
  assert.equal(summary.recommendations[1]?.confidence, 'high');
  assert.equal(summary.reportDecisions.length, 4);

  const limitedSummary = buildClassifiedReportSummary(classifiedIssues, {
    recommendationLimit: 1,
  });

  assert.equal(limitedSummary.recommendations.length, 1);
  assert.deepEqual(limitedSummary.confidence, {
    high: 1,
    medium: 0,
    low: 1,
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReportDecisions } from '../src/reporter/buildReportDecisions.js';
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
    rawValue: '#ffffff',
    normalizedValue: '#ffffff',
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
    candidates: [
      'semantic.color.text.inverse',
      'semantic.color.icon.inverse',
      'primitive.color.white',
      'component.card.default.color',
    ],
    rankedCandidates: [
      {
        id: 'semantic.color.text.inverse',
        score: 45,
        reasons: ['matches color role keyword: text'],
      },
      {
        id: 'semantic.color.icon.inverse',
        score: 15,
        reasons: ['semantic token is preferred over raw primitive tokens'],
      },
      {
        id: 'primitive.color.white',
        score: 0,
        reasons: ['primitive token is a fallback candidate'],
      },
      {
        id: 'component.card.default.color',
        score: -10,
        reasons: ['component token does not match the file context'],
      },
    ],
    reason: 'multiple token candidates were found',
    ...overrides,
  };
}

test('buildReportDecisions separates safe, ambiguous, unknown, and unsupported decisions', () => {
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [
      {
        ...createDetectedValue({
          filePath: 'src/Spacing.tsx',
          line: 2,
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
        line: 8,
        rankedCandidates: [
          {
            id: 'semantic.color.text.inverse',
            score: 30,
            reasons: ['matches color role keyword: text'],
          },
          {
            id: 'semantic.color.text.default',
            score: 26,
            reasons: ['matches color role keyword: text'],
          },
          {
            id: 'semantic.color.icon.inverse',
            score: 24,
            reasons: ['semantic token is preferred over raw primitive tokens'],
          },
          {
            id: 'primitive.color.white',
            score: 0,
            reasons: ['primitive token is a fallback candidate'],
          },
        ],
      }),
    ],
    noCandidate: [
      {
        ...createDetectedValue({
          filePath: 'src/Banner.tsx',
          line: 4,
          rawValue: '#f7f2d9',
          normalizedValue: '#f7f2d9',
        }),
        case: 'no-candidate',
        reason: 'no token with the same normalized value was found',
      },
    ],
    unsupported: [
      {
        ...createDetectedValue({
          filePath: 'src/Shadow.tsx',
          line: 6,
        }),
        case: 'unsupported',
        reason: 'detected, but unsupported',
      },
    ],
  };

  const decisions = buildReportDecisions(classifiedIssues);
  const safeDecisions = decisions.filter(
    (decision) => decision.decision === 'safe-replacement',
  );
  const ambiguousDecisions = decisions.filter(
    (decision) => decision.decision === 'ambiguous',
  );

  assert.equal(safeDecisions.length, 2);
  assert.equal(ambiguousDecisions.length, 1);
  assert.equal(ambiguousDecisions[0]?.topCandidates.length, 3);
  assert.equal(ambiguousDecisions[0]?.severity, 'warning');
  assert.deepEqual(ambiguousDecisions[0]?.missingContext, [
    'strong property or component context',
    'clear score separation between candidates',
    'narrower semantic intent',
  ]);
  assert.equal(
    decisions.find((decision) => decision.decision === 'unknown')?.severity,
    'unknown',
  );
  assert.equal(
    decisions.find((decision) => decision.decision === 'unsupported')?.severity,
    'info',
  );
});

test('buildReportDecisions marks primitive-only replacements as info', () => {
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [
      {
        ...createDetectedValue({
          property: 'padding',
          rawValue: '28',
          normalizedValue: '28',
          valueType: 'number',
          tokenGroup: 'spacing',
        }),
        case: 'deterministic',
        suggestion: 'primitive.spacing.28',
        reason: 'single exact token candidate was found',
      },
    ],
    ambiguous: [],
    noCandidate: [],
    unsupported: [],
  };

  const [decision] = buildReportDecisions(classifiedIssues);

  assert.equal(decision?.decision, 'safe-replacement');
  assert.equal(decision?.severity, 'info');
  assert.equal(decision?.message, 'single primitive fallback candidate');
});

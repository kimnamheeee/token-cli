import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  exportClassifiedJsonReport,
  exportDetectionJsonReport,
} from '../src/reporter/exportJsonReport.js';
import type {
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
    property: 'borderRadius',
    rawValue: '12',
    normalizedValue: '12',
    valueType: 'string',
    tokenGroup: 'radius',
    ...overrides,
  };
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

test('exportDetectionJsonReport writes summary and detected issues', () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), 'token-validator-test-'));
  const outputPath = path.join(outputDir, 'detection.json');

  const resolvedPath = exportDetectionJsonReport({
    targetPath: './src',
    detectedValues: [createDetectedValue()],
    outputPath,
  });

  const report = readJson(resolvedPath);

  assert.equal(report.target, './src');
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].case, 'detected');
  assert.equal(report.issues[0].value, '12');
  assert.equal(report.issues[0].property, 'borderRadius');
  assert.equal(report.summary, undefined);
});

test('exportClassifiedJsonReport writes sorted issues with classification metadata', () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), 'token-validator-test-'));
  const outputPath = path.join(outputDir, 'classified.json');

  const deterministic = createDetectedValue({
    filePath: 'src/B.tsx',
    line: 20,
    column: 2,
    property: 'padding',
    rawValue: '8',
    normalizedValue: '8',
    valueType: 'number',
    tokenGroup: 'spacing',
  });

  const ambiguous = createDetectedValue({
    filePath: 'src/A.tsx',
    line: 5,
    column: 1,
    property: 'color',
    rawValue: '#ff0000',
    normalizedValue: '#ff0000',
    tokenGroup: 'color',
  });
  const noCandidate = createDetectedValue({
    filePath: 'src/C.tsx',
    line: 30,
    column: 4,
    property: 'padding',
    rawValue: '14',
    normalizedValue: '14',
    valueType: 'number',
    tokenGroup: 'spacing',
  });

  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [
      {
        ...deterministic,
        case: 'deterministic',
        suggestion: 'semantic.spacing.md',
        reason: 'exactly one matching token was found',
      },
    ],
    ambiguous: [
      {
        ...ambiguous,
        case: 'ambiguous',
        candidates: [
          'semantic.color.text.primary',
          'semantic.color.icon.primary',
        ],
        rankedCandidates: [
          {
            id: 'semantic.color.text.primary',
            score: 45,
            reasons: [
              'matches color role keyword: text',
              'token aliases another token instead of using a raw primitive value',
            ],
            intentSignals: ['property-role', 'token-alias'],
          },
          {
            id: 'semantic.color.icon.primary',
            score: 15,
            reasons: ['semantic token is preferred over raw primitive tokens'],
          },
        ],
        reason: 'multiple token candidates were found',
      },
    ],
    noCandidate: [
      {
        ...noCandidate,
        case: 'no-candidate',
        reason: 'no token with the same normalized value was found',
        diagnostics: {
          tokenGroup: 'spacing',
          suggestedAction: 'review-value',
          nearbyCandidates: [
            {
              id: 'semantic.spacing.md',
              score: 98,
              kind: 'adjacent-scale-value',
              reviewOnly: true,
              distance: 2,
              scaleStepsAway: 1,
              reasons: [
                'spacing scale is adjacent to 16',
                'nearby candidate only; not an exact replacement',
              ],
            },
          ],
        },
      },
    ],
    unsupported: [],
  };

  const resolvedPath = exportClassifiedJsonReport({
    targetPath: './src',
    classifiedIssues,
    outputPath,
  });

  const report = readJson(resolvedPath);

  assert.equal(report.issues.length, 3);
  assert.equal(report.details.length, 3);
  assert.equal(report.summary.totalIssues, 3);
  assert.deepEqual(report.summary.cases, {
    deterministic: 1,
    ambiguous: 1,
    'no-candidate': 1,
    unsupported: 0,
  });
  assert.deepEqual(report.summary.confidence, {
    high: 1,
    medium: 0,
    low: 0,
  });
  assert.deepEqual(report.summary.decisions, {
    'safe-replacement': 2,
    ambiguous: 0,
    unknown: 1,
    unsupported: 0,
  });
  assert.deepEqual(report.summary.severity, {
    error: 2,
    warning: 0,
    info: 0,
    unknown: 1,
  });
  assert.deepEqual(report.hotspots.files, [
    {
      value: 'src/A.tsx',
      count: 1,
    },
    {
      value: 'src/B.tsx',
      count: 1,
    },
    {
      value: 'src/C.tsx',
      count: 1,
    },
  ]);
  assert.equal(report.recommendations[0].token, 'semantic.color.text.primary');
  assert.equal(report.decisions.length, 3);
  assert.equal(report.decisions[0].decision, 'safe-replacement');
  assert.equal(report.decisions[0].severity, 'error');
  assert.deepEqual(
    report.decisions[0].topCandidates.map(
      (candidate: { id: string }) => candidate.id,
    ),
    ['semantic.color.text.primary', 'semantic.color.icon.primary'],
  );
  assert.equal(report.issues[0].file, 'src/A.tsx');
  assert.equal(report.issues[0].value, '#ff0000');
  assert.deepEqual(report.issues[0].candidates, [
    'semantic.color.text.primary',
    'semantic.color.icon.primary',
  ]);
  assert.deepEqual(report.issues[0].rankedCandidates, [
    {
      id: 'semantic.color.text.primary',
      score: 45,
      reasons: [
        'matches color role keyword: text',
        'token aliases another token instead of using a raw primitive value',
      ],
      intentSignals: ['property-role', 'token-alias'],
    },
    {
      id: 'semantic.color.icon.primary',
      score: 15,
      reasons: ['semantic token is preferred over raw primitive tokens'],
    },
  ]);
  assert.equal(report.issues[1].token, 'semantic.spacing.md');
  assert.equal(report.issues[1].value, '8');
  assert.equal(report.issues[2].case, 'no-candidate');
  assert.equal(report.issues[2].diagnostics.suggestedAction, 'review-value');
  assert.equal(
    report.issues[2].diagnostics.nearbyCandidates[0].id,
    'semantic.spacing.md',
  );
  assert.equal(report.token_source, undefined);
});

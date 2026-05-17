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
    blockCount: 2,
    detectedValues: [createDetectedValue()],
    outputPath,
  });

  const report = readJson(resolvedPath);

  assert.equal(report.target, './src');
  assert.equal(report.summary.inline_style_blocks, 2);
  assert.equal(report.summary.supported_hardcoded_values, 1);
  assert.equal(report.issues[0].detected_type, 'number-like string');
  assert.equal(report.issues[0].case, 'detected');
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
        candidates: ['semantic.color.text.primary', 'semantic.color.icon.primary'],
        reason: 'multiple token candidates were found',
      },
    ],
    noCandidate: [],
    unsupported: [],
  };

  const resolvedPath = exportClassifiedJsonReport({
    targetPath: './src',
    tokenPath: './tokens.json',
    blockCount: 2,
    detectedValues: [deterministic, ambiguous],
    classifiedIssues,
    outputPath,
  });

  const report = readJson(resolvedPath);

  assert.equal(report.summary.deterministic, 1);
  assert.equal(report.summary.ambiguous, 1);
  assert.equal(report.summary.issues, 2);
  assert.equal(report.issues[0].file, 'src/A.tsx');
  assert.deepEqual(report.issues[0].candidates, [
    'semantic.color.text.primary',
    'semantic.color.icon.primary',
  ]);
  assert.equal(report.issues[1].token, 'semantic.spacing.md');
});

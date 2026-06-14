import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { scan } from '../src/cli/scan.js';

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'token-validator-scan-test-'));
}

function captureConsoleLog(run: () => void): string {
  const logs: string[] = [];
  const originalLog = console.log;

  console.log = (...values: unknown[]) => {
    logs.push(values.map(String).join(' '));
  };

  try {
    run();
  } finally {
    console.log = originalLog;
  }

  return logs.join('\n');
}

test('scan continues across directory parse errors and reports them', () => {
  const tempDir = createTempDir();
  const sourceDir = path.join(tempDir, 'src');

  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    path.join(sourceDir, 'Valid.tsx'),
    'export function Valid() { return <div style={{ color: "#ffffff" }} />; }',
    'utf8',
  );
  writeFileSync(
    path.join(sourceDir, 'Broken.tsx'),
    'export function Broken() { return <div',
    'utf8',
  );

  const output = captureConsoleLog(() => {
    scan(sourceDir);
  });

  assert.match(output, /Found 1 hardcoded style value/);
  assert.match(output, /Scan errors/);
  assert.match(output, /Broken\.tsx/);
});

test('scan reports empty target, no inline styles, and unsupported values', () => {
  const tempDir = createTempDir();
  const sourceDir = path.join(tempDir, 'src');

  mkdirSync(sourceDir, { recursive: true });

  const emptyOutput = captureConsoleLog(() => {
    scan(sourceDir, {
      include: ['**/*.vue'],
    });
  });

  assert.match(emptyOutput, /No matching source files found/);

  const plainFile = path.join(sourceDir, 'Plain.tsx');
  writeFileSync(
    plainFile,
    'export function Plain() { return <div className="plain" />; }',
    'utf8',
  );

  const noInlineOutput = captureConsoleLog(() => {
    scan(plainFile);
  });

  assert.match(noInlineOutput, /No inline style literals found/);

  const unsupportedFile = path.join(sourceDir, 'Unsupported.tsx');
  writeFileSync(
    unsupportedFile,
    'export function Unsupported() { return <div style={{ width: 12 }} />; }',
    'utf8',
  );

  const unsupportedOutput = captureConsoleLog(() => {
    scan(unsupportedFile);
  });

  assert.match(
    unsupportedOutput,
    /No supported hardcoded color or spacing values found/,
  );
});

test('scan writes detection and classified JSON reports', () => {
  const tempDir = createTempDir();
  const sourceFile = path.join(tempDir, 'Button.tsx');
  const detectionOutputPath = path.join(tempDir, 'reports', 'detection.json');
  const classifiedOutputPath = path.join(tempDir, 'reports', 'classified.json');

  writeFileSync(
    sourceFile,
    'export function Button() { return <button style={{ color: "#0F172A", padding: 8 }} />; }',
    'utf8',
  );

  const detectionOutput = captureConsoleLog(() => {
    scan(sourceFile, {
      format: 'json',
      outputPath: detectionOutputPath,
    });
  });
  const detectionReport = JSON.parse(readFileSync(detectionOutputPath, 'utf8'));

  assert.match(detectionOutput, /Structured JSON report written/);
  assert.equal(detectionReport.issues.length, 2);

  const classifiedOutput = captureConsoleLog(() => {
    scan(sourceFile, {
      tokenPath: 'samples/tokens/storefront.tokens.ts',
      format: 'json',
      outputPath: classifiedOutputPath,
      reportMode: 'detailed',
      limit: 1,
      explain: true,
    });
  });
  const classifiedReport = JSON.parse(
    readFileSync(classifiedOutputPath, 'utf8'),
  );

  assert.match(classifiedOutput, /Classification/);
  assert.match(classifiedOutput, /Structured JSON report written/);
  assert.equal(classifiedReport.summary.totalIssues, 2);
});

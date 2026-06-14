import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { diff, parseChangedLines, shouldFailDiff } from '../src/cli/diff.js';

const emptySeverity = {
  error: 0,
  warning: 0,
  info: 0,
  unknown: 0,
};

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'token-validator-diff-test-'));
}

function captureConsoleLog(run: () => unknown): {
  output: string;
  result: unknown;
} {
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (...values: unknown[]) => {
    lines.push(values.map(String).join(' '));
  };

  try {
    const result = run();

    return {
      output: lines.join('\n'),
      result,
    };
  } finally {
    console.log = originalLog;
  }
}

test('shouldFailDiff fails when error severity exists', () => {
  assert.equal(
    shouldFailDiff(
      {
        severity: {
          ...emptySeverity,
          error: 1,
        },
      },
      [],
    ),
    true,
  );
});

test('shouldFailDiff only fails warnings in strict mode', () => {
  const summary = {
    severity: {
      ...emptySeverity,
      warning: 1,
    },
  };

  assert.equal(shouldFailDiff(summary, [], false), false);
  assert.equal(shouldFailDiff(summary, [], true), true);
});

test('shouldFailDiff fails when scan errors exist', () => {
  assert.equal(
    shouldFailDiff(
      {
        severity: emptySeverity,
      },
      [
        {
          file: 'src/Broken.tsx',
          message: 'Parse error',
        },
      ],
    ),
    true,
  );
});

test('parseChangedLines returns added line numbers by file', () => {
  const rootPath = '/repo';
  const changedLines = parseChangedLines(
    [
      'diff --git a/src/Button.tsx b/src/Button.tsx',
      '--- a/src/Button.tsx',
      '+++ b/src/Button.tsx',
      '@@ -10,0 +11,2 @@',
      '+const color = "#fff";',
      '+const gap = 12;',
      '@@ -30 +33 @@',
      '-old',
      '+new',
    ].join('\n'),
    rootPath,
  );

  assert.deepEqual(
    [...(changedLines.get(path.resolve(rootPath, 'src/Button.tsx')) ?? [])],
    [11, 12, 33],
  );
});

test('diff returns success when changed files do not match scan scope', () => {
  const { output, result } = captureConsoleLog(() =>
    diff({
      files: ['docs/guide.md'],
    }),
  );

  assert.equal(result, 0);
  assert.match(output, /PR token check/);
  assert.match(output, /Changed files: 1/);
  assert.match(output, /Scanned files: 0/);
});

test('diff requires tokens when changed files contain detected values', () => {
  const tempDir = createTempDir();
  const sourceFile = path.join(tempDir, 'Button.tsx');

  writeFileSync(
    sourceFile,
    'export function Button() { return <button style={{ color: "#0F172A" }} />; }',
    'utf8',
  );

  assert.throws(
    () =>
      diff({
        files: [sourceFile],
      }),
    /--tokens option or config tokens field is required/,
  );
});

test('diff prints decisions and writes a JSON report for changed files', () => {
  const tempDir = createTempDir();
  const sourceFile = path.join(tempDir, 'Button.tsx');
  const outputPath = path.join(tempDir, 'reports', 'diff.json');

  writeFileSync(
    sourceFile,
    'export function Button() { return <button style={{ color: "#0F172A", padding: 8 }} />; }',
    'utf8',
  );

  const { output, result } = captureConsoleLog(() =>
    diff({
      files: [sourceFile],
      tokenPath: 'samples/tokens/storefront.tokens.ts',
      format: 'json',
      outputPath,
      limit: 1,
    }),
  );
  const report = JSON.parse(readFileSync(outputPath, 'utf8'));

  assert.equal(result, 1);
  assert.match(output, /PR token check/);
  assert.match(output, /Top changed-file decisions \(limit 1\)/);
  assert.match(output, /Structured JSON report written/);
  assert.deepEqual(report.mode, 'diff');
  assert.deepEqual(report.changedFiles, [sourceFile]);
  assert.deepEqual(report.scannedFiles, [sourceFile]);
  assert.equal(report.summary.totalIssues, 2);
  assert.equal(report.decisions.length, 2);
  assert.equal(report.shouldFail, true);
});

test('diff reports scan errors from changed files', () => {
  const tempDir = createTempDir();
  const sourceDir = path.join(tempDir, 'src');
  const brokenFile = path.join(sourceDir, 'Broken.tsx');

  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    brokenFile,
    'export function Broken() { return <div',
    'utf8',
  );

  const { output, result } = captureConsoleLog(() =>
    diff({
      files: [brokenFile],
      tokenPath: 'samples/tokens/storefront.tokens.ts',
    }),
  );

  assert.equal(result, 1);
  assert.match(output, /Scan errors/);
  assert.match(output, /Broken\.tsx/);
});

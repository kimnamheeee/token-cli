import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

import { parseChangedLines, shouldFailDiff } from '../src/cli/diff.js';

const emptySeverity = {
  error: 0,
  warning: 0,
  info: 0,
  unknown: 0,
};

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

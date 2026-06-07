import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesignSyncReport } from '../src/sync/buildDesignSyncReport.js';
import { parseTokens } from '../src/tokens/loadTokens.js';

test('buildDesignSyncReport reports value mismatches and missing tokens', () => {
  const designTokens = parseTokens(
    JSON.stringify({
      colors: {
        primary: '#111827',
        tertiary: '#b8422e',
        surface: '#ffffff',
      },
    }),
    'DESIGN.json',
  );
  const codeTokens = parseTokens(
    [
      'export const colors = {',
      '  primary: "#0f172a",',
      '  surface: "#ffffff",',
      '};',
      'export const semantic = {',
      '  color: {',
      '    surfaceDefault: colors.surface,',
      '  },',
      '};',
    ].join('\n'),
    'tokens.ts',
  );

  const report = buildDesignSyncReport(
    designTokens,
    codeTokens,
    [],
    'design-md',
  );

  assert.equal(report.summary['value-mismatch'], 1);
  assert.equal(report.summary['missing-in-code'], 1);
  assert.equal(report.summary['code-only-token'], 1);
  assert.equal(report.summary['same-value-different-name'], 1);
  assert.equal(
    report.issues.find((issue) => issue.kind === 'value-mismatch')?.severity,
    'error',
  );
});

test('buildDesignSyncReport respects compare-only authority', () => {
  const designTokens = parseTokens(
    JSON.stringify({
      colors: {
        primary: '#111827',
      },
    }),
    'DESIGN.json',
  );
  const codeTokens = parseTokens(
    JSON.stringify({
      colors: {
        primary: '#0f172a',
      },
    }),
    'tokens.json',
  );

  const report = buildDesignSyncReport(
    designTokens,
    codeTokens,
    [],
    'compare-only',
  );

  assert.equal(
    report.issues.find((issue) => issue.kind === 'value-mismatch')?.severity,
    'info',
  );
});

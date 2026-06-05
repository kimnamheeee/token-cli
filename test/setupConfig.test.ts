import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildSetupConfig,
  parseCommaSeparatedList,
  writeSetupConfig,
} from '../src/config/setupConfig.js';

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'token-validator-setup-test-'));
}

test('buildSetupConfig creates the default interactive config shape', () => {
  const config = buildSetupConfig({
    tokens: 'src/tokens.ts',
    include: ['src/**/*.tsx'],
    exclude: ['dist/**', 'node_modules/**'],
    reportMode: 'summary',
    reportLimit: 10,
    writeJsonReport: true,
    reportOut: 'reports/token-report.json',
    designSource: 'DESIGN.md',
    authority: 'compare-only',
  });

  assert.deepEqual(config, {
    tokens: 'src/tokens.ts',
    include: ['src/**/*.tsx'],
    exclude: ['dist/**', 'node_modules/**'],
    ranking: {},
    sources: {
      design: 'DESIGN.md',
      tokens: 'src/tokens.ts',
    },
    authority: 'compare-only',
    report: {
      mode: 'summary',
      limit: 10,
      format: 'json',
      out: 'reports/token-report.json',
      explain: false,
    },
  });
});

test('parseCommaSeparatedList trims empty values', () => {
  assert.deepEqual(parseCommaSeparatedList(' src/**/*.tsx, , test/**/*.ts '), [
    'src/**/*.tsx',
    'test/**/*.ts',
  ]);
});

test('writeSetupConfig refuses to overwrite unless forced', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'token-validator.config.json');
  const config = buildSetupConfig({ tokens: 'src/tokens.ts' });

  writeFileSync(configPath, '{}\n', 'utf8');

  assert.throws(
    () => writeSetupConfig(config, { cwd: tempDir }),
    /already exists.*--force/i,
  );

  const writtenPath = writeSetupConfig(config, {
    cwd: tempDir,
    force: true,
  });

  assert.equal(writtenPath, configPath);
  assert.equal(existsSync(writtenPath), true);
  assert.equal(
    JSON.parse(readFileSync(writtenPath, 'utf8')).tokens,
    'src/tokens.ts',
  );
});

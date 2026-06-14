import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadConfig } from '../src/config/loadConfig.js';

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'token-validator-config-test-'));
}

test('loadConfig returns an empty config when no default config exists', () => {
  const tempDir = createTempDir();

  const loadedConfig = loadConfig(undefined, tempDir);

  assert.equal(loadedConfig.path, undefined);
  assert.deepEqual(loadedConfig.config, {});
});

test('loadConfig reads default token-validator.config.json', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'token-validator.config.json');

  writeFileSync(
    configPath,
    JSON.stringify({
      tokens: 'samples/tokens/storefront.tokens.ts',
      include: ['src/**/*.tsx'],
      exclude: ['dist/**'],
      sources: {
        design: 'DESIGN.md',
        tokens: 'src/tokens.ts',
      },
      authority: 'compare-only',
      report: {
        mode: 'detailed',
        limit: 5,
        format: 'json',
        out: 'reports/token-report.json',
        explain: true,
      },
    }),
    'utf8',
  );

  const loadedConfig = loadConfig(undefined, tempDir);

  assert.equal(loadedConfig.path, configPath);
  assert.equal(
    loadedConfig.config.tokens,
    'samples/tokens/storefront.tokens.ts',
  );
  assert.deepEqual(loadedConfig.config.include, ['src/**/*.tsx']);
  assert.deepEqual(loadedConfig.config.exclude, ['dist/**']);
  assert.equal(loadedConfig.config.sources?.design, 'DESIGN.md');
  assert.equal(loadedConfig.config.sources?.tokens, 'src/tokens.ts');
  assert.equal(loadedConfig.config.authority, 'compare-only');
  assert.equal(loadedConfig.config.report?.mode, 'detailed');
  assert.equal(loadedConfig.config.report?.limit, 5);
  assert.equal(loadedConfig.config.report?.format, 'json');
  assert.equal(loadedConfig.config.report?.out, 'reports/token-report.json');
  assert.equal(loadedConfig.config.report?.explain, true);
});

test('loadConfig validates report mode and limit', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'invalid.json');

  writeFileSync(
    configPath,
    JSON.stringify({
      report: {
        mode: 'verbose',
        limit: 0,
      },
    }),
    'utf8',
  );

  assert.throws(
    () => loadConfig(configPath, tempDir),
    /report\.mode.*summary.*detailed/i,
  );
});

test('loadConfig validates root, array, string, sources, authority, and format fields', () => {
  const cases: Array<{
    value: unknown;
    message: RegExp;
  }> = [
    {
      value: [],
      message: /Config root must be an object/,
    },
    {
      value: {
        include: ['src/**/*.tsx', 1],
      },
      message: /include.*array of strings/,
    },
    {
      value: {
        tokens: 42,
      },
      message: /tokens.*string/,
    },
    {
      value: {
        sources: 'DESIGN.md',
      },
      message: /sources.*object/,
    },
    {
      value: {
        authority: 'both',
      },
      message: /authority.*design-md.*code.*compare-only/,
    },
    {
      value: {
        report: {
          format: 'text',
        },
      },
      message: /report\.format.*json/,
    },
  ];

  for (const testCase of cases) {
    const tempDir = createTempDir();
    const configPath = path.join(tempDir, 'invalid.json');

    writeFileSync(configPath, JSON.stringify(testCase.value), 'utf8');

    assert.throws(
      () => loadConfig(configPath, tempDir),
      testCase.message,
    );
  }
});

test('loadConfig throws for a missing explicit config path', () => {
  const tempDir = createTempDir();

  assert.throws(
    () => loadConfig('missing.json', tempDir),
    /Config file not found/,
  );
});

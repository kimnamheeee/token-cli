import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { discoverTargetFiles } from '../src/cli/discoverTargetFiles.js';

function createTempProject(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'token-validator-discover-'));

  mkdirSync(path.join(tempDir, 'src/components'), { recursive: true });
  mkdirSync(path.join(tempDir, 'src/generated'), { recursive: true });
  mkdirSync(path.join(tempDir, 'node_modules/pkg'), { recursive: true });

  writeFileSync(path.join(tempDir, 'src/App.tsx'), '', 'utf8');
  writeFileSync(path.join(tempDir, 'src/components/Button.tsx'), '', 'utf8');
  writeFileSync(
    path.join(tempDir, 'src/components/Button.test.tsx'),
    '',
    'utf8',
  );
  writeFileSync(path.join(tempDir, 'src/generated/tokens.ts'), '', 'utf8');
  writeFileSync(path.join(tempDir, 'node_modules/pkg/index.tsx'), '', 'utf8');

  return tempDir;
}

function relativeFiles(rootPath: string, files: string[]): string[] {
  return files.map((file) =>
    path.relative(rootPath, file).split(path.sep).join('/'),
  );
}

test('discoverTargetFiles returns a single file target unchanged', () => {
  const tempDir = createTempProject();
  const filePath = path.join(tempDir, 'src/App.tsx');

  assert.deepEqual(discoverTargetFiles(filePath), [filePath]);
});

test('discoverTargetFiles applies include and exclude patterns for directories', () => {
  const tempDir = createTempProject();

  const files = discoverTargetFiles(tempDir, {
    include: ['src/**/*.tsx'],
    exclude: ['**/*.test.tsx'],
  });

  assert.deepEqual(relativeFiles(tempDir, files), [
    'src/App.tsx',
    'src/components/Button.tsx',
  ]);
});

test('discoverTargetFiles uses default source extensions and ignores node_modules', () => {
  const tempDir = createTempProject();

  const files = discoverTargetFiles(tempDir);

  assert.deepEqual(relativeFiles(tempDir, files), [
    'src/App.tsx',
    'src/components/Button.test.tsx',
    'src/components/Button.tsx',
    'src/generated/tokens.ts',
  ]);
});

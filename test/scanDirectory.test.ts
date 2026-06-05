import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { scan } from '../src/cli/scan.js';

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'token-validator-scan-test-'));
}

test('scan continues across directory parse errors and reports them', () => {
  const tempDir = createTempDir();
  const sourceDir = path.join(tempDir, 'src');
  const logs: string[] = [];
  const originalLog = console.log;

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

  console.log = (...values: unknown[]) => {
    logs.push(values.map(String).join(' '));
  };

  try {
    scan(sourceDir);
  } finally {
    console.log = originalLog;
  }

  const output = logs.join('\n');

  assert.match(output, /Found 1 hardcoded style value/);
  assert.match(output, /Scan errors/);
  assert.match(output, /Broken\.tsx/);
});

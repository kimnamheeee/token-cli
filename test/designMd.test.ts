import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDesignMd } from '../src/sources/designMd/parseDesignMd.js';

test('parseDesignMd converts frontmatter tokens into records', () => {
  const parsed = parseDesignMd(
    [
      '---',
      'colors:',
      '  primary: "#1A1C1E"',
      '  surface: "{colors.primary}"',
      'spacing:',
      '  md: 16',
      'rounded:',
      '  md: 8',
      '---',
      '# Design',
    ].join('\n'),
    'DESIGN.md',
  );

  assert.equal(parsed.issues.length, 0);
  assert.equal(
    parsed.tokens.recordsById.get('colors.primary')?.normalizedResolvedValue,
    '#1a1c1e',
  );
  assert.equal(parsed.tokens.recordsById.get('colors.primary')?.type, 'color');
  assert.equal(
    parsed.tokens.recordsById.get('colors.surface')?.aliasOf,
    'colors.primary',
  );
  assert.equal(
    parsed.tokens.recordsById.get('colors.surface')?.normalizedResolvedValue,
    '#1a1c1e',
  );
  assert.equal(parsed.tokens.recordsById.get('spacing.md')?.type, 'spacing');
  assert.equal(parsed.tokens.recordsById.get('rounded.md')?.type, 'radius');
});

test('parseDesignMd reports broken references', () => {
  const parsed = parseDesignMd(
    ['---', 'colors:', '  primary: "{colors.missing}"', '---', '# Design'].join(
      '\n',
    ),
    'DESIGN.md',
  );

  assert.equal(parsed.issues.length, 1);
  assert.equal(parsed.issues[0]?.code, 'broken-reference');
  assert.equal(parsed.issues[0]?.path, 'colors.primary');
});

test('parseDesignMd reports duplicate token paths', () => {
  const parsed = parseDesignMd(
    [
      '---',
      'colors:',
      '  primary: "#111827"',
      '  primary: "#0f172a"',
      '---',
      '# Design',
    ].join('\n'),
    'DESIGN.md',
  );

  assert.equal(parsed.issues.length, 1);
  assert.equal(parsed.issues[0]?.code, 'duplicate-token');
  assert.equal(parsed.issues[0]?.path, 'colors.primary');
});

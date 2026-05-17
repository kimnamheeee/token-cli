import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTokenIndexes,
  flattenTokens,
  parseTokens,
} from '../src/tokens/loadTokens.js';

test('flattenTokens preserves token paths and normalized values', () => {
  const entries = flattenTokens({
    primitive: {
      color: {
        red: '#FF0000',
      },
    },
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.path, 'primitive.color.red');
  assert.equal(entries[0]?.normalizedValue, '#ff0000');
  assert.equal(entries[0]?.group, 'color');
});

test('buildTokenIndexes groups entries by path and normalized value', () => {
  const entries = flattenTokens({
    semantic: {
      color: {
        text: '#ff0000',
        icon: '#ff0000',
      },
    },
  });

  const indexes = buildTokenIndexes(entries);

  assert.equal(indexes.entriesByPath.get('semantic.color.text')?.path, 'semantic.color.text');
  assert.equal(indexes.entriesByNormalizedValue.get('#ff0000')?.length, 2);
});

test('parseTokens loads JSON token trees and creates record indexes', () => {
  const tokens = parseTokens(
    JSON.stringify({
      primitive: {
        spacing: {
          md: 8,
        },
      },
      semantic: {
        color: {
          text: '#FF0000',
        },
      },
    }),
    'tokens.json',
  );

  assert.equal(tokens.records.length, 2);
  assert.equal(tokens.recordsById.get('semantic.color.text')?.normalizedResolvedValue, '#ff0000');
  assert.equal(tokens.recordsByNormalizedValue.get('8')?.[0]?.id, 'primitive.spacing.md');
});

test('parseTokens resolves TypeScript aliases and preserves alias metadata', () => {
  const tokens = parseTokens(
    `
      export const primitive = {
        color: {
          red: '#FF0000',
        },
      };

      export const semantic = {
        color: {
          text: primitive.color.red,
        },
      };
    `,
    'tokens.ts',
  );

  assert.equal(tokens.recordsById.get('semantic.color.text')?.normalizedResolvedValue, '#ff0000');
  assert.equal(tokens.recordsById.get('semantic.color.text')?.aliasOf, 'primitive.color.red');
  assert.equal(tokens.recordsById.get('semantic.color.text')?.rawValue, 'primitive.color.red');
});

test('parseTokens unwraps parenthesized and TypeScript asserted expressions', () => {
  const tokens = parseTokens(
    `
      export const primitive = ({
        spacing: {
          md: 8,
        },
      } as const);

      export const semantic = ({
        spacing: {
          panel: (primitive.spacing.md),
        },
      } satisfies Record<string, unknown>);
    `,
    'tokens.ts',
  );

  const record = tokens.recordsById.get('semantic.spacing.panel');

  assert.equal(record?.normalizedResolvedValue, '8');
  assert.equal(record?.aliasOf, 'primitive.spacing.md');
  assert.equal(record?.rawValue, 'primitive.spacing.md');
});

test('parseTokens supports negative numeric values and component token metadata', () => {
  const tokens = parseTokens(
    `
      export const component = {
        button: {
          primary: {
            borderRadius: -8,
          },
        },
      };
    `,
    'tokens.ts',
  );

  const record = tokens.recordsById.get('component.button.primary.borderRadius');

  assert.equal(record?.normalizedResolvedValue, '-8');
  assert.equal(record?.type, 'radius');
  assert.deepEqual(record?.metadata, {
    pathDepth: 4,
    component: 'button',
    slot: 'primary',
    role: 'borderRadius',
    type: 'radius',
  });
});

test('parseTokens supports string and numeric object keys and bracket member access', () => {
  const tokens = parseTokens(
    `
      export const primitive = {
        color: {
          "100": '#FF0000',
        },
      };

      export const semantic = {
        color: {
          critical: primitive.color["100"],
        },
      };
    `,
    'tokens.ts',
  );

  assert.equal(tokens.recordsById.get('primitive.color.100')?.normalizedResolvedValue, '#ff0000');
  assert.equal(tokens.recordsById.get('semantic.color.critical')?.aliasOf, 'primitive.color.100');
});

test('parseTokens rejects unsupported file extensions', () => {
  assert.throws(
    () => parseTokens('{}', 'tokens.yaml'),
    /Unsupported token file extension: \.yaml/,
  );
});

test('parseTokens rejects JSON content that is not an object', () => {
  assert.throws(
    () => parseTokens('[]', 'tokens.json'),
    /Token file must contain a JSON object/,
  );
});

test('parseTokens rejects unknown TypeScript bindings', () => {
  assert.throws(
    () =>
      parseTokens(
        `
          export const semantic = {
            color: {
              text: missingToken,
            },
          };
        `,
        'tokens.ts',
      ),
    /Unknown token binding "missingToken"/,
  );
});

test('parseTokens rejects top-level TypeScript exports that are not objects', () => {
  assert.throws(
    () =>
      parseTokens(
        `
          export const spacing = 8;
        `,
        'tokens.ts',
      ),
    /Top-level token export "spacing" must be an object/,
  );
});

test('parseTokens rejects circular TypeScript token references', () => {
  assert.throws(
    () =>
      parseTokens(
        `
          export const primitive = semantic;
          export const semantic = primitive;
        `,
        'tokens.ts',
      ),
    /Circular token reference detected for "primitive"|Circular token reference detected for "semantic"/,
  );
});

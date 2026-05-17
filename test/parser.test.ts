import test from 'node:test';
import assert from 'node:assert/strict';

import { extractInlineStylesFromCode } from '../src/parser/extractInlineStyles.js';

test('extractInlineStylesFromCode collects literal inline style declarations', () => {
  const sourceCode = `
    const gap = 8;

    export function Card() {
      return (
        <>
          <div style={{ color: '#FF0000', paddingTop: '16px', margin: 8, width: gap }} />
          <span style={{ ['paddingLeft']: '12px', backgroundColor: \`#00FF00\` }} />
        </>
      );
    }
  `;

  const blocks = extractInlineStylesFromCode(sourceCode, 'Card.tsx');

  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks[0]?.declarations.map((declaration) => ({
      property: declaration.property,
      rawValue: declaration.rawValue,
      valueType: declaration.valueType,
    })),
    [
      { property: 'color', rawValue: '#FF0000', valueType: 'string' },
      { property: 'paddingTop', rawValue: '16px', valueType: 'string' },
      { property: 'margin', rawValue: '8', valueType: 'number' },
    ],
  );

  assert.deepEqual(
    blocks[1]?.declarations.map((declaration) => declaration.property),
    ['backgroundColor'],
  );
});

test('extractInlineStylesFromCode ignores non-object style values', () => {
  const sourceCode = `
    const styles = { color: '#FF0000' };
    export const View = () => <div style={styles} />;
  `;

  const blocks = extractInlineStylesFromCode(sourceCode, 'View.tsx');

  assert.deepEqual(blocks, []);
});

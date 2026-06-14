import assert from 'node:assert/strict';
import test from 'node:test';

import { buildConsolidationReport } from '../src/consolidate/buildConsolidationReport.js';
import { parseTokens } from '../src/tokens/loadTokens.js';
import type { DetectedHardcodedValue } from '../src/types/index.js';

function createDetectedValue(
  rawValue: string,
  normalizedValue: string,
  property: string,
): DetectedHardcodedValue {
  return {
    filePath: `/repo/src/${property}.tsx`,
    line: 10,
    column: 8,
    property,
    rawValue,
    normalizedValue,
    valueType: 'string',
    tokenGroup: property.includes('Radius') ? 'radius' : 'color',
  };
}

test('buildConsolidationReport keeps same value tokens separate across semantic roles', () => {
  const tokens = parseTokens(
    JSON.stringify({
      semantic: {
        color: {
          surface: '#ffffff',
          textOnBrand: '#ffffff',
          borderSubtle: '#ffffff',
        },
      },
    }),
    'tokens.json',
  );
  const report = buildConsolidationReport(tokens, {
    detectedValues: [
      createDetectedValue('#ffffff', '#ffffff', 'backgroundColor'),
      createDetectedValue('#ffffff', '#ffffff', 'color'),
      createDetectedValue('#ffffff', '#ffffff', 'borderColor'),
    ],
  });

  assert.equal(report.sameValueGroups.length, 1);
  assert.equal(report.sameValueGroups[0]?.recommendation, 'keep-separate');
  assert.equal(report.sameValueGroups[0]?.usage.roles.background, 1);
  assert.equal(report.sameValueGroups[0]?.usage.roles.text, 1);
  assert.equal(report.sameValueGroups[0]?.usage.roles.border, 1);
});

test('buildConsolidationReport recommends deprecating primitive duplicates', () => {
  const tokens = parseTokens(
    JSON.stringify({
      primitive: {
        color: {
          white: '#ffffff',
        },
      },
      semantic: {
        color: {
          surface: '#ffffff',
        },
      },
    }),
    'tokens.json',
  );
  const report = buildConsolidationReport(tokens, {
    detectedValues: [
      createDetectedValue('#ffffff', '#ffffff', 'backgroundColor'),
    ],
  });

  assert.equal(report.sameValueGroups[0]?.recommendation, 'deprecate');
});

test('buildConsolidationReport uses DTCG replacement metadata', () => {
  const tokens = parseTokens(
    JSON.stringify({
      semantic: {
        color: {
          legacy: {
            $type: 'color',
            $value: '#ffffff',
            $deprecated: true,
            $extensions: {
              replacement: 'semantic.color.surface',
            },
          },
          surface: {
            $type: 'color',
            $value: '#ffffff',
          },
        },
      },
    }),
    'tokens.json',
  );
  const report = buildConsolidationReport(tokens);

  assert.equal(report.summary.deprecatedTokens, 1);
  assert.equal(report.sameValueGroups[0]?.recommendation, 'replace-with');
  assert.deepEqual(report.sameValueGroups[0]?.replacementCandidates, [
    'semantic.color.surface',
  ]);
});

test('buildConsolidationReport reports deprecated, near, and unused tokens', () => {
  const tokens = parseTokens(
    JSON.stringify({
      semantic: {
        color: {
          legacyText: {
            $type: 'color',
            $value: '#111111',
            $deprecated: true,
          },
          textDefault: {
            $type: 'color',
            $value: '#111111',
          },
          nearText: {
            $type: 'color',
            $value: '#111112',
          },
        },
        radius: {
          surface: {
            $type: 'dimension',
            $value: 8,
          },
          overlay: {
            $type: 'dimension',
            $value: 10,
          },
        },
      },
    }),
    'tokens.json',
  );
  const report = buildConsolidationReport(tokens, {
    detectedValues: [
      createDetectedValue('#111111', '#111111', 'color'),
      createDetectedValue('8', '8', 'borderRadius'),
    ],
  });

  assert.equal(report.sameValueGroups[0]?.recommendation, 'deprecate');
  assert.deepEqual(report.sameValueGroups[0]?.deprecatedTokens, [
    'semantic.color.legacyText',
  ]);
  assert.equal(report.summary.deprecatedTokens, 1);
  assert.ok(report.summary.nearValueGroups >= 2);
  assert.ok(
    report.nearValueGroups.some(
      (group) =>
        group.leftToken === 'semantic.color.legacyText' &&
        group.rightToken === 'semantic.color.nearText',
    ),
  );
  assert.ok(
    report.unusedTokens.some(
      (token) => token.token === 'semantic.color.nearText',
    ),
  );
});

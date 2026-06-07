import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdoptionReport } from '../src/adoption/buildAdoptionReport.js';
import { parseDesignMd } from '../src/sources/designMd/parseDesignMd.js';
import { parseTokens } from '../src/tokens/loadTokens.js';
import type {
  ClassifiedIssueSets,
  DetectedHardcodedValue,
} from '../src/types/index.js';

function createDetectedValue(
  rawValue: string,
  normalizedValue: string,
  property: string,
): DetectedHardcodedValue {
  return {
    filePath: '/repo/src/App.tsx',
    line: 10,
    column: 8,
    property,
    rawValue,
    normalizedValue,
    valueType: 'string',
    tokenGroup: property === 'borderRadius' ? 'radius' : 'color',
  };
}

test('buildAdoptionReport calculates coverage and top raw blockers', () => {
  const matched = createDetectedValue('#ffffff', '#ffffff', 'backgroundColor');
  const unmatched = createDetectedValue('#f7f2d9', '#f7f2d9', 'color');
  const tokens = parseTokens(
    JSON.stringify({
      semantic: {
        color: {
          surface: '#ffffff',
        },
      },
    }),
    'tokens.json',
  );
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [
      {
        ...matched,
        case: 'deterministic',
        suggestion: 'semantic.color.surface',
        reason: 'single exact token candidate',
      },
    ],
    ambiguous: [],
    noCandidate: [
      {
        ...unmatched,
        case: 'no-candidate',
        reason: 'no exact token candidate found',
      },
    ],
    unsupported: [],
  };

  const report = buildAdoptionReport(
    [matched, unmatched],
    classifiedIssues,
    tokens,
    {
      generatedAt: '2026-06-07T00:00:00.000Z',
    },
  );

  assert.equal(report.snapshotVersion, 1);
  assert.equal(report.generatedAt, '2026-06-07T00:00:00.000Z');
  assert.equal(report.coverage.coveragePercent, 50);
  assert.equal(report.coverage.byCategory.color.coveragePercent, 50);
  assert.deepEqual(report.topRawValuesBlockingCoverage, [
    {
      value: '#f7f2d9',
      count: 1,
    },
  ]);
});

test('buildAdoptionReport reports missing theme modes', () => {
  const tokens = parseTokens(
    JSON.stringify({
      semantic: {
        color: {
          surface: {
            $type: 'color',
            $value: '#ffffff',
            $extensions: {
              modes: {
                light: '#ffffff',
              },
            },
          },
        },
      },
    }),
    'tokens.json',
  );
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [],
    ambiguous: [],
    noCandidate: [],
    unsupported: [],
  };

  const report = buildAdoptionReport([], classifiedIssues, tokens, {
    requiredModes: ['light', 'dark'],
  });

  assert.equal(report.themeSafety.tokenModeCoverage.totalModeAwareTokens, 1);
  assert.equal(report.themeSafety.tokenModeCoverage.incomplete, 1);
  assert.deepEqual(report.themeSafety.risks[0]?.missingModes, ['dark']);
});

test('buildAdoptionReport includes DESIGN.md parity summary', () => {
  const tokens = parseTokens(
    JSON.stringify({
      colors: {
        primary: '#0f172a',
      },
    }),
    'tokens.json',
  );
  const designMd = parseDesignMd(
    ['---', 'colors:', '  primary: "#111827"', '---', '# Design'].join('\n'),
    'DESIGN.md',
  );
  const classifiedIssues: ClassifiedIssueSets = {
    deterministic: [],
    ambiguous: [],
    noCandidate: [],
    unsupported: [],
  };

  const report = buildAdoptionReport([], classifiedIssues, tokens, {
    designMd,
    authority: 'design-md',
  });

  assert.equal(report.parity?.summary['value-mismatch'], 1);
});

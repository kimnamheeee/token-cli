import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesignDiffReport } from '../src/designDiff/buildDesignDiffReport.js';
import { parseDesignMd } from '../src/sources/designMd/parseDesignMd.js';
import type { DetectedHardcodedValue } from '../src/types/index.js';

function createDetectedValue(
  rawValue: string,
  normalizedValue: string,
  property: string,
): DetectedHardcodedValue {
  return {
    filePath: '/repo/src/HomePage.tsx',
    line: 10,
    column: 8,
    property,
    rawValue,
    normalizedValue,
    valueType: 'string',
    tokenGroup: 'color',
  };
}

test('buildDesignDiffReport reports token changes and impacted raw values', () => {
  const oldDesign = parseDesignMd(
    [
      '---',
      'colors:',
      '  primary: "#111827"',
      '  removed: "#B8422E"',
      '---',
      '# Design',
    ].join('\n'),
  );
  const newDesign = parseDesignMd(
    [
      '---',
      'colors:',
      '  primary: "#0F172A"',
      '  added: "#FFFFFF"',
      '---',
      '# Design',
    ].join('\n'),
  );

  const report = buildDesignDiffReport(oldDesign, newDesign, {
    detectedValues: [
      createDetectedValue('#111827', '#111827', 'color'),
      createDetectedValue('#B8422E', '#b8422e', 'backgroundColor'),
    ],
  });

  assert.equal(report.summary.modifiedTokens, 1);
  assert.equal(report.summary.removedTokens, 1);
  assert.equal(report.summary.addedTokens, 1);
  assert.equal(report.modifiedTokens[0]?.impactedRawValueCount, 1);
  assert.equal(report.removedTokens[0]?.impactedRawValueCount, 1);
  assert.equal(report.summary.impactedCodeLocations, 2);
});

test('buildDesignDiffReport reports explicit avoid guidance warnings', () => {
  const oldDesign = parseDesignMd(
    ['---', 'colors:', '  primary: "#111827"', '---', '# Design'].join('\n'),
  );
  const newDesign = parseDesignMd(
    [
      '---',
      'colors:',
      '  primary: "#111827"',
      '---',
      '# Design',
      '<!-- token-validator:',
      'rules:',
      '  - token: colors.primary',
      '    avoid:',
      '      properties: [backgroundColor]',
      '    reason: "Do not use primary for large backgrounds."',
      '-->',
    ].join('\n'),
  );

  const report = buildDesignDiffReport(oldDesign, newDesign, {
    detectedValues: [
      createDetectedValue('#111827', '#111827', 'backgroundColor'),
      createDetectedValue('#111827', '#111827', 'color'),
    ],
  });

  assert.equal(newDesign.guidanceRules.length, 1);
  assert.equal(report.summary.guidanceWarnings, 1);
  assert.equal(report.guidanceIssues[0]?.property, 'backgroundColor');
  assert.equal(
    report.guidanceIssues[0]?.message,
    'Do not use primary for large backgrounds.',
  );
});

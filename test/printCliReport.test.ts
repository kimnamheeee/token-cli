import test from 'node:test';
import assert from 'node:assert/strict';

import {
  printClassifiedReport,
  printDetectionReport,
} from '../src/reporter/printCliReport.js';
import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  NoCandidateMatch,
  UnsupportedMatch,
} from '../src/types/index.js';

function stripAnsi(text: string): string {
  return text.replace(/\u001B\[[0-9;]*m/g, '');
}

function captureConsoleLog(run: () => void): string {
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };

  try {
    run();
  } finally {
    console.log = originalLog;
  }

  return stripAnsi(lines.join('\n'));
}

function createDetectedValue(
  overrides: Partial<DetectedHardcodedValue> = {},
): DetectedHardcodedValue {
  return {
    filePath: 'src/Button.tsx',
    line: 10,
    column: 7,
    property: 'color',
    rawValue: '#ff0000',
    normalizedValue: '#ff0000',
    valueType: 'string',
    tokenGroup: 'color',
    ...overrides,
  };
}

function createClassifiedIssues(): ClassifiedIssueSets {
  const ambiguous: AmbiguousTokenMatch = {
    ...createDetectedValue({
      filePath: 'src/Card.tsx',
      line: 12,
      property: 'backgroundColor',
    }),
    case: 'ambiguous',
    candidates: ['semantic.color.surface.default', 'primitive.color.red500'],
    rankedCandidates: [
      {
        id: 'semantic.color.surface.default',
        score: 35,
        reasons: ['matches color role keyword: surface', 'semantic token'],
      },
      {
        id: 'primitive.color.red500',
        score: 30,
        reasons: ['primitive token is a fallback candidate'],
      },
    ],
    reason: 'multiple token candidates were found',
  };
  const noCandidate: NoCandidateMatch = {
    ...createDetectedValue({
      filePath: 'src/Panel.tsx',
      line: 20,
      property: 'borderRadius',
      rawValue: '4',
      normalizedValue: '4',
      tokenGroup: 'radius',
    }),
    case: 'no-candidate',
    reason: 'no token with the same normalized value was found',
    diagnostics: {
      tokenGroup: 'radius',
      suggestedAction: 'define-semantic-token',
      nearbyCandidates: [
        {
          id: 'semantic.radius.sm',
          score: 8,
          reasons: ['nearby scale value'],
        },
      ],
    },
  };
  const unsupported: UnsupportedMatch = {
    ...createDetectedValue({
      filePath: 'src/Shadow.tsx',
      line: 30,
      property: 'boxShadow',
      rawValue: '0 1px 2px #000',
      normalizedValue: '0 1px 2px #000',
    }),
    case: 'unsupported',
    reason: 'unsupported property',
  };

  return {
    deterministic: [
      {
        ...createDetectedValue({
          line: 8,
          property: 'padding',
          rawValue: '8',
          normalizedValue: '8',
          valueType: 'number',
          tokenGroup: 'spacing',
        }),
        case: 'deterministic',
        suggestion: 'semantic.spacing.md',
        reason: 'single exact token candidate was found',
      },
    ],
    ambiguous: [ambiguous],
    noCandidate: [noCandidate],
    unsupported: [unsupported],
  };
}

test('printDetectionReport prints detected values and scan errors', () => {
  const output = captureConsoleLog(() => {
    printDetectionReport({
      targetPath: 'src',
      blockCount: 1,
      detectedValues: [
        createDetectedValue({
          property: 'borderRadius',
          rawValue: '4',
          tokenGroup: 'radius',
        }),
      ],
      scanErrors: [{ file: 'src/Broken.tsx', message: 'Unexpected token' }],
    });
  });

  assert.match(output, /Scan summary for src/);
  assert.match(output, /Detected hardcoded values/);
  assert.match(output, /raw value: "4"/);
  assert.match(output, /detected type: number-like string/);
  assert.match(output, /Scan errors/);
  assert.match(output, /src\/Broken\.tsx: Unexpected token/);
});

test('printClassifiedReport summary prints decisions and explanations', () => {
  const classifiedIssues = createClassifiedIssues();
  const detectedValues = [
    ...classifiedIssues.deterministic,
    ...classifiedIssues.ambiguous,
    ...classifiedIssues.noCandidate,
    ...classifiedIssues.unsupported,
  ];
  const output = captureConsoleLog(() => {
    printClassifiedReport({
      targetPath: 'src',
      blockCount: 4,
      detectedValues,
      classifiedIssues,
      limit: 2,
      explain: true,
    });
  });

  assert.match(output, /Classification/);
  assert.match(output, /Recommendation confidence/);
  assert.match(output, /Safe replacements/);
  assert.match(output, /replace with: semantic\.spacing\.md/);
  assert.match(output, /Ambiguous/);
  assert.match(output, /candidates:/);
  assert.match(output, /Unknown/);
  assert.match(output, /nearby candidates:/);
  assert.match(output, /suggested action: define-semantic-token/);
  assert.match(output, /reasons:/);
});

test('printClassifiedReport detailed prints every issue category', () => {
  const classifiedIssues = createClassifiedIssues();
  const detectedValues = [
    ...classifiedIssues.deterministic,
    ...classifiedIssues.ambiguous,
    ...classifiedIssues.noCandidate,
    ...classifiedIssues.unsupported,
  ];
  const output = captureConsoleLog(() => {
    printClassifiedReport({
      targetPath: 'src',
      blockCount: 4,
      detectedValues,
      classifiedIssues,
      mode: 'detailed',
    });
  });

  assert.match(output, /Deterministic matches/);
  assert.match(output, /single exact candidate: semantic\.spacing\.md/);
  assert.match(output, /Ambiguous matches/);
  assert.match(output, /top recommendation: semantic\.color\.surface\.default/);
  assert.match(output, /ranked candidates:/);
  assert.match(output, /No token candidate found/);
  assert.match(output, /Needs review/);
});

test('printClassifiedReport reports an empty classified summary', () => {
  const output = captureConsoleLog(() => {
    printClassifiedReport({
      targetPath: 'src',
      blockCount: 0,
      detectedValues: [],
      classifiedIssues: {
        deterministic: [],
        ambiguous: [],
        noCandidate: [],
        unsupported: [],
      },
    });
  });

  assert.match(output, /No classified issues found/);
});

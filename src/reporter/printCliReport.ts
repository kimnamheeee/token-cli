import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  NoCandidateMatch,
  UnsupportedMatch,
} from '../types/index.js';

interface DetectionReportInput {
  targetPath: string;
  blockCount: number;
  detectedValues: DetectedHardcodedValue[];
}

interface ClassifiedReportInput extends DetectionReportInput {
  classifiedIssues: ClassifiedIssueSets;
}

const ANSI = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  red: '\u001B[31m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  magenta: '\u001B[35m',
  cyan: '\u001B[36m',
  gray: '\u001B[90m',
} as const;

function colorize(text: string, ...styles: string[]): string {
  return `${styles.join('')}${text}${ANSI.reset}`;
}

function bold(text: string): string {
  return colorize(text, ANSI.bold);
}

function formatRawValue(detectedValue: DetectedHardcodedValue): string {
  return detectedValue.valueType === 'number'
    ? detectedValue.rawValue
    : JSON.stringify(detectedValue.rawValue);
}

function formatDetectedType(detectedValue: DetectedHardcodedValue): string {
  if (detectedValue.valueType === 'number') {
    return detectedValue.tokenGroup;
  }

  if (detectedValue.tokenGroup === 'radius' && /^-?(?:\d+|\d*\.\d+)$/.test(detectedValue.rawValue)) {
    return 'number-like string';
  }

  return detectedValue.tokenGroup;
}

function printSectionHeader(
  title: string,
  description: string,
  color: string,
): void {
  console.log(colorize(title, ANSI.bold, color));
  console.log(colorize(description, ANSI.dim));
  console.log('');
}

function printIssueHeader(
  index: number,
  detectedValue: DetectedHardcodedValue,
): void {
  console.log(
    colorize(
      `[${index}] ${detectedValue.filePath}:${detectedValue.line}:${detectedValue.column}`,
      ANSI.bold,
    ),
  );
}

function printBaseIssueDetails(detectedValue: DetectedHardcodedValue): void {
  console.log(`    property: ${detectedValue.property}`);
  console.log(`    raw value: ${formatRawValue(detectedValue)}`);
}

function printDeterministicMatch(
  index: number,
  match: DeterministicTokenMatch,
): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log(
    `    suggested token: ${colorize(match.suggestion, ANSI.bold, ANSI.green)}`,
  );
}

function printAmbiguousMatch(
  index: number,
  match: AmbiguousTokenMatch,
): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log('    candidates:');

  for (const candidate of match.candidates) {
    console.log(`      - ${colorize(candidate, ANSI.bold, ANSI.yellow)}`);
  }
}

function printNoCandidateMatch(
  index: number,
  match: NoCandidateMatch,
): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log(`    detected type: ${formatDetectedType(match)}`);
}

function printUnsupportedMatch(
  index: number,
  match: UnsupportedMatch,
): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log(`    detected type: ${formatDetectedType(match)}`);
}

export function printDetectionReport({
  targetPath,
  blockCount,
  detectedValues,
}: DetectionReportInput): void {
  console.log(bold(`Scan summary for ${targetPath}`));
  console.log('');
  console.log(
    `Found ${detectedValues.length} hardcoded style value(s) in ${blockCount} inline style block(s).`,
  );
  console.log('');

  printSectionHeader(
    'Detected hardcoded values',
    'These values are within the current detector scope.',
    ANSI.cyan,
  );

  detectedValues.forEach((detectedValue, index) => {
    printIssueHeader(index + 1, detectedValue);
    printBaseIssueDetails(detectedValue);
    console.log(`    detected type: ${formatDetectedType(detectedValue)}`);
  });
}

export function printClassifiedReport({
  targetPath,
  blockCount,
  detectedValues,
  classifiedIssues,
}: ClassifiedReportInput): void {
  const totalIssues =
    classifiedIssues.deterministic.length
    + classifiedIssues.ambiguous.length
    + classifiedIssues.noCandidate.length
    + classifiedIssues.unsupported.length;

  console.log(bold(`Scan summary for ${targetPath}`));
  console.log('');
  console.log(
    `Found ${detectedValues.length} hardcoded style value(s) in ${blockCount} inline style block(s).`,
  );
  console.log('');
  console.log(bold('Classification'));
  console.log(
    `${colorize('- deterministic', ANSI.green)}: ${classifiedIssues.deterministic.length}  ${colorize('→ exactly one token candidate', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- ambiguous', ANSI.yellow)}: ${classifiedIssues.ambiguous.length}      ${colorize('→ multiple token candidates', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- no-candidate', ANSI.red)}: ${classifiedIssues.noCandidate.length}   ${colorize('→ no matching token found', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- unsupported', ANSI.magenta)}: ${classifiedIssues.unsupported.length}   ${colorize('→ detected, but not handled by current token rules', ANSI.dim)}`,
  );
  console.log('');

  let issueIndex = 1;

  if (classifiedIssues.deterministic.length > 0) {
    printSectionHeader(
      'Deterministic matches',
      'These values have exactly one matching token.',
      ANSI.green,
    );

    for (const match of classifiedIssues.deterministic) {
      printDeterministicMatch(issueIndex, match);
      issueIndex += 1;
    }

    console.log('');
  }

  if (classifiedIssues.ambiguous.length > 0) {
    printSectionHeader(
      'Ambiguous matches',
      'These values match multiple token candidates and need human review.',
      ANSI.yellow,
    );

    for (const match of classifiedIssues.ambiguous) {
      printAmbiguousMatch(issueIndex, match);
      issueIndex += 1;
    }

    console.log('');
  }

  if (classifiedIssues.noCandidate.length > 0) {
    printSectionHeader(
      'No token candidate found',
      'These values are hardcoded, but no matching token was found.',
      ANSI.red,
    );

    for (const match of classifiedIssues.noCandidate) {
      printNoCandidateMatch(issueIndex, match);
      issueIndex += 1;
    }

    console.log('');
  }

  if (classifiedIssues.unsupported.length > 0) {
    printSectionHeader(
      'Needs review',
      'These values were detected, but the current matcher cannot safely suggest a token.',
      ANSI.magenta,
    );

    for (const match of classifiedIssues.unsupported) {
      printUnsupportedMatch(issueIndex, match);
      issueIndex += 1;
    }
  }

  if (totalIssues === 0) {
    console.log(colorize('No classified issues found.', ANSI.gray));
  }
}

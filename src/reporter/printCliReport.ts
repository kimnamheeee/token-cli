import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  NoCandidateMatch,
  UnsupportedMatch,
} from '../types/index.js';
import {
  getRecommendationConfidence,
  type ReportDecision,
} from './buildReportDecisions.js';
import { buildClassifiedReportSummary } from './buildReportSummary.js';

interface DetectionReportInput {
  targetPath: string;
  blockCount: number;
  detectedValues: DetectedHardcodedValue[];
  scanErrors?: ScanError[];
}

interface ClassifiedReportInput extends DetectionReportInput {
  classifiedIssues: ClassifiedIssueSets;
  mode?: 'summary' | 'detailed';
  limit?: number;
  explain?: boolean;
}

interface ScanError {
  file: string;
  message: string;
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

  if (
    detectedValue.tokenGroup === 'radius' &&
    /^-?(?:\d+|\d*\.\d+)$/.test(detectedValue.rawValue)
  ) {
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
    `    single exact candidate: ${colorize(match.suggestion, ANSI.bold, ANSI.green)}`,
  );
}

function printAmbiguousMatch(index: number, match: AmbiguousTokenMatch): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);

  const [topCandidate] = match.rankedCandidates ?? [];
  const visibleRankedCandidates = (match.rankedCandidates ?? []).filter(
    (candidate) => candidate.score >= 0,
  );

  if (topCandidate) {
    const confidence = getRecommendationConfidence(match);

    console.log(
      `    top recommendation: ${colorize(topCandidate.id, ANSI.bold, ANSI.yellow)} ${colorize(`(score ${topCandidate.score}, ${confidence} confidence)`, ANSI.dim)}`,
    );
    console.log('    reasons:');

    for (const reason of topCandidate.reasons) {
      console.log(`      - ${reason}`);
    }

    console.log('    ranked candidates:');

    for (const candidate of visibleRankedCandidates) {
      console.log(
        `      - ${colorize(candidate.id, ANSI.bold, ANSI.yellow)} ${colorize(`score ${candidate.score}`, ANSI.dim)}`,
      );
    }

    return;
  }

  console.log('    candidates:');

  for (const candidate of match.candidates) {
    console.log(`      - ${colorize(candidate, ANSI.bold, ANSI.yellow)}`);
  }
}

function printClassificationCounts(
  classifiedIssues: ClassifiedIssueSets,
): void {
  console.log(bold('Classification'));
  console.log(
    `${colorize('- deterministic', ANSI.green)}: ${classifiedIssues.deterministic.length}  ${colorize('-> single exact token candidate', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- ambiguous', ANSI.yellow)}: ${classifiedIssues.ambiguous.length}      ${colorize('-> multiple token candidates', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- no-candidate', ANSI.red)}: ${classifiedIssues.noCandidate.length}   ${colorize('-> no matching token found', ANSI.dim)}`,
  );
  console.log(
    `${colorize('- unsupported', ANSI.magenta)}: ${classifiedIssues.unsupported.length}   ${colorize('-> detected, but not handled by current token rules', ANSI.dim)}`,
  );
  console.log('');
}

function printScanErrors(scanErrors: ScanError[] | undefined): void {
  if (!scanErrors || scanErrors.length === 0) {
    return;
  }

  printSectionHeader(
    'Scan errors',
    'These files could not be parsed, but the rest of the scan completed.',
    ANSI.magenta,
  );

  for (const scanError of scanErrors) {
    console.log(`    - ${scanError.file}: ${scanError.message}`);
  }

  console.log('');
}

function printSummaryMode(
  classifiedIssues: ClassifiedIssueSets,
  limit: number,
  explain: boolean,
): void {
  const summary = buildClassifiedReportSummary(classifiedIssues, {
    recommendationLimit: limit,
  });

  if (summary.totalIssues === 0) {
    console.log(colorize('No classified issues found.', ANSI.gray));
    return;
  }

  console.log(bold('Recommendation confidence'));
  console.log(
    `${colorize('- high', ANSI.green)}: ${summary.confidence.high}  ${colorize('- medium', ANSI.yellow)}: ${summary.confidence.medium}  ${colorize('- low', ANSI.gray)}: ${summary.confidence.low}`,
  );
  console.log('');

  console.log(bold('Decision summary'));
  console.log(
    `${colorize('- safe', ANSI.green)}: ${summary.decisions['safe-replacement']}  ${colorize('- ambiguous', ANSI.yellow)}: ${summary.decisions.ambiguous}  ${colorize('- unknown', ANSI.red)}: ${summary.decisions.unknown}  ${colorize('- unsupported', ANSI.magenta)}: ${summary.decisions.unsupported}`,
  );
  console.log(
    `${colorize('- error', ANSI.red)}: ${summary.severity.error}  ${colorize('- warning', ANSI.yellow)}: ${summary.severity.warning}  ${colorize('- info', ANSI.gray)}: ${summary.severity.info}  ${colorize('- unknown', ANSI.magenta)}: ${summary.severity.unknown}`,
  );
  console.log('');

  if (summary.hotspots.files.length > 0 || summary.hotspots.values.length > 0) {
    printSectionHeader(
      'Hotspots',
      'Highest-count files and repeated raw values.',
      ANSI.cyan,
    );

    if (summary.hotspots.files.length > 0) {
      console.log('    files:');

      for (const hotspot of summary.hotspots.files) {
        console.log(`      - ${hotspot.value}: ${hotspot.count}`);
      }
    }

    if (summary.hotspots.values.length > 0) {
      console.log('    values:');

      for (const hotspot of summary.hotspots.values) {
        console.log(
          `      - ${JSON.stringify(hotspot.value)}: ${hotspot.count}`,
        );
      }
    }

    console.log('');
  }

  const safeDecisions = summary.reportDecisions
    .filter((decision) => decision.decision === 'safe-replacement')
    .slice(0, limit);
  const ambiguousDecisions = summary.reportDecisions
    .filter((decision) => decision.decision === 'ambiguous')
    .slice(0, limit);
  const unknownDecisions = summary.reportDecisions
    .filter((decision) => decision.decision === 'unknown')
    .slice(0, limit);

  if (safeDecisions.length > 0) {
    printSectionHeader(
      'Safe replacements',
      `Showing up to ${limit} high-confidence replacement(s).`,
      ANSI.green,
    );

    safeDecisions.forEach((decision, index) => {
      printReportDecision(index + 1, decision, explain);
    });

    console.log('');
  }

  if (ambiguousDecisions.length > 0) {
    printSectionHeader(
      'Ambiguous',
      `Showing up to ${limit} issue(s) that need semantic review.`,
      ANSI.yellow,
    );

    ambiguousDecisions.forEach((decision, index) => {
      printReportDecision(index + 1, decision, explain);
    });

    console.log('');
  }

  if (unknownDecisions.length > 0) {
    printSectionHeader(
      'Unknown',
      `Showing up to ${limit} value(s) with no exact token candidate.`,
      ANSI.red,
    );

    unknownDecisions.forEach((decision, index) => {
      printReportDecision(index + 1, decision, explain);
    });

    console.log('');
  }

  if (
    safeDecisions.length === 0 &&
    ambiguousDecisions.length === 0 &&
    unknownDecisions.length === 0
  ) {
    console.log(
      colorize(
        'No token replacement decisions. Use --report detailed for the full issue list.',
        ANSI.gray,
      ),
    );
  }
}

function printReportDecision(
  index: number,
  decision: ReportDecision,
  explain: boolean,
): void {
  const [topCandidate] = decision.topCandidates;
  const visibleCandidates = decision.topCandidates.slice(0, 3);

  console.log(
    colorize(
      `[${index}] ${decision.file}:${decision.line}:${decision.column}`,
      ANSI.bold,
    ),
  );
  console.log(`    property: ${decision.property}`);
  console.log(`    raw value: ${JSON.stringify(decision.value)}`);
  console.log(
    `    decision: ${decision.decision} ${colorize(`(${decision.severity})`, ANSI.dim)}`,
  );

  if (topCandidate && decision.decision === 'safe-replacement') {
    console.log(
      `    replace with: ${colorize(topCandidate.id, ANSI.bold, ANSI.green)}${formatDecisionScore(decision)}`,
    );
  } else if (visibleCandidates.length > 0) {
    console.log(
      decision.decision === 'unknown'
        ? '    nearby candidates:'
        : '    candidates:',
    );

    for (const candidate of visibleCandidates) {
      console.log(
        `      - ${colorize(candidate.id, ANSI.bold, ANSI.yellow)} ${colorize(`score ${candidate.score}`, ANSI.dim)}`,
      );
    }
  }

  if (decision.diagnostics) {
    console.log(
      `    suggested action: ${decision.diagnostics.suggestedAction}`,
    );
  }

  if (decision.missingContext && decision.missingContext.length > 0) {
    console.log(`    missing context: ${decision.missingContext.join(', ')}`);
  }

  const reasons = topCandidate?.reasons ?? [];
  const visibleReasons = explain ? reasons : reasons.slice(0, 2);

  if (visibleReasons.length > 0) {
    console.log(explain ? '    reasons:' : '    reason:');

    for (const reason of visibleReasons) {
      console.log(`      - ${reason}`);
    }
  }
}

function formatDecisionScore(decision: ReportDecision): string {
  const [topCandidate] = decision.topCandidates;

  if (!topCandidate) {
    return '';
  }

  const confidence = decision.confidence
    ? `, ${decision.confidence} confidence`
    : '';
  const scoreGap =
    typeof decision.scoreGap === 'number' ? `, gap ${decision.scoreGap}` : '';

  return colorize(
    ` (score ${topCandidate.score}${scoreGap}${confidence})`,
    ANSI.dim,
  );
}

function printDetailedMode(classifiedIssues: ClassifiedIssueSets): void {
  const totalIssues =
    classifiedIssues.deterministic.length +
    classifiedIssues.ambiguous.length +
    classifiedIssues.noCandidate.length +
    classifiedIssues.unsupported.length;

  let issueIndex = 1;

  if (classifiedIssues.deterministic.length > 0) {
    printSectionHeader(
      'Deterministic matches',
      'These values have a single exact token candidate.',
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

function printNoCandidateMatch(index: number, match: NoCandidateMatch): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log(`    detected type: ${formatDetectedType(match)}`);
}

function printUnsupportedMatch(index: number, match: UnsupportedMatch): void {
  printIssueHeader(index, match);
  printBaseIssueDetails(match);
  console.log(`    detected type: ${formatDetectedType(match)}`);
}

export function printDetectionReport({
  targetPath,
  blockCount,
  detectedValues,
  scanErrors,
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

  printScanErrors(scanErrors);
}

export function printClassifiedReport({
  targetPath,
  blockCount,
  detectedValues,
  classifiedIssues,
  mode = 'summary',
  limit = 10,
  explain = false,
  scanErrors,
}: ClassifiedReportInput): void {
  console.log(bold(`Scan summary for ${targetPath}`));
  console.log('');
  console.log(
    `Found ${detectedValues.length} hardcoded style value(s) in ${blockCount} inline style block(s).`,
  );
  console.log('');
  printClassificationCounts(classifiedIssues);
  printScanErrors(scanErrors);

  if (mode === 'detailed') {
    printDetailedMode(classifiedIssues);
    return;
  }

  printSummaryMode(classifiedIssues, limit, explain);
}

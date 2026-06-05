import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  RankedTokenCandidate,
} from '../types/index.js';
import { buildClassifiedReportSummary } from './buildReportSummary.js';

interface BaseStructuredIssue {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  case: string;
}

interface DetectionStructuredIssue extends BaseStructuredIssue {
  case: 'detected';
}

interface DeterministicStructuredIssue extends BaseStructuredIssue {
  case: 'deterministic';
  token: string;
}

interface AmbiguousStructuredIssue extends BaseStructuredIssue {
  case: 'ambiguous';
  candidates: string[];
  rankedCandidates?: RankedTokenCandidate[];
}

interface NoCandidateStructuredIssue extends BaseStructuredIssue {
  case: 'no-candidate';
}

interface UnsupportedStructuredIssue extends BaseStructuredIssue {
  case: 'unsupported';
}

type StructuredIssue =
  | DetectionStructuredIssue
  | DeterministicStructuredIssue
  | AmbiguousStructuredIssue
  | NoCandidateStructuredIssue
  | UnsupportedStructuredIssue;

interface DetectionJsonReportInput {
  targetPath: string;
  detectedValues: DetectedHardcodedValue[];
  outputPath: string;
}

interface ClassifiedJsonReportInput {
  targetPath: string;
  classifiedIssues: ClassifiedIssueSets;
  outputPath: string;
}

function toBaseIssue(
  detectedValue: DetectedHardcodedValue,
): BaseStructuredIssue {
  return {
    file: detectedValue.filePath,
    line: detectedValue.line,
    column: detectedValue.column,
    property: detectedValue.property,
    value: detectedValue.rawValue,
    case: 'detected',
  };
}

function writeJsonReport(outputPath: string, report: object): string {
  const resolvedPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return resolvedPath;
}

export function exportDetectionJsonReport({
  targetPath,
  detectedValues,
  outputPath,
}: DetectionJsonReportInput): string {
  const issues: StructuredIssue[] = detectedValues.map((detectedValue) => ({
    ...toBaseIssue(detectedValue),
    case: 'detected',
  }));

  return writeJsonReport(outputPath, {
    target: targetPath,
    issues,
  });
}

export function exportClassifiedJsonReport({
  targetPath,
  classifiedIssues,
  outputPath,
}: ClassifiedJsonReportInput): string {
  const deterministic: StructuredIssue[] = classifiedIssues.deterministic.map(
    (issue) => ({
      ...toBaseIssue(issue),
      case: 'deterministic',
      token: issue.suggestion,
    }),
  );

  const ambiguous: StructuredIssue[] = classifiedIssues.ambiguous.map(
    (issue) => ({
      ...toBaseIssue(issue),
      case: 'ambiguous',
      candidates: issue.candidates,
      rankedCandidates: issue.rankedCandidates,
    }),
  );

  const noCandidate: StructuredIssue[] = classifiedIssues.noCandidate.map(
    (issue) => ({
      ...toBaseIssue(issue),
      case: 'no-candidate',
    }),
  );

  const unsupported: StructuredIssue[] = classifiedIssues.unsupported.map(
    (issue) => ({
      ...toBaseIssue(issue),
      case: 'unsupported',
    }),
  );

  const issues = [
    ...deterministic,
    ...ambiguous,
    ...noCandidate,
    ...unsupported,
  ].sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    return left.column - right.column;
  });

  const summary = buildClassifiedReportSummary(classifiedIssues);

  return writeJsonReport(outputPath, {
    target: targetPath,
    summary: {
      totalIssues: summary.totalIssues,
      cases: summary.cases,
      confidence: summary.confidence,
    },
    hotspots: summary.hotspots,
    recommendations: summary.recommendations,
    details: issues,
    issues,
  });
}

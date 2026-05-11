import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  ClassifiedIssueSets,
  DetectedHardcodedValue,
} from '../types/index.js';

interface BaseStructuredIssue {
  file: string;
  line: number;
  column: number;
  property: string;
  raw_value: string;
  normalized_value: string;
  value_type: 'string' | 'number';
  detected_type: string;
  case: string;
  reason?: string;
}

interface DetectionStructuredIssue extends BaseStructuredIssue {
  case: 'detected';
}

interface DeterministicStructuredIssue extends BaseStructuredIssue {
  case: 'deterministic';
  token: string;
  reason: string;
}

interface AmbiguousStructuredIssue extends BaseStructuredIssue {
  case: 'ambiguous';
  candidates: string[];
  reason: string;
}

interface NoCandidateStructuredIssue extends BaseStructuredIssue {
  case: 'no-candidate';
  reason: string;
}

interface UnsupportedStructuredIssue extends BaseStructuredIssue {
  case: 'unsupported';
  reason: string;
}

type StructuredIssue =
  | DetectionStructuredIssue
  | DeterministicStructuredIssue
  | AmbiguousStructuredIssue
  | NoCandidateStructuredIssue
  | UnsupportedStructuredIssue;

interface DetectionJsonReportInput {
  targetPath: string;
  blockCount: number;
  detectedValues: DetectedHardcodedValue[];
  outputPath: string;
}

interface ClassifiedJsonReportInput extends DetectionJsonReportInput {
  tokenPath: string;
  classifiedIssues: ClassifiedIssueSets;
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

function toBaseIssue(
  detectedValue: DetectedHardcodedValue,
): BaseStructuredIssue {
  return {
    file: detectedValue.filePath,
    line: detectedValue.line,
    column: detectedValue.column,
    property: detectedValue.property,
    raw_value: detectedValue.rawValue,
    normalized_value: detectedValue.normalizedValue,
    value_type: detectedValue.valueType,
    detected_type: formatDetectedType(detectedValue),
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
  blockCount,
  detectedValues,
  outputPath,
}: DetectionJsonReportInput): string {
  const issues: StructuredIssue[] = detectedValues.map((detectedValue) => ({
    ...toBaseIssue(detectedValue),
    case: 'detected',
  }));

  return writeJsonReport(outputPath, {
    target: targetPath,
    generated_at: new Date().toISOString(),
    summary: {
      inline_style_blocks: blockCount,
      supported_hardcoded_values: detectedValues.length,
      issues: issues.length,
    },
    issues,
  });
}

export function exportClassifiedJsonReport({
  targetPath,
  tokenPath,
  blockCount,
  detectedValues,
  classifiedIssues,
  outputPath,
}: ClassifiedJsonReportInput): string {
  const deterministic: StructuredIssue[] = classifiedIssues.deterministic.map((issue) => ({
    ...toBaseIssue(issue),
    case: 'deterministic',
    token: issue.suggestion,
    reason: issue.reason,
  }));

  const ambiguous: StructuredIssue[] = classifiedIssues.ambiguous.map((issue) => ({
    ...toBaseIssue(issue),
    case: 'ambiguous',
    candidates: issue.candidates,
    reason: issue.reason,
  }));

  const noCandidate: StructuredIssue[] = classifiedIssues.noCandidate.map((issue) => ({
    ...toBaseIssue(issue),
    case: 'no-candidate',
    reason: issue.reason,
  }));

  const unsupported: StructuredIssue[] = classifiedIssues.unsupported.map((issue) => ({
    ...toBaseIssue(issue),
    case: 'unsupported',
    reason: issue.reason,
  }));

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

  return writeJsonReport(outputPath, {
    target: targetPath,
    token_source: path.resolve(tokenPath),
    generated_at: new Date().toISOString(),
    summary: {
      inline_style_blocks: blockCount,
      supported_hardcoded_values: detectedValues.length,
      deterministic: classifiedIssues.deterministic.length,
      ambiguous: classifiedIssues.ambiguous.length,
      no_candidate: classifiedIssues.noCandidate.length,
      unsupported: classifiedIssues.unsupported.length,
      issues: issues.length,
    },
    issues,
  });
}

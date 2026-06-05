import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  RankedTokenCandidate,
} from '../types/index.js';

export type RecommendationConfidence = 'high' | 'medium' | 'low';

export type ReportDecisionType =
  | 'safe-replacement'
  | 'ambiguous'
  | 'unknown'
  | 'unsupported';

export type ReportSeverity = 'error' | 'warning' | 'info' | 'unknown';
type SourceCase =
  | 'deterministic'
  | 'ambiguous'
  | 'no-candidate'
  | 'unsupported';

export interface ReportDecision {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  sourceCase: SourceCase;
  decision: ReportDecisionType;
  severity: ReportSeverity;
  message: string;
  topCandidates: RankedTokenCandidate[];
  confidence?: RecommendationConfidence;
  scoreGap?: number;
  missingContext?: string[];
}

function toDecisionBase(detectedValue: DetectedHardcodedValue) {
  return {
    file: detectedValue.filePath,
    line: detectedValue.line,
    column: detectedValue.column,
    property: detectedValue.property,
    value: detectedValue.rawValue,
  };
}

function getScoreGap(candidates: RankedTokenCandidate[]): number {
  const [topCandidate, nextCandidate] = candidates;

  if (!topCandidate || !nextCandidate) {
    return 0;
  }

  return topCandidate.score - nextCandidate.score;
}

function hasNegativeReason(candidate: RankedTokenCandidate): boolean {
  return candidate.reasons.some((reason) => {
    const lowerReason = reason.toLowerCase();

    return (
      lowerReason.includes('does not match') ||
      lowerReason.includes('mismatch') ||
      lowerReason.includes('property mismatch')
    );
  });
}

export function getRecommendationConfidence(
  match: AmbiguousTokenMatch,
): RecommendationConfidence {
  const [topCandidate, nextCandidate] = match.rankedCandidates ?? [];

  if (!topCandidate || !nextCandidate) {
    return 'low';
  }

  const hasStrongReason = topCandidate.reasons.some(
    (reason) =>
      reason.includes('role keyword') || reason.includes('file context'),
  );

  if (!hasStrongReason) {
    return 'low';
  }

  const scoreGap = topCandidate.score - nextCandidate.score;

  if (scoreGap >= 20) {
    return 'high';
  }

  if (scoreGap >= 10) {
    return 'medium';
  }

  return 'low';
}

function getMissingContext(
  match: AmbiguousTokenMatch,
  confidence: RecommendationConfidence,
  scoreGap: number,
): string[] {
  const missingContext: string[] = [];

  if (confidence === 'low') {
    missingContext.push('strong property or component context');
  }

  if (scoreGap < 10) {
    missingContext.push('clear score separation between candidates');
  }

  if (match.candidates.length > 2) {
    missingContext.push('narrower semantic intent');
  }

  return missingContext;
}

function isSafeAmbiguousReplacement(
  candidates: RankedTokenCandidate[],
  confidence: RecommendationConfidence,
): boolean {
  const [topCandidate] = candidates;

  if (!topCandidate) {
    return false;
  }

  return (
    confidence === 'high' &&
    getScoreGap(candidates) >= 20 &&
    !hasNegativeReason(topCandidate)
  );
}

function isPrimitiveCandidate(candidateId: string): boolean {
  return candidateId.startsWith('primitive.');
}

export function buildReportDecisions(
  classifiedIssues: ClassifiedIssueSets,
): ReportDecision[] {
  const deterministic: ReportDecision[] = classifiedIssues.deterministic.map(
    (issue) => {
      const isPrimitive = isPrimitiveCandidate(issue.suggestion);

      return {
        ...toDecisionBase(issue),
        sourceCase: 'deterministic',
        decision: 'safe-replacement',
        severity: isPrimitive ? 'info' : 'error',
        message: isPrimitive
          ? 'single primitive fallback candidate'
          : 'single exact token candidate',
        topCandidates: [
          {
            id: issue.suggestion,
            score: 100,
            reasons: [
              isPrimitive
                ? 'single primitive fallback candidate'
                : 'single exact token candidate',
            ],
          },
        ],
        confidence: 'high',
      };
    },
  );

  const ambiguous: ReportDecision[] = classifiedIssues.ambiguous.map(
    (issue) => {
      const rankedCandidates = issue.rankedCandidates ?? [];
      const topCandidates = rankedCandidates.slice(0, 3);
      const confidence = getRecommendationConfidence(issue);
      const scoreGap = getScoreGap(rankedCandidates);
      const isSafeReplacement = isSafeAmbiguousReplacement(
        rankedCandidates,
        confidence,
      );
      const [topCandidate] = rankedCandidates;
      const isPrimitive = topCandidate
        ? isPrimitiveCandidate(topCandidate.id)
        : false;

      return {
        ...toDecisionBase(issue),
        sourceCase: 'ambiguous',
        decision: isSafeReplacement ? 'safe-replacement' : 'ambiguous',
        severity: isSafeReplacement
          ? isPrimitive
            ? 'info'
            : 'error'
          : 'warning',
        message: isSafeReplacement
          ? isPrimitive
            ? 'high-confidence primitive fallback'
            : 'high-confidence token replacement'
          : 'multiple token candidates need review',
        topCandidates,
        confidence,
        scoreGap,
        missingContext: isSafeReplacement
          ? undefined
          : getMissingContext(issue, confidence, scoreGap),
      };
    },
  );

  const noCandidate: ReportDecision[] = classifiedIssues.noCandidate.map(
    (issue) => ({
      ...toDecisionBase(issue),
      sourceCase: 'no-candidate',
      decision: 'unknown',
      severity: 'unknown',
      message: 'no exact token candidate found',
      topCandidates: [],
      missingContext: ['token definition or corrected design-system value'],
    }),
  );

  const unsupported: ReportDecision[] = classifiedIssues.unsupported.map(
    (issue) => ({
      ...toDecisionBase(issue),
      sourceCase: 'unsupported',
      decision: 'unsupported',
      severity: 'info',
      message: 'detected value is outside current matcher rules',
      topCandidates: [],
    }),
  );

  return [...deterministic, ...ambiguous, ...noCandidate, ...unsupported].sort(
    (left, right) => {
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }

      if (left.line !== right.line) {
        return left.line - right.line;
      }

      return left.column - right.column;
    },
  );
}

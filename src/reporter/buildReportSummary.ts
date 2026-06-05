import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
} from '../types/index.js';

export type RecommendationConfidence = 'high' | 'medium' | 'low';
type ClassifiedCase =
  | 'deterministic'
  | 'ambiguous'
  | 'no-candidate'
  | 'unsupported';

export interface ReportCount {
  value: string;
  count: number;
}

export interface ReportRecommendation {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  token: string;
  score: number;
  scoreGap: number;
  confidence: RecommendationConfidence;
  reasons: string[];
}

export interface ClassifiedReportSummary {
  totalIssues: number;
  cases: Record<ClassifiedCase, number>;
  confidence: Record<RecommendationConfidence, number>;
  hotspots: {
    files: ReportCount[];
    values: ReportCount[];
  };
  recommendations: ReportRecommendation[];
}

interface BuildSummaryOptions {
  hotspotLimit?: number;
  recommendationLimit?: number;
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortCounts(counts: Map<string, number>, limit: number): ReportCount[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.value.localeCompare(right.value);
    })
    .slice(0, limit);
}

function getAllClassifiedIssues(
  classifiedIssues: ClassifiedIssueSets,
): DetectedHardcodedValue[] {
  return [
    ...classifiedIssues.deterministic,
    ...classifiedIssues.ambiguous,
    ...classifiedIssues.noCandidate,
    ...classifiedIssues.unsupported,
  ];
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

function getConfidenceRank(confidence: RecommendationConfidence): number {
  if (confidence === 'high') {
    return 3;
  }

  if (confidence === 'medium') {
    return 2;
  }

  return 1;
}

function buildRecommendations(
  ambiguousIssues: AmbiguousTokenMatch[],
): ReportRecommendation[] {
  return ambiguousIssues
    .flatMap((issue): ReportRecommendation[] => {
      const [topCandidate, nextCandidate] = issue.rankedCandidates ?? [];

      if (!topCandidate) {
        return [];
      }

      const scoreGap = nextCandidate
        ? topCandidate.score - nextCandidate.score
        : 0;

      return [
        {
          file: issue.filePath,
          line: issue.line,
          column: issue.column,
          property: issue.property,
          value: issue.rawValue,
          token: topCandidate.id,
          score: topCandidate.score,
          scoreGap,
          confidence: getRecommendationConfidence(issue),
          reasons: topCandidate.reasons,
        },
      ];
    })
    .sort((left, right) => {
      const confidenceDiff =
        getConfidenceRank(right.confidence) -
        getConfidenceRank(left.confidence);

      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      if (left.scoreGap !== right.scoreGap) {
        return right.scoreGap - left.scoreGap;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }

      if (left.line !== right.line) {
        return left.line - right.line;
      }

      return left.column - right.column;
    });
}

export function buildClassifiedReportSummary(
  classifiedIssues: ClassifiedIssueSets,
  options: BuildSummaryOptions = {},
): ClassifiedReportSummary {
  const hotspotLimit = options.hotspotLimit ?? 5;
  const recommendationLimit = options.recommendationLimit ?? 10;
  const allIssues = getAllClassifiedIssues(classifiedIssues);
  const fileCounts = new Map<string, number>();
  const valueCounts = new Map<string, number>();
  const allRecommendations = buildRecommendations(classifiedIssues.ambiguous);
  const confidence: Record<RecommendationConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const issue of allIssues) {
    incrementCount(fileCounts, issue.filePath);
    incrementCount(valueCounts, issue.rawValue);
  }

  for (const recommendation of allRecommendations) {
    confidence[recommendation.confidence] += 1;
  }

  return {
    totalIssues: allIssues.length,
    cases: {
      deterministic: classifiedIssues.deterministic.length,
      ambiguous: classifiedIssues.ambiguous.length,
      'no-candidate': classifiedIssues.noCandidate.length,
      unsupported: classifiedIssues.unsupported.length,
    },
    confidence,
    hotspots: {
      files: sortCounts(fileCounts, hotspotLimit),
      values: sortCounts(valueCounts, hotspotLimit),
    },
    recommendations: allRecommendations.slice(0, recommendationLimit),
  };
}

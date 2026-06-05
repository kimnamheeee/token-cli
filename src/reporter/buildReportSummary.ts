import type {
  ClassifiedIssueSets,
  DetectedHardcodedValue,
} from '../types/index.js';
import {
  buildReportDecisions,
  type RecommendationConfidence,
  type ReportDecision,
  type ReportDecisionType,
  type ReportSeverity,
} from './buildReportDecisions.js';

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
  decision: ReportDecisionType;
  severity: ReportSeverity;
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
  decisions: Record<ReportDecisionType, number>;
  severity: Record<ReportSeverity, number>;
  hotspots: {
    files: ReportCount[];
    values: ReportCount[];
  };
  recommendations: ReportRecommendation[];
  reportDecisions: ReportDecision[];
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

function getConfidenceRank(confidence: RecommendationConfidence): number {
  if (confidence === 'high') {
    return 3;
  }

  if (confidence === 'medium') {
    return 2;
  }

  return 1;
}

function getDecisionRank(decision: ReportDecisionType): number {
  if (decision === 'safe-replacement') {
    return 4;
  }

  if (decision === 'ambiguous') {
    return 3;
  }

  if (decision === 'unknown') {
    return 2;
  }

  return 1;
}

function buildRecommendations(
  decisions: ReportDecision[],
): ReportRecommendation[] {
  return decisions
    .flatMap((decision): ReportRecommendation[] => {
      const [topCandidate] = decision.topCandidates;

      if (!topCandidate) {
        return [];
      }

      return [
        {
          file: decision.file,
          line: decision.line,
          column: decision.column,
          property: decision.property,
          value: decision.value,
          decision: decision.decision,
          severity: decision.severity,
          token: topCandidate.id,
          score: topCandidate.score,
          scoreGap: decision.scoreGap ?? 0,
          confidence: decision.confidence ?? 'low',
          reasons: topCandidate.reasons,
        },
      ];
    })
    .sort((left, right) => {
      const decisionDiff =
        getDecisionRank(right.decision) - getDecisionRank(left.decision);

      if (decisionDiff !== 0) {
        return decisionDiff;
      }

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
  const reportDecisions = buildReportDecisions(classifiedIssues);
  const fileCounts = new Map<string, number>();
  const valueCounts = new Map<string, number>();
  const allRecommendations = buildRecommendations(reportDecisions);
  const confidence: Record<RecommendationConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const decisions: Record<ReportDecisionType, number> = {
    'safe-replacement': 0,
    ambiguous: 0,
    unknown: 0,
    unsupported: 0,
  };
  const severity: Record<ReportSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
    unknown: 0,
  };

  for (const issue of allIssues) {
    incrementCount(fileCounts, issue.filePath);
    incrementCount(valueCounts, issue.rawValue);
  }

  for (const decision of reportDecisions) {
    decisions[decision.decision] += 1;
    severity[decision.severity] += 1;

    if (decision.sourceCase === 'ambiguous' && decision.confidence) {
      confidence[decision.confidence] += 1;
    }
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
    decisions,
    severity,
    hotspots: {
      files: sortCounts(fileCounts, hotspotLimit),
      values: sortCounts(valueCounts, hotspotLimit),
    },
    recommendations: allRecommendations.slice(0, recommendationLimit),
    reportDecisions,
  };
}

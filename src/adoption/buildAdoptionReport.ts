import { buildDesignSyncReport } from '../sync/buildDesignSyncReport.js';
import type { ConfigAuthority } from '../config/loadConfig.js';
import type { ParsedDesignMd } from '../sources/designMd/parseDesignMd.js';
import type {
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  LoadedTokens,
  TokenRecord,
  TokenType,
} from '../types/index.js';

export interface AdoptionCoverage {
  totalDetectedValues: number;
  tokenMatchedValues: number;
  rawUnmatchedValues: number;
  coveragePercent: number;
  byCategory: Record<
    TokenType,
    {
      total: number;
      matched: number;
      coveragePercent: number;
    }
  >;
}

export interface ThemeRisk {
  token: string;
  missingModes: string[];
  availableModes: string[];
}

export interface AdoptionReport {
  snapshotVersion: 1;
  generatedAt: string;
  coverage: AdoptionCoverage;
  topRawValuesBlockingCoverage: Array<{
    value: string;
    count: number;
  }>;
  underusedTokenGroups: Array<{
    group: string;
    unused: number;
    total: number;
  }>;
  themeSafety: {
    requiredModes: string[];
    tokenModeCoverage: {
      totalModeAwareTokens: number;
      complete: number;
      incomplete: number;
    };
    risks: ThemeRisk[];
    rawValueThemeRiskCount: number;
  };
  parity?: {
    authority: ConfigAuthority;
    summary: ReturnType<typeof buildDesignSyncReport>['summary'];
  };
}

interface BuildAdoptionReportOptions {
  generatedAt?: string;
  requiredModes?: string[];
  designMd?: ParsedDesignMd;
  authority?: ConfigAuthority;
}

const TOKEN_TYPES: TokenType[] = [
  'color',
  'spacing',
  'radius',
  'typography',
  'shadow',
  'unknown',
];

function getMatchedValues(classifiedIssues: ClassifiedIssueSets): Set<string> {
  return new Set([
    ...classifiedIssues.deterministic.map((issue) => issue.normalizedValue),
    ...classifiedIssues.ambiguous.map((issue) => issue.normalizedValue),
  ]);
}

function getUnmatchedValues(
  classifiedIssues: ClassifiedIssueSets,
): DetectedHardcodedValue[] {
  return [...classifiedIssues.noCandidate, ...classifiedIssues.unsupported];
}

function getCoveragePercent(matched: number, total: number): number {
  if (total === 0) {
    return 100;
  }

  return Math.round((matched / total) * 1000) / 10;
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function buildCoverage(
  detectedValues: DetectedHardcodedValue[],
  classifiedIssues: ClassifiedIssueSets,
): AdoptionCoverage {
  const matchedValues = getMatchedValues(classifiedIssues);
  const byCategory = Object.fromEntries(
    TOKEN_TYPES.map((type) => [
      type,
      {
        total: 0,
        matched: 0,
        coveragePercent: 100,
      },
    ]),
  ) as AdoptionCoverage['byCategory'];

  for (const detectedValue of detectedValues) {
    const category = detectedValue.tokenGroup;
    const bucket = byCategory[category];

    bucket.total += 1;

    if (matchedValues.has(detectedValue.normalizedValue)) {
      bucket.matched += 1;
    }
  }

  for (const bucket of Object.values(byCategory)) {
    bucket.coveragePercent = getCoveragePercent(bucket.matched, bucket.total);
  }

  const tokenMatchedValues =
    classifiedIssues.deterministic.length + classifiedIssues.ambiguous.length;

  return {
    totalDetectedValues: detectedValues.length,
    tokenMatchedValues,
    rawUnmatchedValues:
      classifiedIssues.noCandidate.length + classifiedIssues.unsupported.length,
    coveragePercent: getCoveragePercent(
      tokenMatchedValues,
      detectedValues.length,
    ),
    byCategory,
  };
}

function buildTopRawValueBlockers(
  classifiedIssues: ClassifiedIssueSets,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();

  for (const issue of getUnmatchedValues(classifiedIssues)) {
    incrementCount(counts, issue.rawValue);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.value.localeCompare(right.value);
    })
    .slice(0, 10);
}

function buildUnderusedTokenGroups(
  tokens: LoadedTokens,
  classifiedIssues: ClassifiedIssueSets,
): Array<{ group: string; unused: number; total: number }> {
  const usedTokenIds = new Set([
    ...classifiedIssues.deterministic.map((issue) => issue.suggestion),
    ...classifiedIssues.ambiguous.flatMap((issue) => issue.candidates),
  ]);
  const totals = new Map<string, { total: number; used: number }>();

  for (const token of tokens.records) {
    const key = `${token.level}.${token.type}`;
    const bucket = totals.get(key) ?? { total: 0, used: 0 };

    bucket.total += 1;

    if (usedTokenIds.has(token.id)) {
      bucket.used += 1;
    }

    totals.set(key, bucket);
  }

  return [...totals.entries()]
    .map(([group, count]) => ({
      group,
      unused: count.total - count.used,
      total: count.total,
    }))
    .filter((group) => group.unused > 0)
    .sort((left, right) => {
      if (left.unused !== right.unused) {
        return right.unused - left.unused;
      }

      return left.group.localeCompare(right.group);
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getTokenModes(token: TokenRecord): string[] {
  const extensions = token.metadata?.extensions;

  if (!isRecord(extensions)) {
    return [];
  }

  const modes = extensions.modes ?? extensions.modeValues;

  if (!isRecord(modes)) {
    return [];
  }

  return Object.keys(modes).sort((left, right) => left.localeCompare(right));
}

function buildThemeSafety(
  tokens: LoadedTokens,
  classifiedIssues: ClassifiedIssueSets,
  requiredModes: string[],
): AdoptionReport['themeSafety'] {
  const risks: ThemeRisk[] = [];
  let totalModeAwareTokens = 0;
  let complete = 0;

  for (const token of tokens.records) {
    const availableModes = getTokenModes(token);

    if (availableModes.length === 0) {
      continue;
    }

    totalModeAwareTokens += 1;

    const missingModes = requiredModes.filter(
      (mode) => !availableModes.includes(mode),
    );

    if (missingModes.length === 0) {
      complete += 1;
      continue;
    }

    risks.push({
      token: token.id,
      missingModes,
      availableModes,
    });
  }

  return {
    requiredModes,
    tokenModeCoverage: {
      totalModeAwareTokens,
      complete,
      incomplete: totalModeAwareTokens - complete,
    },
    risks,
    rawValueThemeRiskCount:
      classifiedIssues.noCandidate.length + classifiedIssues.unsupported.length,
  };
}

export function buildAdoptionReport(
  detectedValues: DetectedHardcodedValue[],
  classifiedIssues: ClassifiedIssueSets,
  tokens: LoadedTokens,
  options: BuildAdoptionReportOptions = {},
): AdoptionReport {
  const authority = options.authority ?? 'compare-only';
  const parity = options.designMd
    ? {
        authority,
        summary: buildDesignSyncReport(
          options.designMd.tokens,
          tokens,
          options.designMd.issues,
          authority,
        ).summary,
      }
    : undefined;

  return {
    snapshotVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    coverage: buildCoverage(detectedValues, classifiedIssues),
    topRawValuesBlockingCoverage: buildTopRawValueBlockers(classifiedIssues),
    underusedTokenGroups: buildUnderusedTokenGroups(tokens, classifiedIssues),
    themeSafety: buildThemeSafety(
      tokens,
      classifiedIssues,
      options.requiredModes ?? ['light', 'dark', 'high-contrast'],
    ),
    parity,
  };
}

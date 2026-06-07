import type {
  DetectedHardcodedValue,
  LoadedTokens,
  TokenRecord,
} from '../types/index.js';

export type ConsolidationRecommendation =
  | 'deprecate'
  | 'keep-separate'
  | 'merge-review'
  | 'replace-with';

export interface ConsolidationUsageSummary {
  total: number;
  properties: Record<string, number>;
  roles: Record<string, number>;
  files: Record<string, number>;
}

export interface SameValueTokenGroup {
  value: string;
  type: string;
  tokens: string[];
  deprecatedTokens: string[];
  replacementCandidates: string[];
  usage: ConsolidationUsageSummary;
  recommendation: ConsolidationRecommendation;
  reason: string;
}

export interface NearValueTokenGroup {
  leftToken: string;
  rightToken: string;
  leftValue: string;
  rightValue: string;
  type: string;
  distance: number;
}

export interface UnusedToken {
  token: string;
  value: string;
  type: string;
  deprecated: boolean;
}

export interface ConsolidationReport {
  summary: {
    sameValueGroups: number;
    nearValueGroups: number;
    unusedTokens: number;
    deprecatedTokens: number;
  };
  sameValueGroups: SameValueTokenGroup[];
  nearValueGroups: NearValueTokenGroup[];
  unusedTokens: UnusedToken[];
}

interface BuildConsolidationReportOptions {
  detectedValues?: DetectedHardcodedValue[];
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function getPropertyRole(property: string): string {
  const normalizedProperty = property.toLowerCase();

  if (normalizedProperty.includes('background')) {
    return 'background';
  }

  if (
    normalizedProperty.includes('border') ||
    normalizedProperty.includes('outline')
  ) {
    return 'border';
  }

  if (normalizedProperty.includes('color')) {
    return 'text';
  }

  if (normalizedProperty.includes('gap')) {
    return 'gap';
  }

  if (normalizedProperty.includes('padding')) {
    return 'padding';
  }

  if (normalizedProperty.includes('margin')) {
    return 'margin';
  }

  if (normalizedProperty.includes('radius')) {
    return 'radius';
  }

  return 'unknown';
}

function getTokenRole(record: TokenRecord): string {
  const role =
    typeof record.metadata?.role === 'string' ? record.metadata.role : '';
  const text = `${record.id}.${role}`.toLowerCase();

  if (
    text.includes('background') ||
    text.includes('surface') ||
    text.includes('bg')
  ) {
    return 'background';
  }

  if (
    text.includes('border') ||
    text.includes('divider') ||
    text.includes('outline')
  ) {
    return 'border';
  }

  if (
    text.includes('text') ||
    text.includes('foreground') ||
    text.includes('content')
  ) {
    return 'text';
  }

  if (text.includes('icon')) {
    return 'icon';
  }

  if (text.includes('radius')) {
    return 'radius';
  }

  if (text.includes('gap')) {
    return 'gap';
  }

  if (text.includes('padding')) {
    return 'padding';
  }

  if (text.includes('margin')) {
    return 'margin';
  }

  return 'unknown';
}

function isDeprecated(record: TokenRecord): boolean {
  return (
    record.metadata?.deprecated !== undefined &&
    record.metadata.deprecated !== false
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getReplacementCandidate(record: TokenRecord): string | undefined {
  const extensions = record.metadata?.extensions;

  if (!isRecord(extensions)) {
    return undefined;
  }

  const candidates = [
    extensions.replacement,
    extensions.replacedBy,
    extensions.replacementToken,
  ];

  return candidates.find(
    (candidate): candidate is string => typeof candidate === 'string',
  );
}

function buildUsageSummary(
  records: TokenRecord[],
  detectedValues: DetectedHardcodedValue[],
): ConsolidationUsageSummary {
  const normalizedValues = new Set(
    records.map((record) => record.normalizedResolvedValue),
  );
  const properties: Record<string, number> = {};
  const roles: Record<string, number> = {};
  const files: Record<string, number> = {};

  for (const detectedValue of detectedValues) {
    if (!normalizedValues.has(detectedValue.normalizedValue)) {
      continue;
    }

    increment(properties, detectedValue.property);
    increment(roles, getPropertyRole(detectedValue.property));
    increment(files, detectedValue.filePath);
  }

  return {
    total: Object.values(properties).reduce((sum, count) => sum + count, 0),
    properties,
    roles,
    files,
  };
}

function chooseRecommendation(
  records: TokenRecord[],
  usage: ConsolidationUsageSummary,
): { recommendation: ConsolidationRecommendation; reason: string } {
  const replacementCandidates = records
    .map(getReplacementCandidate)
    .filter((candidate): candidate is string => Boolean(candidate));

  if (replacementCandidates.length > 0) {
    return {
      recommendation: 'replace-with',
      reason: 'deprecated metadata provides an explicit replacement candidate',
    };
  }

  if (records.some(isDeprecated)) {
    return {
      recommendation: 'deprecate',
      reason: 'one or more tokens are marked deprecated',
    };
  }

  const tokenRoles = new Set(
    records.map(getTokenRole).filter((role) => role !== 'unknown'),
  );
  const usageRoles = new Set(
    Object.keys(usage.roles).filter((role) => role !== 'unknown'),
  );

  if (tokenRoles.size > 1 || usageRoles.size > 1) {
    return {
      recommendation: 'keep-separate',
      reason:
        'same value is used across distinct semantic roles or property contexts',
    };
  }

  const hasPrimitive = records.some((record) => record.level === 'primitive');
  const hasHigherLevel = records.some(
    (record) => record.level === 'semantic' || record.level === 'component',
  );

  if (hasPrimitive && hasHigherLevel) {
    return {
      recommendation: 'deprecate',
      reason: 'primitive token duplicates a semantic or component token value',
    };
  }

  return {
    recommendation: 'merge-review',
    reason: 'tokens share a value and do not show distinct role usage yet',
  };
}

function groupByResolvedValue(tokens: LoadedTokens): TokenRecord[][] {
  return [...tokens.recordsByNormalizedValue.values()].filter(
    (records) => records.length > 1,
  );
}

function parseNumericValue(value: string): number | null {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseHexColor(
  value: string,
): { red: number; green: number; blue: number } | null {
  const normalized = value.trim().toLowerCase();

  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function getDistance(left: TokenRecord, right: TokenRecord): number | null {
  if (
    left.type !== right.type ||
    left.normalizedResolvedValue === right.normalizedResolvedValue
  ) {
    return null;
  }

  if (left.type === 'color') {
    const leftColor = parseHexColor(left.normalizedResolvedValue);
    const rightColor = parseHexColor(right.normalizedResolvedValue);

    if (!leftColor || !rightColor) {
      return null;
    }

    return Math.sqrt(
      (leftColor.red - rightColor.red) ** 2 +
        (leftColor.green - rightColor.green) ** 2 +
        (leftColor.blue - rightColor.blue) ** 2,
    );
  }

  if (left.type === 'spacing' || left.type === 'radius') {
    const leftValue = parseNumericValue(left.normalizedResolvedValue);
    const rightValue = parseNumericValue(right.normalizedResolvedValue);

    if (leftValue === null || rightValue === null) {
      return null;
    }

    return Math.abs(leftValue - rightValue);
  }

  return null;
}

function buildNearValueGroups(records: TokenRecord[]): NearValueTokenGroup[] {
  const groups: NearValueTokenGroup[] = [];

  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < records.length;
      rightIndex += 1
    ) {
      const left = records[leftIndex];
      const right = records[rightIndex];

      if (!left || !right) {
        continue;
      }

      const distance = getDistance(left, right);

      if (distance === null) {
        continue;
      }

      const threshold = left.type === 'color' ? 3 : 2;

      if (distance > threshold) {
        continue;
      }

      groups.push({
        leftToken: left.id,
        rightToken: right.id,
        leftValue: String(left.resolvedValue),
        rightValue: String(right.resolvedValue),
        type: left.type,
        distance,
      });
    }
  }

  return groups.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }

    return left.leftToken.localeCompare(right.leftToken);
  });
}

export function buildConsolidationReport(
  tokens: LoadedTokens,
  options: BuildConsolidationReportOptions = {},
): ConsolidationReport {
  const detectedValues = options.detectedValues ?? [];
  const sameValueGroups = groupByResolvedValue(tokens).map((records) => {
    const usage = buildUsageSummary(records, detectedValues);
    const recommendation = chooseRecommendation(records, usage);

    return {
      value: records[0]?.normalizedResolvedValue ?? '',
      type: records[0]?.type ?? 'unknown',
      tokens: records.map((record) => record.id),
      deprecatedTokens: records.filter(isDeprecated).map((record) => record.id),
      replacementCandidates: records
        .map(getReplacementCandidate)
        .filter((candidate): candidate is string => Boolean(candidate)),
      usage,
      ...recommendation,
    };
  });
  const usedValues = new Set(
    detectedValues.map((value) => value.normalizedValue),
  );
  const unusedTokens = tokens.records
    .filter((record) => !usedValues.has(record.normalizedResolvedValue))
    .map((record) => ({
      token: record.id,
      value: String(record.resolvedValue),
      type: record.type,
      deprecated: isDeprecated(record),
    }));

  return {
    summary: {
      sameValueGroups: sameValueGroups.length,
      nearValueGroups: buildNearValueGroups(tokens.records).length,
      unusedTokens: unusedTokens.length,
      deprecatedTokens: tokens.records.filter(isDeprecated).length,
    },
    sameValueGroups,
    nearValueGroups: buildNearValueGroups(tokens.records),
    unusedTokens,
  };
}

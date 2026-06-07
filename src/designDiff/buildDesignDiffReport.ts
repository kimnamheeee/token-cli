import type { ParsedDesignMd } from '../sources/designMd/parseDesignMd.js';
import type { DetectedHardcodedValue, TokenRecord } from '../types/index.js';

export interface DesignTokenChange {
  token: string;
  oldValue?: string;
  newValue?: string;
  impactedRawValueCount: number;
}

export interface DesignGuidanceIssue {
  token: string;
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  severity: 'warning';
  message: string;
}

export interface DesignDiffReport {
  summary: {
    addedTokens: number;
    removedTokens: number;
    modifiedTokens: number;
    guidanceWarnings: number;
    impactedCodeLocations: number;
  };
  addedTokens: DesignTokenChange[];
  removedTokens: DesignTokenChange[];
  modifiedTokens: DesignTokenChange[];
  guidanceIssues: DesignGuidanceIssue[];
}

interface BuildDesignDiffReportOptions {
  detectedValues?: DetectedHardcodedValue[];
}

function toDisplayValue(record: TokenRecord): string {
  return String(record.resolvedValue);
}

function countRawValueImpacts(
  values: string[],
  detectedValues: DetectedHardcodedValue[],
): number {
  const normalizedValues = new Set(values.map((value) => value.toLowerCase()));

  return detectedValues.filter((detectedValue) =>
    normalizedValues.has(detectedValue.normalizedValue.toLowerCase()),
  ).length;
}

function normalizeProperty(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function propertyMatches(
  ruleProperties: string[] | undefined,
  property: string,
): boolean {
  if (!ruleProperties || ruleProperties.length === 0) {
    return true;
  }

  const normalizedProperty = normalizeProperty(property);

  return ruleProperties.some(
    (ruleProperty) => normalizeProperty(ruleProperty) === normalizedProperty,
  );
}

function contextMatches(
  ruleContexts: string[] | undefined,
  filePath: string,
): boolean {
  if (!ruleContexts || ruleContexts.length === 0) {
    return true;
  }

  const normalizedFilePath = filePath.toLowerCase();

  return ruleContexts.some((context) =>
    normalizedFilePath.includes(context.toLowerCase()),
  );
}

function buildGuidanceIssues(
  newDesign: ParsedDesignMd,
  detectedValues: DetectedHardcodedValue[],
): DesignGuidanceIssue[] {
  const issues: DesignGuidanceIssue[] = [];

  for (const rule of newDesign.guidanceRules) {
    const tokenRecord = newDesign.tokens.recordsById.get(rule.token);

    if (!tokenRecord || !rule.avoid) {
      continue;
    }

    for (const detectedValue of detectedValues) {
      if (
        detectedValue.normalizedValue !== tokenRecord.normalizedResolvedValue
      ) {
        continue;
      }

      if (!propertyMatches(rule.avoid.properties, detectedValue.property)) {
        continue;
      }

      if (!contextMatches(rule.avoid.contexts, detectedValue.filePath)) {
        continue;
      }

      issues.push({
        token: rule.token,
        file: detectedValue.filePath,
        line: detectedValue.line,
        column: detectedValue.column,
        property: detectedValue.property,
        value: detectedValue.rawValue,
        severity: 'warning',
        message:
          rule.reason ??
          `${rule.token} is discouraged for ${detectedValue.property}`,
      });
    }
  }

  return issues;
}

export function buildDesignDiffReport(
  oldDesign: ParsedDesignMd,
  newDesign: ParsedDesignMd,
  options: BuildDesignDiffReportOptions = {},
): DesignDiffReport {
  const detectedValues = options.detectedValues ?? [];
  const addedTokens: DesignTokenChange[] = [];
  const removedTokens: DesignTokenChange[] = [];
  const modifiedTokens: DesignTokenChange[] = [];

  for (const newRecord of newDesign.tokens.records) {
    const oldRecord = oldDesign.tokens.recordsById.get(newRecord.id);

    if (!oldRecord) {
      addedTokens.push({
        token: newRecord.id,
        newValue: toDisplayValue(newRecord),
        impactedRawValueCount: countRawValueImpacts(
          [newRecord.normalizedResolvedValue],
          detectedValues,
        ),
      });
      continue;
    }

    if (
      oldRecord.normalizedResolvedValue !== newRecord.normalizedResolvedValue
    ) {
      modifiedTokens.push({
        token: newRecord.id,
        oldValue: toDisplayValue(oldRecord),
        newValue: toDisplayValue(newRecord),
        impactedRawValueCount: countRawValueImpacts(
          [
            oldRecord.normalizedResolvedValue,
            newRecord.normalizedResolvedValue,
          ],
          detectedValues,
        ),
      });
    }
  }

  for (const oldRecord of oldDesign.tokens.records) {
    if (newDesign.tokens.recordsById.has(oldRecord.id)) {
      continue;
    }

    removedTokens.push({
      token: oldRecord.id,
      oldValue: toDisplayValue(oldRecord),
      impactedRawValueCount: countRawValueImpacts(
        [oldRecord.normalizedResolvedValue],
        detectedValues,
      ),
    });
  }

  const guidanceIssues = buildGuidanceIssues(newDesign, detectedValues);
  const impactedCodeLocations =
    addedTokens.reduce((count, item) => count + item.impactedRawValueCount, 0) +
    removedTokens.reduce(
      (count, item) => count + item.impactedRawValueCount,
      0,
    ) +
    modifiedTokens.reduce(
      (count, item) => count + item.impactedRawValueCount,
      0,
    );

  return {
    summary: {
      addedTokens: addedTokens.length,
      removedTokens: removedTokens.length,
      modifiedTokens: modifiedTokens.length,
      guidanceWarnings: guidanceIssues.length,
      impactedCodeLocations,
    },
    addedTokens,
    removedTokens,
    modifiedTokens,
    guidanceIssues,
  };
}

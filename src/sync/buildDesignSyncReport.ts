import type { ConfigAuthority } from '../config/loadConfig.js';
import type { LoadedTokens, TokenRecord } from '../types/index.js';
import type { DesignMdLintIssue } from '../sources/designMd/parseDesignMd.js';

export type DesignSyncIssueKind =
  | 'design-lint'
  | 'value-mismatch'
  | 'missing-in-code'
  | 'code-only-token'
  | 'same-value-different-name';

export type DesignSyncSeverity = 'error' | 'warning' | 'info';

export interface DesignSyncIssue {
  kind: DesignSyncIssueKind;
  severity: DesignSyncSeverity;
  token?: string;
  designToken?: string;
  codeToken?: string;
  designValue?: string;
  codeValue?: string;
  message: string;
}

export interface DesignSyncReport {
  authority: ConfigAuthority;
  summary: Record<DesignSyncIssueKind, number>;
  issues: DesignSyncIssue[];
}

function getMismatchSeverity(
  authority: ConfigAuthority,
  source: 'design' | 'code',
): DesignSyncSeverity {
  if (authority === 'compare-only') {
    return 'info';
  }

  if (authority === 'design-md' && source === 'design') {
    return 'error';
  }

  if (authority === 'code' && source === 'code') {
    return 'error';
  }

  return 'warning';
}

function toDisplayValue(record: TokenRecord): string {
  return String(record.resolvedValue);
}

function toLintIssue(issue: DesignMdLintIssue): DesignSyncIssue {
  return {
    kind: 'design-lint',
    severity: issue.severity === 'error' ? 'error' : 'warning',
    token: issue.path,
    message: issue.path ? `${issue.path}: ${issue.message}` : issue.message,
  };
}

function createEmptySummary(): Record<DesignSyncIssueKind, number> {
  return {
    'design-lint': 0,
    'value-mismatch': 0,
    'missing-in-code': 0,
    'code-only-token': 0,
    'same-value-different-name': 0,
  };
}

function addIssue(issues: DesignSyncIssue[], issue: DesignSyncIssue): void {
  issues.push(issue);
}

function addSameValueDifferentNameIssues(
  issues: DesignSyncIssue[],
  designTokens: LoadedTokens,
  codeTokens: LoadedTokens,
): void {
  for (const designRecord of designTokens.records) {
    const codeRecords =
      codeTokens.recordsByNormalizedValue.get(
        designRecord.normalizedResolvedValue,
      ) ?? [];

    for (const codeRecord of codeRecords) {
      if (codeRecord.id === designRecord.id) {
        continue;
      }

      addIssue(issues, {
        kind: 'same-value-different-name',
        severity: 'info',
        designToken: designRecord.id,
        codeToken: codeRecord.id,
        designValue: toDisplayValue(designRecord),
        codeValue: toDisplayValue(codeRecord),
        message: `${designRecord.id} and ${codeRecord.id} resolve to the same value`,
      });
    }
  }
}

export function buildDesignSyncReport(
  designTokens: LoadedTokens,
  codeTokens: LoadedTokens,
  designIssues: DesignMdLintIssue[] = [],
  authority: ConfigAuthority = 'compare-only',
): DesignSyncReport {
  const issues: DesignSyncIssue[] = designIssues.map(toLintIssue);

  for (const designRecord of designTokens.records) {
    const codeRecord = codeTokens.recordsById.get(designRecord.id);

    if (!codeRecord) {
      addIssue(issues, {
        kind: 'missing-in-code',
        severity: getMismatchSeverity(authority, 'design'),
        designToken: designRecord.id,
        designValue: toDisplayValue(designRecord),
        message: `${designRecord.id} exists in DESIGN.md but not in code tokens`,
      });
      continue;
    }

    if (
      codeRecord.normalizedResolvedValue !==
      designRecord.normalizedResolvedValue
    ) {
      addIssue(issues, {
        kind: 'value-mismatch',
        severity: getMismatchSeverity(authority, 'design'),
        token: designRecord.id,
        designValue: toDisplayValue(designRecord),
        codeValue: toDisplayValue(codeRecord),
        message: `${designRecord.id} has different DESIGN.md and code token values`,
      });
    }
  }

  for (const codeRecord of codeTokens.records) {
    if (designTokens.recordsById.has(codeRecord.id)) {
      continue;
    }

    addIssue(issues, {
      kind: 'code-only-token',
      severity: getMismatchSeverity(authority, 'code'),
      codeToken: codeRecord.id,
      codeValue: toDisplayValue(codeRecord),
      message: `${codeRecord.id} exists in code tokens but not in DESIGN.md`,
    });
  }

  addSameValueDifferentNameIssues(issues, designTokens, codeTokens);

  const summary = createEmptySummary();

  for (const issue of issues) {
    summary[issue.kind] += 1;
  }

  return {
    authority,
    summary,
    issues,
  };
}

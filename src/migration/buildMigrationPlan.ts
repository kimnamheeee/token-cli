import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  buildReportDecisions,
  type ReportDecision,
} from '../reporter/buildReportDecisions.js';
import type {
  ClassifiedIssueSets,
  RankedTokenCandidate,
} from '../types/index.js';

export type MigrationPlanGroup =
  | 'safe-replacements'
  | 'needs-review'
  | 'no-token-found'
  | 'unsupported';

export interface MigrationPlanItem {
  id: string;
  group: MigrationPlanGroup;
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  decision: ReportDecision['decision'];
  severity: ReportDecision['severity'];
  message: string;
  replacementCandidateId?: string;
  candidates: RankedTokenCandidate[];
  missingContext?: string[];
}

export interface MigrationPlan {
  summary: Record<MigrationPlanGroup, number>;
  items: MigrationPlanItem[];
  groups: Record<MigrationPlanGroup, MigrationPlanItem[]>;
}

interface BuildMigrationPlanOptions {
  rootPath?: string;
}

const EMPTY_SUMMARY: Record<MigrationPlanGroup, number> = {
  'safe-replacements': 0,
  'needs-review': 0,
  'no-token-found': 0,
  unsupported: 0,
};

function getPlanGroup(decision: ReportDecision): MigrationPlanGroup {
  if (decision.decision === 'safe-replacement') {
    return 'safe-replacements';
  }

  if (decision.decision === 'ambiguous') {
    return 'needs-review';
  }

  if (decision.decision === 'unknown') {
    return 'no-token-found';
  }

  return 'unsupported';
}

function toStableIssueId(decision: ReportDecision, rootPath: string): string {
  const relativeFilePath = path
    .relative(rootPath, decision.file)
    .split(path.sep)
    .join('/');
  const stableKey = [
    relativeFilePath,
    decision.line,
    decision.column,
    decision.property,
    decision.value,
  ].join('|');
  const hash = createHash('sha256')
    .update(stableKey)
    .digest('hex')
    .slice(0, 10);

  return `MIG-${hash}`;
}

function toMigrationPlanItem(
  decision: ReportDecision,
  rootPath: string,
): MigrationPlanItem {
  const [replacementCandidate] = decision.topCandidates;

  return {
    id: toStableIssueId(decision, rootPath),
    group: getPlanGroup(decision),
    file: decision.file,
    line: decision.line,
    column: decision.column,
    property: decision.property,
    value: decision.value,
    decision: decision.decision,
    severity: decision.severity,
    message: decision.message,
    replacementCandidateId:
      decision.decision === 'safe-replacement'
        ? replacementCandidate?.id
        : undefined,
    candidates: decision.topCandidates,
    missingContext: decision.missingContext,
  };
}

export function buildMigrationPlan(
  classifiedIssues: ClassifiedIssueSets,
  options: BuildMigrationPlanOptions = {},
): MigrationPlan {
  const rootPath = options.rootPath ?? process.cwd();
  const items = buildReportDecisions(classifiedIssues).map((decision) =>
    toMigrationPlanItem(decision, rootPath),
  );
  const groups: Record<MigrationPlanGroup, MigrationPlanItem[]> = {
    'safe-replacements': [],
    'needs-review': [],
    'no-token-found': [],
    unsupported: [],
  };

  for (const item of items) {
    groups[item.group].push(item);
  }

  return {
    summary: {
      ...EMPTY_SUMMARY,
      'safe-replacements': groups['safe-replacements'].length,
      'needs-review': groups['needs-review'].length,
      'no-token-found': groups['no-token-found'].length,
      unsupported: groups.unsupported.length,
    },
    items,
    groups,
  };
}

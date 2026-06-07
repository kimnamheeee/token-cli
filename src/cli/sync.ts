import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ConfigAuthority } from '../config/loadConfig.js';
import { loadDesignMd } from '../sources/designMd/parseDesignMd.js';
import {
  buildDesignSyncReport,
  type DesignSyncIssue,
  type DesignSyncIssueKind,
  type DesignSyncReport,
} from '../sync/buildDesignSyncReport.js';
import { loadTokens } from '../tokens/loadTokens.js';

export interface SyncOptions {
  designPath?: string;
  tokenPath?: string;
  authority?: ConfigAuthority;
  format?: 'json';
  outputPath?: string;
  limit?: number;
}

function getIssueTitle(kind: DesignSyncIssueKind): string {
  if (kind === 'design-lint') {
    return 'DESIGN.md lint issues';
  }

  if (kind === 'value-mismatch') {
    return 'Token value mismatches';
  }

  if (kind === 'missing-in-code') {
    return 'Missing in code';
  }

  if (kind === 'code-only-token') {
    return 'Code-only tokens';
  }

  return 'Same value, different names';
}

function printIssue(issue: DesignSyncIssue): void {
  const subject =
    issue.token ?? issue.designToken ?? issue.codeToken ?? '<unknown>';

  console.log(`  ${issue.severity} ${subject}`);

  if (issue.designValue !== undefined) {
    console.log(`      DESIGN.md: ${issue.designValue}`);
  }

  if (issue.codeValue !== undefined) {
    console.log(`      code:      ${issue.codeValue}`);
  }

  if (issue.designToken && issue.codeToken) {
    console.log(`      names:     ${issue.designToken} / ${issue.codeToken}`);
  }

  console.log(`      ${issue.message}`);
}

function printSyncReport(report: DesignSyncReport, limit: number): void {
  console.log('DESIGN.md sync report');
  console.log('');
  console.log(`Authority: ${report.authority}`);
  console.log('');
  console.log('Summary');
  console.log(`  design lint ${report.summary['design-lint']}`);
  console.log(`  value mismatch ${report.summary['value-mismatch']}`);
  console.log(`  missing in code ${report.summary['missing-in-code']}`);
  console.log(`  code-only token ${report.summary['code-only-token']}`);
  console.log(
    `  same value/different name ${report.summary['same-value-different-name']}`,
  );

  const issueKinds: DesignSyncIssueKind[] = [
    'design-lint',
    'value-mismatch',
    'missing-in-code',
    'code-only-token',
    'same-value-different-name',
  ];

  for (const kind of issueKinds) {
    const issues = report.issues.filter((issue) => issue.kind === kind);

    if (issues.length === 0) {
      continue;
    }

    console.log('');
    console.log(`${getIssueTitle(kind)} (${issues.length})`);

    for (const issue of issues.slice(0, limit)) {
      printIssue(issue);
    }

    if (issues.length > limit) {
      console.log(`  ... ${issues.length - limit} more`);
    }
  }
}

function writeSyncJsonReport(
  report: DesignSyncReport,
  outputPath: string,
): string {
  const resolvedPath = path.resolve(outputPath);

  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(
    resolvedPath,
    `${JSON.stringify(
      {
        mode: 'sync',
        authority: report.authority,
        summary: report.summary,
        issues: report.issues,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedPath;
}

function shouldFailSync(report: DesignSyncReport): boolean {
  return report.issues.some((issue) => issue.severity === 'error');
}

export function sync(options: SyncOptions): number {
  if (!options.designPath) {
    throw new Error(
      'The --design option or config sources.design field is required for sync',
    );
  }

  if (!options.tokenPath) {
    throw new Error(
      'The --tokens option or config tokens field is required for sync',
    );
  }

  const designMd = loadDesignMd(options.designPath);
  const codeTokens = loadTokens(options.tokenPath);
  const report = buildDesignSyncReport(
    designMd.tokens,
    codeTokens,
    designMd.issues,
    options.authority ?? 'compare-only',
  );

  printSyncReport(report, options.limit ?? 10);

  if (options.format === 'json' && options.outputPath) {
    const resolvedOutputPath = writeSyncJsonReport(report, options.outputPath);

    console.log('');
    console.log(`Sync JSON report written to ${resolvedOutputPath}`);
  }

  return shouldFailSync(report) ? 1 : 0;
}

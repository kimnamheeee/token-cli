import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildDesignDiffReport,
  type DesignDiffReport,
  type DesignGuidanceIssue,
  type DesignTokenChange,
} from '../designDiff/buildDesignDiffReport.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadDesignMd } from '../sources/designMd/parseDesignMd.js';
import type {
  DetectedHardcodedValue,
  InlineStyleBlock,
} from '../types/index.js';
import { discoverTargetFiles } from './discoverTargetFiles.js';
import type { ScanError } from './scan.js';

export interface DesignDiffOptions {
  oldDesignPath: string;
  newDesignPath: string;
  targetPath?: string;
  format?: 'json';
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  limit?: number;
}

interface TargetScanResult {
  targetFiles: string[];
  detectedValues: DetectedHardcodedValue[];
  scanErrors: ScanError[];
}

function scanTarget(
  targetPath: string | undefined,
  options: Pick<DesignDiffOptions, 'include' | 'exclude'>,
): TargetScanResult {
  if (!targetPath) {
    return {
      targetFiles: [],
      detectedValues: [],
      scanErrors: [],
    };
  }

  const targetFiles = discoverTargetFiles(targetPath, {
    include: options.include,
    exclude: options.exclude,
  });
  const blocks: InlineStyleBlock[] = [];
  const scanErrors: ScanError[] = [];

  for (const filePath of targetFiles) {
    try {
      blocks.push(...extractInlineStylesFromFile(filePath));
    } catch (error) {
      scanErrors.push({
        file: filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    targetFiles,
    detectedValues: detectHardcodedValues(blocks),
    scanErrors,
  };
}

function printTokenChanges(
  title: string,
  changes: DesignTokenChange[],
  limit: number,
): void {
  if (changes.length === 0) {
    return;
  }

  console.log('');
  console.log(`${title} (${changes.length})`);

  for (const change of changes.slice(0, limit)) {
    const valueText =
      change.oldValue !== undefined && change.newValue !== undefined
        ? `${change.oldValue} -> ${change.newValue}`
        : (change.newValue ?? change.oldValue ?? '<unknown>');

    console.log(
      `  ${change.token}: ${valueText} (${change.impactedRawValueCount} impacted raw value(s))`,
    );
  }

  if (changes.length > limit) {
    console.log(`  ... ${changes.length - limit} more`);
  }
}

function printGuidanceIssues(
  issues: DesignGuidanceIssue[],
  limit: number,
): void {
  if (issues.length === 0) {
    return;
  }

  console.log('');
  console.log(`Guidance warnings (${issues.length})`);

  for (const issue of issues.slice(0, limit)) {
    console.log(
      `  warning ${issue.file}:${issue.line}:${issue.column} ${issue.value} (${issue.token})`,
    );
    console.log(`      ${issue.property}; ${issue.message}`);
  }

  if (issues.length > limit) {
    console.log(`  ... ${issues.length - limit} more`);
  }
}

function printDesignDiffReport(
  report: DesignDiffReport,
  scanResult: TargetScanResult,
  limit: number,
): void {
  console.log('DESIGN.md diff report');
  console.log('');
  console.log(`Scanned files: ${scanResult.targetFiles.length}`);
  console.log(`Scan errors: ${scanResult.scanErrors.length}`);
  console.log('');
  console.log('Summary');
  console.log(`  added tokens ${report.summary.addedTokens}`);
  console.log(`  removed tokens ${report.summary.removedTokens}`);
  console.log(`  modified tokens ${report.summary.modifiedTokens}`);
  console.log(`  guidance warnings ${report.summary.guidanceWarnings}`);
  console.log(
    `  impacted code locations ${report.summary.impactedCodeLocations}`,
  );

  printTokenChanges('Modified tokens', report.modifiedTokens, limit);
  printTokenChanges('Removed tokens', report.removedTokens, limit);
  printTokenChanges('Added tokens', report.addedTokens, limit);
  printGuidanceIssues(report.guidanceIssues, limit);

  if (scanResult.scanErrors.length > 0) {
    console.log('');
    console.log('Scan errors');

    for (const scanError of scanResult.scanErrors) {
      console.log(`  ${scanError.file}: ${scanError.message}`);
    }
  }
}

function writeDesignDiffJsonReport(
  report: DesignDiffReport,
  scanResult: TargetScanResult,
  outputPath: string,
): string {
  const resolvedOutputPath = path.resolve(outputPath);

  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(
      {
        mode: 'design-diff',
        scannedFiles: scanResult.targetFiles,
        scanErrors: scanResult.scanErrors,
        summary: report.summary,
        addedTokens: report.addedTokens,
        removedTokens: report.removedTokens,
        modifiedTokens: report.modifiedTokens,
        guidanceIssues: report.guidanceIssues,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedOutputPath;
}

export function designDiff(options: DesignDiffOptions): number {
  const oldDesign = loadDesignMd(options.oldDesignPath);
  const newDesign = loadDesignMd(options.newDesignPath);
  const scanResult = scanTarget(options.targetPath, options);
  const report = buildDesignDiffReport(oldDesign, newDesign, {
    detectedValues: scanResult.detectedValues,
  });

  printDesignDiffReport(report, scanResult, options.limit ?? 10);

  if (options.format === 'json' && options.outputPath) {
    const resolvedOutputPath = writeDesignDiffJsonReport(
      report,
      scanResult,
      options.outputPath,
    );

    console.log('');
    console.log(`Design diff JSON report written to ${resolvedOutputPath}`);
  }

  return scanResult.scanErrors.length > 0 ? 1 : 0;
}

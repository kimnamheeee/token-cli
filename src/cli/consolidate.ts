import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildConsolidationReport,
  type ConsolidationReport,
  type SameValueTokenGroup,
} from '../consolidate/buildConsolidationReport.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadTokens } from '../tokens/loadTokens.js';
import type {
  DetectedHardcodedValue,
  InlineStyleBlock,
} from '../types/index.js';
import { discoverTargetFiles } from './discoverTargetFiles.js';
import type { ScanError } from './scan.js';

export interface ConsolidateOptions {
  tokenPath?: string;
  targetPath?: string;
  format?: 'json';
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  limit?: number;
}

interface ConsolidateResult {
  targetFiles: string[];
  scanErrors: ScanError[];
  detectedValues: DetectedHardcodedValue[];
  report: ConsolidationReport;
}

function scanTarget(
  targetPath: string | undefined,
  options: Pick<ConsolidateOptions, 'include' | 'exclude'>,
): Pick<ConsolidateResult, 'targetFiles' | 'scanErrors' | 'detectedValues'> {
  if (!targetPath) {
    return {
      targetFiles: [],
      scanErrors: [],
      detectedValues: [],
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
    scanErrors,
    detectedValues: detectHardcodedValues(blocks),
  };
}

function printSameValueGroup(group: SameValueTokenGroup): void {
  console.log(`  ${group.recommendation} ${group.value} (${group.type})`);
  console.log(`      tokens: ${group.tokens.join(', ')}`);
  console.log(`      usage: ${group.usage.total}`);
  console.log(`      reason: ${group.reason}`);

  if (group.replacementCandidates.length > 0) {
    console.log(
      `      replacements: ${group.replacementCandidates.join(', ')}`,
    );
  }
}

function printConsolidationReport(
  result: ConsolidateResult,
  limit: number,
): void {
  const { report } = result;

  console.log('Token consolidation report');
  console.log('');
  console.log(`Scanned files: ${result.targetFiles.length}`);
  console.log(`Scan errors: ${result.scanErrors.length}`);
  console.log('');
  console.log('Summary');
  console.log(`  same value groups ${report.summary.sameValueGroups}`);
  console.log(`  near value groups ${report.summary.nearValueGroups}`);
  console.log(`  unused tokens ${report.summary.unusedTokens}`);
  console.log(`  deprecated tokens ${report.summary.deprecatedTokens}`);

  if (report.sameValueGroups.length > 0) {
    console.log('');
    console.log(
      `Same resolved value groups (${report.sameValueGroups.length})`,
    );

    for (const group of report.sameValueGroups.slice(0, limit)) {
      printSameValueGroup(group);
    }

    if (report.sameValueGroups.length > limit) {
      console.log(`  ... ${report.sameValueGroups.length - limit} more`);
    }
  }

  if (report.nearValueGroups.length > 0) {
    console.log('');
    console.log(`Near value groups (${report.nearValueGroups.length})`);

    for (const group of report.nearValueGroups.slice(0, limit)) {
      console.log(
        `  ${group.leftToken} ${group.leftValue} ~ ${group.rightToken} ${group.rightValue} (distance ${group.distance})`,
      );
    }

    if (report.nearValueGroups.length > limit) {
      console.log(`  ... ${report.nearValueGroups.length - limit} more`);
    }
  }

  if (report.unusedTokens.length > 0) {
    console.log('');
    console.log(`Unused tokens (${report.unusedTokens.length})`);

    for (const token of report.unusedTokens.slice(0, limit)) {
      const deprecatedText = token.deprecated ? ' deprecated' : '';

      console.log(`  ${token.token}: ${token.value}${deprecatedText}`);
    }

    if (report.unusedTokens.length > limit) {
      console.log(`  ... ${report.unusedTokens.length - limit} more`);
    }
  }

  if (result.scanErrors.length > 0) {
    console.log('');
    console.log('Scan errors');

    for (const scanError of result.scanErrors) {
      console.log(`  ${scanError.file}: ${scanError.message}`);
    }
  }
}

function writeConsolidationJsonReport(
  result: ConsolidateResult,
  outputPath: string,
): string {
  const resolvedOutputPath = path.resolve(outputPath);

  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(
      {
        mode: 'consolidate',
        scannedFiles: result.targetFiles,
        scanErrors: result.scanErrors,
        summary: result.report.summary,
        sameValueGroups: result.report.sameValueGroups,
        nearValueGroups: result.report.nearValueGroups,
        unusedTokens: result.report.unusedTokens,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedOutputPath;
}

export function consolidate(options: ConsolidateOptions = {}): number {
  if (!options.tokenPath) {
    throw new Error(
      'The --tokens option or config tokens field is required for consolidate',
    );
  }

  const tokens = loadTokens(options.tokenPath);
  const scanResult = scanTarget(options.targetPath, options);
  const report = buildConsolidationReport(tokens, {
    detectedValues: scanResult.detectedValues,
  });
  const result: ConsolidateResult = {
    ...scanResult,
    report,
  };

  printConsolidationReport(result, options.limit ?? 10);

  if (options.format === 'json' && options.outputPath) {
    const resolvedOutputPath = writeConsolidationJsonReport(
      result,
      options.outputPath,
    );

    console.log('');
    console.log(`Consolidation JSON report written to ${resolvedOutputPath}`);
  }

  return scanResult.scanErrors.length > 0 ? 1 : 0;
}

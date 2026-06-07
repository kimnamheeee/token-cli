import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAdoptionReport,
  type AdoptionReport,
} from '../adoption/buildAdoptionReport.js';
import { classifyIssues } from '../classifier/classifyIssues.js';
import type { ConfigAuthority } from '../config/loadConfig.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadDesignMd } from '../sources/designMd/parseDesignMd.js';
import { loadTokens } from '../tokens/loadTokens.js';
import type { InlineStyleBlock } from '../types/index.js';
import { discoverTargetFiles } from './discoverTargetFiles.js';
import type { ScanError } from './scan.js';

export interface AdoptionOptions {
  targetPath: string;
  tokenPath?: string;
  designPath?: string;
  authority?: ConfigAuthority;
  requiredModes?: string[];
  format?: 'json';
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  limit?: number;
}

interface AdoptionResult {
  targetFiles: string[];
  scanErrors: ScanError[];
  report: AdoptionReport;
}

function scanTarget(
  targetPath: string,
  options: Pick<AdoptionOptions, 'include' | 'exclude'>,
): {
  targetFiles: string[];
  blocks: InlineStyleBlock[];
  scanErrors: ScanError[];
} {
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
    blocks,
    scanErrors,
  };
}

function printAdoptionReport(result: AdoptionResult, limit: number): void {
  const { report } = result;

  console.log('Design system adoption report');
  console.log('');
  console.log(`Scanned files: ${result.targetFiles.length}`);
  console.log(`Scan errors: ${result.scanErrors.length}`);
  console.log('');
  console.log('Coverage');
  console.log(`  token coverage ${report.coverage.coveragePercent}%`);
  console.log(`  detected values ${report.coverage.totalDetectedValues}`);
  console.log(`  matched values ${report.coverage.tokenMatchedValues}`);
  console.log(`  raw unmatched values ${report.coverage.rawUnmatchedValues}`);

  console.log('');
  console.log('Category coverage');

  for (const [category, coverage] of Object.entries(
    report.coverage.byCategory,
  )) {
    if (coverage.total === 0) {
      continue;
    }

    console.log(
      `  ${category}: ${coverage.coveragePercent}% (${coverage.matched}/${coverage.total})`,
    );
  }

  if (report.topRawValuesBlockingCoverage.length > 0) {
    console.log('');
    console.log('Top raw values blocking coverage');

    for (const item of report.topRawValuesBlockingCoverage.slice(0, limit)) {
      console.log(`  ${item.value}: ${item.count}`);
    }
  }

  if (report.underusedTokenGroups.length > 0) {
    console.log('');
    console.log('Underused token groups');

    for (const item of report.underusedTokenGroups.slice(0, limit)) {
      console.log(`  ${item.group}: ${item.unused}/${item.total} unused`);
    }
  }

  console.log('');
  console.log('Theme safety');
  console.log(
    `  mode-aware tokens ${report.themeSafety.tokenModeCoverage.totalModeAwareTokens}`,
  );
  console.log(
    `  incomplete mode coverage ${report.themeSafety.tokenModeCoverage.incomplete}`,
  );
  console.log(
    `  raw value theme risk ${report.themeSafety.rawValueThemeRiskCount}`,
  );

  for (const risk of report.themeSafety.risks.slice(0, limit)) {
    console.log(
      `  ${risk.token}: missing ${risk.missingModes.join(', ')} (has ${risk.availableModes.join(', ')})`,
    );
  }

  if (report.parity) {
    console.log('');
    console.log('DESIGN.md parity summary');
    console.log(`  design lint ${report.parity.summary['design-lint']}`);
    console.log(`  value mismatch ${report.parity.summary['value-mismatch']}`);
    console.log(
      `  missing in code ${report.parity.summary['missing-in-code']}`,
    );
    console.log(
      `  code-only token ${report.parity.summary['code-only-token']}`,
    );
    console.log(
      `  same value/different name ${report.parity.summary['same-value-different-name']}`,
    );
  }

  if (result.scanErrors.length > 0) {
    console.log('');
    console.log('Scan errors');

    for (const scanError of result.scanErrors) {
      console.log(`  ${scanError.file}: ${scanError.message}`);
    }
  }
}

function writeAdoptionJsonReport(
  result: AdoptionResult,
  outputPath: string,
): string {
  const resolvedOutputPath = path.resolve(outputPath);

  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(
      {
        mode: 'adoption',
        scannedFiles: result.targetFiles,
        scanErrors: result.scanErrors,
        report: result.report,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedOutputPath;
}

export function adoption(options: AdoptionOptions): number {
  if (!options.tokenPath) {
    throw new Error(
      'The --tokens option or config tokens field is required for adoption',
    );
  }

  const tokens = loadTokens(options.tokenPath);
  const scanResult = scanTarget(options.targetPath, options);
  const detectedValues = detectHardcodedValues(scanResult.blocks);
  const classifiedIssues = classifyIssues(detectedValues, tokens);
  const designMd = options.designPath
    ? loadDesignMd(options.designPath)
    : undefined;
  const report = buildAdoptionReport(detectedValues, classifiedIssues, tokens, {
    designMd,
    authority: options.authority,
    requiredModes: options.requiredModes,
  });
  const result: AdoptionResult = {
    targetFiles: scanResult.targetFiles,
    scanErrors: scanResult.scanErrors,
    report,
  };

  printAdoptionReport(result, options.limit ?? 10);

  if (options.format === 'json' && options.outputPath) {
    const resolvedOutputPath = writeAdoptionJsonReport(
      result,
      options.outputPath,
    );

    console.log('');
    console.log(`Adoption JSON report written to ${resolvedOutputPath}`);
  }

  return scanResult.scanErrors.length > 0 ? 1 : 0;
}

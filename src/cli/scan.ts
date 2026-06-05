import { classifyIssues } from '../classifier/classifyIssues.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import {
  exportClassifiedJsonReport,
  exportDetectionJsonReport,
} from '../reporter/exportJsonReport.js';
import {
  printClassifiedReport,
  printDetectionReport,
} from '../reporter/printCliReport.js';
import { loadTokens } from '../tokens/loadTokens.js';
import type { InlineStyleBlock } from '../types/index.js';
import { discoverTargetFiles } from './discoverTargetFiles.js';

export interface ScanError {
  file: string;
  message: string;
}

export interface ScanOptions {
  tokenPath?: string;
  format?: 'json';
  outputPath?: string;
  reportMode?: 'summary' | 'detailed';
  limit?: number;
  explain?: boolean;
  include?: string[];
  exclude?: string[];
}

export function scan(targetPath: string, options: ScanOptions = {}): void {
  const {
    tokenPath,
    format,
    outputPath,
    reportMode,
    limit,
    explain,
    include,
    exclude,
  } = options;
  const targetFiles = discoverTargetFiles(targetPath, { include, exclude });
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

  const detectedValues = detectHardcodedValues(blocks);

  if (targetFiles.length === 0) {
    console.log(`No matching source files found in ${targetPath}`);
    return;
  }

  if (blocks.length === 0) {
    console.log(`No inline style literals found in ${targetPath}`);
    printScanErrors(scanErrors);
    return;
  }

  if (detectedValues.length === 0) {
    console.log(
      `No supported hardcoded color or spacing values found in ${targetPath}`,
    );
    printScanErrors(scanErrors);
    return;
  }

  if (tokenPath) {
    const tokens = loadTokens(tokenPath);
    const classifiedIssues = classifyIssues(detectedValues, tokens);
    const totalClassifiedIssues =
      classifiedIssues.deterministic.length +
      classifiedIssues.ambiguous.length +
      classifiedIssues.noCandidate.length +
      classifiedIssues.unsupported.length;

    if (totalClassifiedIssues === 0) {
      console.log(
        `No exact matching tokens found for supported values in ${targetPath}`,
      );
      return;
    }

    printClassifiedReport({
      targetPath,
      blockCount: blocks.length,
      detectedValues,
      classifiedIssues,
      mode: reportMode,
      limit,
      explain,
      scanErrors,
    });

    if (format === 'json' && outputPath) {
      const resolvedOutputPath = exportClassifiedJsonReport({
        targetPath,
        classifiedIssues,
        outputPath,
        scanErrors,
      });

      console.log('');
      console.log(`Structured JSON report written to ${resolvedOutputPath}`);
    }

    return;
  }

  printDetectionReport({
    targetPath,
    blockCount: blocks.length,
    detectedValues,
    scanErrors,
  });

  if (format === 'json' && outputPath) {
    const resolvedOutputPath = exportDetectionJsonReport({
      targetPath,
      detectedValues,
      outputPath,
      scanErrors,
    });

    console.log('');
    console.log(`Structured JSON report written to ${resolvedOutputPath}`);
  }
}

function printScanErrors(scanErrors: ScanError[]): void {
  if (scanErrors.length === 0) {
    return;
  }

  console.log('');
  console.log(`Encountered ${scanErrors.length} file scan error(s):`);

  for (const scanError of scanErrors) {
    console.log(`- ${scanError.file}: ${scanError.message}`);
  }
}

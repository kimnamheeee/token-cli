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

export interface ScanOptions {
  tokenPath?: string;
  format?: 'json';
  outputPath?: string;
}

export function scan(targetPath: string, options: ScanOptions = {}): void {
  const { tokenPath, format, outputPath } = options;
  const blocks = extractInlineStylesFromFile(targetPath);
  const detectedValues = detectHardcodedValues(blocks);

  if (blocks.length === 0) {
    console.log(`No inline style literals found in ${targetPath}`);
    return;
  }

  if (detectedValues.length === 0) {
    console.log(`No supported hardcoded color or spacing values found in ${targetPath}`);
    return;
  }

  if (tokenPath) {
    const tokens = loadTokens(tokenPath);
    const classifiedIssues = classifyIssues(detectedValues, tokens);
    const totalClassifiedIssues =
      classifiedIssues.deterministic.length
      + classifiedIssues.ambiguous.length
      + classifiedIssues.noCandidate.length
      + classifiedIssues.unsupported.length;

    if (totalClassifiedIssues === 0) {
      console.log(`No exact matching tokens found for supported values in ${targetPath}`);
      return;
    }

    printClassifiedReport({
      targetPath,
      blockCount: blocks.length,
      detectedValues,
      classifiedIssues,
    });

    if (format === 'json' && outputPath) {
      const resolvedOutputPath = exportClassifiedJsonReport({
        targetPath,
        classifiedIssues,
        outputPath,
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
  });

  if (format === 'json' && outputPath) {
    const resolvedOutputPath = exportDetectionJsonReport({
      targetPath,
      detectedValues,
      outputPath,
    });

    console.log('');
    console.log(`Structured JSON report written to ${resolvedOutputPath}`);
  }
}

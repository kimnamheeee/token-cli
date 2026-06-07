import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { classifyIssues } from '../classifier/classifyIssues.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import {
  buildClassifiedReportSummary,
  type ClassifiedReportSummary,
} from '../reporter/buildReportSummary.js';
import { loadTokens } from '../tokens/loadTokens.js';
import type { ClassifiedIssueSets, InlineStyleBlock } from '../types/index.js';
import { filterDiscoveredFiles } from './discoverTargetFiles.js';
import type { ScanError } from './scan.js';

export interface DiffOptions {
  files?: string[];
  tokenPath?: string;
  base?: string;
  head?: string;
  staged?: boolean;
  strict?: boolean;
  format?: 'json';
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  limit?: number;
}

interface DiffResult {
  changedFiles: string[];
  scannedFiles: string[];
  changedLineCountsByFile?: Record<string, number>;
  scanErrors: ScanError[];
  classifiedIssues: ClassifiedIssueSets;
  shouldFail: boolean;
}

const EMPTY_CLASSIFIED_ISSUES: ClassifiedIssueSets = {
  deterministic: [],
  ambiguous: [],
  noCandidate: [],
  unsupported: [],
};

export function shouldFailDiff(
  summary: Pick<ClassifiedReportSummary, 'severity'>,
  scanErrors: ScanError[],
  strict = false,
): boolean {
  return (
    scanErrors.length > 0 ||
    summary.severity.error > 0 ||
    (strict && summary.severity.warning > 0)
  );
}

function getChangedFiles(options: DiffOptions): string[] {
  if (options.files && options.files.length > 0) {
    return [...options.files].sort((left, right) => left.localeCompare(right));
  }

  const args = getGitDiffArgs(options);

  return execFileSync(
    'git',
    [args[0] ?? 'diff', '--name-only', ...args.slice(1)],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter(Boolean);
}

function getGitDiffArgs(options: DiffOptions): string[] {
  const args = ['diff', '--diff-filter=ACMRT'];

  if (options.staged) {
    args.push('--cached');
  }

  if (options.base && options.head) {
    args.push(`${options.base}...${options.head}`);
  } else if (options.base) {
    args.push(options.base);
  } else if (!options.staged) {
    args.push('HEAD');
  }

  return args;
}

function parseChangedLineRange(rangeText: string): number[] {
  const match = rangeText.match(/^\+(\d+)(?:,(\d+))?$/);

  if (!match) {
    return [];
  }

  const startLine = Number.parseInt(match[1] ?? '', 10);
  const lineCount = match[2] ? Number.parseInt(match[2], 10) : 1;

  if (!Number.isInteger(startLine) || lineCount < 1) {
    return [];
  }

  return Array.from({ length: lineCount }, (_, index) => startLine + index);
}

export function parseChangedLines(
  diffOutput: string,
  rootPath: string,
): Map<string, Set<number>> {
  const changedLinesByFile = new Map<string, Set<number>>();
  let currentFilePath: string | undefined;

  for (const line of diffOutput.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFilePath = path.resolve(rootPath, line.slice('+++ b/'.length));
      changedLinesByFile.set(currentFilePath, new Set<number>());
      continue;
    }

    if (!line.startsWith('@@') || !currentFilePath) {
      continue;
    }

    const rangeMatch = line.match(/@@\s+-\d+(?:,\d+)?\s+(\+\d+(?:,\d+)?)\s+@@/);

    if (!rangeMatch) {
      continue;
    }

    const lineSet = changedLinesByFile.get(currentFilePath);

    for (const changedLine of parseChangedLineRange(rangeMatch[1] ?? '')) {
      lineSet?.add(changedLine);
    }
  }

  return changedLinesByFile;
}

function getChangedLines(
  options: DiffOptions,
): Map<string, Set<number>> | undefined {
  if (options.files && options.files.length > 0) {
    return undefined;
  }

  const args = getGitDiffArgs(options);
  const diffOutput = execFileSync(
    'git',
    [args[0] ?? 'diff', '--unified=0', ...args.slice(1)],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  return parseChangedLines(diffOutput, process.cwd());
}

function getChangedLineCountsByFile(
  changedLinesByFile: Map<string, Set<number>> | undefined,
): Record<string, number> | undefined {
  if (!changedLinesByFile) {
    return undefined;
  }

  return Object.fromEntries(
    [...changedLinesByFile.entries()].map(([filePath, lineSet]) => [
      filePath,
      lineSet.size,
    ]),
  );
}

function isOnChangedLine(
  filePath: string,
  line: number,
  changedLinesByFile: Map<string, Set<number>> | undefined,
): boolean {
  if (!changedLinesByFile) {
    return true;
  }

  return changedLinesByFile.get(filePath)?.has(line) === true;
}

function analyzeChangedFiles(
  filePaths: string[],
  options: DiffOptions,
): DiffResult {
  const scannedFiles = filterDiscoveredFiles(filePaths, process.cwd(), {
    include: options.include,
    exclude: options.exclude,
  });
  const blocks: InlineStyleBlock[] = [];
  const scanErrors: ScanError[] = [];

  if (scannedFiles.length === 0) {
    return {
      changedFiles: filePaths,
      scannedFiles,
      changedLineCountsByFile: undefined,
      scanErrors,
      classifiedIssues: EMPTY_CLASSIFIED_ISSUES,
      shouldFail: false,
    };
  }

  for (const filePath of scannedFiles) {
    try {
      blocks.push(...extractInlineStylesFromFile(filePath));
    } catch (error) {
      scanErrors.push({
        file: filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const changedLinesByFile = getChangedLines(options);
  const changedLineCountsByFile =
    getChangedLineCountsByFile(changedLinesByFile);
  const detectedValues = detectHardcodedValues(blocks).filter((detectedValue) =>
    isOnChangedLine(
      detectedValue.filePath,
      detectedValue.line,
      changedLinesByFile,
    ),
  );

  if (detectedValues.length === 0) {
    const summary = buildClassifiedReportSummary(EMPTY_CLASSIFIED_ISSUES);

    return {
      changedFiles: filePaths,
      scannedFiles,
      changedLineCountsByFile,
      scanErrors,
      classifiedIssues: EMPTY_CLASSIFIED_ISSUES,
      shouldFail: shouldFailDiff(summary, scanErrors, options.strict === true),
    };
  }

  if (!options.tokenPath) {
    throw new Error(
      'The --tokens option or config tokens field is required for diff',
    );
  }

  const tokens = loadTokens(options.tokenPath);
  const classifiedIssues =
    detectedValues.length > 0
      ? classifyIssues(detectedValues, tokens)
      : EMPTY_CLASSIFIED_ISSUES;
  const summary = buildClassifiedReportSummary(classifiedIssues);
  const shouldFail = shouldFailDiff(
    summary,
    scanErrors,
    options.strict === true,
  );

  return {
    changedFiles: filePaths,
    scannedFiles,
    changedLineCountsByFile,
    scanErrors,
    classifiedIssues,
    shouldFail,
  };
}

function printDiffResult(result: DiffResult, options: DiffOptions): void {
  const summary = buildClassifiedReportSummary(result.classifiedIssues, {
    recommendationLimit: options.limit ?? 10,
  });
  const limit = options.limit ?? 10;
  const visibleDecisions = summary.reportDecisions.slice(0, limit);

  console.log('PR token check');
  console.log('');
  console.log(`Changed files: ${result.changedFiles.length}`);
  console.log(`Scanned files: ${result.scannedFiles.length}`);
  console.log(`Existing violations ignored: not scanned`);
  console.log('');
  console.log('New decision summary');
  console.log(
    `  error ${summary.severity.error}  warning ${summary.severity.warning}  info ${summary.severity.info}  unknown ${summary.severity.unknown}`,
  );
  console.log(
    `  safe ${summary.decisions['safe-replacement']}  ambiguous ${summary.decisions.ambiguous}  unsupported ${summary.decisions.unsupported}`,
  );

  if (visibleDecisions.length > 0) {
    console.log('');
    console.log(`Top changed-file decisions (limit ${limit})`);

    for (const decision of visibleDecisions) {
      const [topCandidate] = decision.topCandidates;
      const tokenText = topCandidate ? ` -> ${topCandidate.id}` : '';

      console.log(
        `  ${decision.severity} ${decision.file}:${decision.line}:${decision.column} ${decision.value}${tokenText}`,
      );
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

function writeDiffJsonReport(
  result: DiffResult,
  options: DiffOptions,
): string | undefined {
  if (options.format !== 'json' || !options.outputPath) {
    return undefined;
  }

  const summary = buildClassifiedReportSummary(result.classifiedIssues);
  const resolvedPath = path.resolve(options.outputPath);

  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(
    resolvedPath,
    `${JSON.stringify(
      {
        mode: 'diff',
        changedFiles: result.changedFiles,
        scannedFiles: result.scannedFiles,
        changedLineCountsByFile: result.changedLineCountsByFile,
        scanErrors: result.scanErrors,
        summary: {
          totalIssues: summary.totalIssues,
          cases: summary.cases,
          decisions: summary.decisions,
          severity: summary.severity,
        },
        decisions: summary.reportDecisions,
        recommendations: summary.recommendations,
        shouldFail: result.shouldFail,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedPath;
}

export function diff(options: DiffOptions): number {
  const changedFiles = getChangedFiles(options);
  const result = analyzeChangedFiles(changedFiles, options);

  printDiffResult(result, options);

  const resolvedOutputPath = writeDiffJsonReport(result, options);

  if (resolvedOutputPath) {
    console.log('');
    console.log(`Structured JSON report written to ${resolvedOutputPath}`);
  }

  return result.shouldFail ? 1 : 0;
}

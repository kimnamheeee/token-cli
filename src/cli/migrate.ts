import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { classifyIssues } from '../classifier/classifyIssues.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import {
  buildMigrationPlan,
  type MigrationPlan,
  type MigrationPlanGroup,
  type MigrationPlanItem,
} from '../migration/buildMigrationPlan.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadTokens } from '../tokens/loadTokens.js';
import type { InlineStyleBlock } from '../types/index.js';
import { discoverTargetFiles } from './discoverTargetFiles.js';
import type { ScanError } from './scan.js';

export interface MigrateOptions {
  tokenPath?: string;
  format?: 'json';
  outputPath?: string;
  include?: string[];
  exclude?: string[];
  limit?: number;
}

interface MigrateResult {
  targetPath: string;
  targetFiles: string[];
  scanErrors: ScanError[];
  plan: MigrationPlan;
}

function printPlanGroup(
  title: string,
  items: MigrationPlanItem[],
  limit: number,
): void {
  if (items.length === 0) {
    return;
  }

  console.log('');
  console.log(`${title} (${items.length})`);

  for (const item of items.slice(0, limit)) {
    const replacementText = item.replacementCandidateId
      ? ` -> ${item.replacementCandidateId}`
      : '';

    console.log(
      `  [${item.id}] ${item.file}:${item.line}:${item.column} ${item.value}${replacementText}`,
    );
    console.log(`      ${item.property}; ${item.message}`);

    if (item.group === 'needs-review' && item.candidates.length > 0) {
      const candidates = item.candidates
        .slice(0, 3)
        .map((candidate) => candidate.id)
        .join(', ');

      console.log(`      candidates: ${candidates}`);
    }
  }

  if (items.length > limit) {
    console.log(`  ... ${items.length - limit} more`);
  }
}

function printMigrationPlan(result: MigrateResult, limit: number): void {
  const { plan } = result;

  console.log('Migration plan');
  console.log('');
  console.log(`Scanned files: ${result.targetFiles.length}`);
  console.log(`Scan errors: ${result.scanErrors.length}`);
  console.log('');
  console.log('Summary');
  console.log(`  safe replacements ${plan.summary['safe-replacements']}`);
  console.log(`  needs review ${plan.summary['needs-review']}`);
  console.log(`  no token found ${plan.summary['no-token-found']}`);
  console.log(`  unsupported ${plan.summary.unsupported}`);

  printPlanGroup('Safe replacements', plan.groups['safe-replacements'], limit);
  printPlanGroup('Needs review', plan.groups['needs-review'], limit);
  printPlanGroup('No token found', plan.groups['no-token-found'], limit);
  printPlanGroup('Unsupported', plan.groups.unsupported, limit);

  if (result.scanErrors.length > 0) {
    console.log('');
    console.log('Scan errors');

    for (const scanError of result.scanErrors) {
      console.log(`  ${scanError.file}: ${scanError.message}`);
    }
  }
}

function writeMigrationJsonReport(
  result: MigrateResult,
  outputPath: string,
): string {
  const resolvedOutputPath = path.resolve(outputPath);

  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(
      {
        mode: 'migrate',
        targetPath: result.targetPath,
        scannedFiles: result.targetFiles,
        scanErrors: result.scanErrors,
        summary: result.plan.summary,
        groups: result.plan.groups,
        items: result.plan.items,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return resolvedOutputPath;
}

function getGroupOrder(): MigrationPlanGroup[] {
  return ['safe-replacements', 'needs-review', 'no-token-found', 'unsupported'];
}

export function migrate(
  targetPath: string,
  options: MigrateOptions = {},
): number {
  if (!options.tokenPath) {
    throw new Error(
      'The --tokens option or config tokens field is required for migrate',
    );
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

  const detectedValues = detectHardcodedValues(blocks);
  const tokens = loadTokens(options.tokenPath);
  const classifiedIssues = classifyIssues(detectedValues, tokens);
  const plan = buildMigrationPlan(classifiedIssues, {
    rootPath: process.cwd(),
  });
  const result: MigrateResult = {
    targetPath,
    targetFiles,
    scanErrors,
    plan,
  };

  printMigrationPlan(result, options.limit ?? 10);

  if (options.format === 'json' && options.outputPath) {
    const resolvedOutputPath = writeMigrationJsonReport(
      {
        ...result,
        plan: {
          ...plan,
          groups: Object.fromEntries(
            getGroupOrder().map((group) => [group, plan.groups[group]]),
          ) as Record<MigrationPlanGroup, MigrationPlanItem[]>,
        },
      },
      options.outputPath,
    );

    console.log('');
    console.log(`Migration JSON report written to ${resolvedOutputPath}`);
  }

  return scanErrors.length > 0 ? 1 : 0;
}

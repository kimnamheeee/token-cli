import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  ConfigAuthority,
  ReportMode,
  TokenValidatorConfig,
} from './loadConfig.js';

export const DEFAULT_CONFIG_FILE = 'token-validator.config.json';

export interface SetupConfigAnswers {
  tokens?: string;
  include?: string[];
  exclude?: string[];
  reportMode?: ReportMode;
  reportLimit?: number;
  writeJsonReport?: boolean;
  reportOut?: string;
  designSource?: string;
  authority?: ConfigAuthority;
}

export interface WriteSetupConfigOptions {
  cwd?: string;
  configPath?: string;
  force?: boolean;
}

function compactStringArray(
  values: string[] | undefined,
): string[] | undefined {
  const compactedValues = (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return compactedValues.length > 0 ? compactedValues : undefined;
}

export function parseCommaSeparatedList(value: string): string[] | undefined {
  return compactStringArray(value.split(','));
}

export function buildSetupConfig(
  answers: SetupConfigAnswers,
): TokenValidatorConfig {
  const tokens = answers.tokens?.trim();
  const designSource = answers.designSource?.trim();
  const reportMode = answers.reportMode ?? 'summary';
  const reportLimit = answers.reportLimit ?? 10;
  const include = compactStringArray(answers.include);
  const exclude = compactStringArray(answers.exclude);
  const config: TokenValidatorConfig = {
    ...(tokens ? { tokens } : {}),
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
    ranking: {},
    sources: {
      ...(designSource ? { design: designSource } : {}),
      ...(tokens ? { tokens } : {}),
    },
    authority: answers.authority ?? 'compare-only',
    report: {
      mode: reportMode,
      limit: reportLimit,
      ...(answers.writeJsonReport
        ? {
            format: 'json',
            out: answers.reportOut?.trim() || 'reports/token-report.json',
          }
        : {}),
      explain: false,
    },
  };

  if (!config.sources?.design && !config.sources?.tokens) {
    delete config.sources;
  }

  return config;
}

export function writeSetupConfig(
  config: TokenValidatorConfig,
  options: WriteSetupConfigOptions = {},
): string {
  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = path.resolve(
    cwd,
    options.configPath ?? DEFAULT_CONFIG_FILE,
  );

  if (existsSync(resolvedPath) && !options.force) {
    throw new Error(
      `Config file already exists: ${resolvedPath}. Use --force to overwrite it.`,
    );
  }

  writeFileSync(resolvedPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return resolvedPath;
}

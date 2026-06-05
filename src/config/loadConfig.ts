import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type ReportMode = 'summary' | 'detailed';
export type ReportFormat = 'json';
export type ConfigAuthority = 'design-md' | 'code' | 'compare-only';

export interface TokenValidatorConfig {
  tokens?: string;
  include?: string[];
  exclude?: string[];
  ranking?: Record<string, unknown>;
  sources?: {
    design?: string;
    tokens?: string;
  };
  authority?: ConfigAuthority;
  report?: {
    mode?: ReportMode;
    limit?: number;
    format?: ReportFormat;
    out?: string;
    outputPath?: string;
    explain?: boolean;
  };
}

export interface LoadedConfig {
  path?: string;
  config: TokenValidatorConfig;
}

const DEFAULT_CONFIG_FILE = 'token-validator.config.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(
  config: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = config[key];

  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === 'string')
  ) {
    throw new Error(`Config field "${key}" must be an array of strings`);
  }

  return value;
}

function readReportMode(value: unknown): ReportMode | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'summary' || value === 'detailed') {
    return value;
  }

  throw new Error('Config field "report.mode" must be "summary" or "detailed"');
}

function readReportFormat(value: unknown): ReportFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'json') {
    return value;
  }

  throw new Error('Config field "report.format" must be "json"');
}

function readAuthority(value: unknown): ConfigAuthority | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'design-md' || value === 'code' || value === 'compare-only') {
    return value;
  }

  throw new Error(
    'Config field "authority" must be "design-md", "code", or "compare-only"',
  );
}

function readPositiveInteger(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Number.isInteger(value) && typeof value === 'number' && value > 0) {
    return value;
  }

  throw new Error(`Config field "${fieldName}" must be a positive integer`);
}

function readString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  throw new Error(`Config field "${fieldName}" must be a string`);
}

function normalizeConfig(rawConfig: unknown): TokenValidatorConfig {
  if (!isRecord(rawConfig)) {
    throw new Error('Config root must be an object');
  }

  const report = rawConfig.report;
  const sources = rawConfig.sources;

  if (report !== undefined && !isRecord(report)) {
    throw new Error('Config field "report" must be an object');
  }

  if (sources !== undefined && !isRecord(sources)) {
    throw new Error('Config field "sources" must be an object');
  }

  return {
    tokens: readString(rawConfig.tokens, 'tokens'),
    include: readStringArray(rawConfig, 'include'),
    exclude: readStringArray(rawConfig, 'exclude'),
    ranking: isRecord(rawConfig.ranking) ? rawConfig.ranking : undefined,
    sources: sources
      ? {
          design: readString(sources.design, 'sources.design'),
          tokens: readString(sources.tokens, 'sources.tokens'),
        }
      : undefined,
    authority: readAuthority(rawConfig.authority),
    report: report
      ? {
          mode: readReportMode(report.mode),
          limit: readPositiveInteger(report.limit, 'report.limit'),
          format: readReportFormat(report.format),
          out: readString(report.out, 'report.out'),
          outputPath: readString(report.outputPath, 'report.outputPath'),
          explain:
            typeof report.explain === 'boolean' ? report.explain : undefined,
        }
      : undefined,
  };
}

function resolveConfigPath(
  configPath: string | undefined,
  cwd: string,
): string | undefined {
  if (configPath) {
    return path.resolve(cwd, configPath);
  }

  const defaultConfigPath = path.resolve(cwd, DEFAULT_CONFIG_FILE);

  return existsSync(defaultConfigPath) ? defaultConfigPath : undefined;
}

export function loadConfig(
  configPath?: string,
  cwd = process.cwd(),
): LoadedConfig {
  const resolvedPath = resolveConfigPath(configPath, cwd);

  if (!resolvedPath) {
    return { config: {} };
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const rawConfig = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;

  return {
    path: resolvedPath,
    config: normalizeConfig(rawConfig),
  };
}

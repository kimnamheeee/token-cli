import { loadConfig } from '../config/loadConfig.js';
import { consolidate } from './consolidate.js';
import { designDiff } from './designDiff.js';
import { diff } from './diff.js';
import { migrate } from './migrate.js';
import { scan } from './scan.js';
import { setup } from './setup.js';
import { sync } from './sync.js';

const USAGE =
  'Usage: token-validator scan <target> --config <path> --tokens <path> --report summary|detailed --limit <n> --explain --format json --out <path>\n       token-validator diff --config <path> --tokens <path> --staged --base <ref> --head <ref> --strict --format json --out <path>\n       token-validator migrate <target> --config <path> --tokens <path> --limit <n> --format json --out <path>\n       token-validator consolidate <target> --config <path> --tokens <path> --limit <n> --format json --out <path>\n       token-validator sync --design <path> --tokens <path> --authority design-md|code|compare-only --format json --out <path>\n       token-validator design-diff <old-design> <new-design> --target <path> --format json --out <path>\n       token-validator setup --config <path> --force';

const FLAGS_WITH_VALUES = new Set([
  '--config',
  '--tokens',
  '--report',
  '--limit',
  '--format',
  '--out',
  '--base',
  '--head',
  '--design',
  '--authority',
  '--target',
]);

function getFlagValue(args: string[], flagName: string): string | undefined {
  const flagIndex = args.indexOf(flagName);

  if (flagIndex < 0) {
    return undefined;
  }

  return args[flagIndex + 1];
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return undefined;
  }

  return parsedValue;
}

function hasFlag(args: string[], flagName: string): boolean {
  return args.includes(flagName);
}

function isAuthorityValue(
  value: string | undefined,
): value is 'design-md' | 'code' | 'compare-only' {
  return value === 'design-md' || value === 'code' || value === 'compare-only';
}

function getPositionalArgs(args: string[]): string[] {
  const positionalArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (FLAGS_WITH_VALUES.has(arg)) {
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      continue;
    }

    positionalArgs.push(arg);
  }

  return positionalArgs;
}

function main(): void {
  const [, , command, targetPath, ...restArgs] = process.argv;

  if (command === 'setup') {
    const setupArgs = targetPath ? [targetPath, ...restArgs] : restArgs;
    const configPath = getFlagValue(setupArgs, '--config');
    const force = hasFlag(setupArgs, '--force');

    setup({ configPath, force })
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    return;
  }

  if (command === 'diff') {
    const diffArgs = targetPath ? [targetPath, ...restArgs] : restArgs;
    const tokenPath = getFlagValue(diffArgs, '--tokens');
    const configPath = getFlagValue(diffArgs, '--config');
    const base = getFlagValue(diffArgs, '--base');
    const head = getFlagValue(diffArgs, '--head');
    const formatValue = getFlagValue(diffArgs, '--format');
    const outputPath = getFlagValue(diffArgs, '--out');
    const limitValue = getFlagValue(diffArgs, '--limit');
    const files = getPositionalArgs(diffArgs);
    let loadedConfig: ReturnType<typeof loadConfig>;

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const resolvedTokenPath =
      tokenPath ?? config.tokens ?? config.sources?.tokens;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    try {
      process.exitCode = diff({
        files,
        tokenPath: resolvedTokenPath,
        base,
        head,
        staged: hasFlag(diffArgs, '--staged'),
        strict: hasFlag(diffArgs, '--strict'),
        format: resolvedFormatValue === 'json' ? 'json' : undefined,
        outputPath: resolvedOutputPath,
        include: config.include,
        exclude: config.exclude,
        limit,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'migrate') {
    if (!targetPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    const tokenPath = getFlagValue(restArgs, '--tokens');
    const configPath = getFlagValue(restArgs, '--config');
    const formatValue = getFlagValue(restArgs, '--format');
    const outputPath = getFlagValue(restArgs, '--out');
    const limitValue = getFlagValue(restArgs, '--limit');
    let loadedConfig: ReturnType<typeof loadConfig>;

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const resolvedTokenPath =
      tokenPath ?? config.tokens ?? config.sources?.tokens;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    try {
      process.exitCode = migrate(targetPath, {
        tokenPath: resolvedTokenPath,
        format: resolvedFormatValue === 'json' ? 'json' : undefined,
        outputPath: resolvedOutputPath,
        include: config.include,
        exclude: config.exclude,
        limit,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'consolidate') {
    const consolidateArgs = targetPath ? [targetPath, ...restArgs] : restArgs;
    const tokenPath = getFlagValue(consolidateArgs, '--tokens');
    const configPath = getFlagValue(consolidateArgs, '--config');
    const formatValue = getFlagValue(consolidateArgs, '--format');
    const outputPath = getFlagValue(consolidateArgs, '--out');
    const limitValue = getFlagValue(consolidateArgs, '--limit');
    const [consolidateTargetPath] = getPositionalArgs(consolidateArgs);
    let loadedConfig: ReturnType<typeof loadConfig>;

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const resolvedTokenPath =
      tokenPath ?? config.tokens ?? config.sources?.tokens;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    try {
      process.exitCode = consolidate({
        targetPath: consolidateTargetPath,
        tokenPath: resolvedTokenPath,
        format: resolvedFormatValue === 'json' ? 'json' : undefined,
        outputPath: resolvedOutputPath,
        include: config.include,
        exclude: config.exclude,
        limit,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'sync') {
    const syncArgs = targetPath ? [targetPath, ...restArgs] : restArgs;
    const tokenPath = getFlagValue(syncArgs, '--tokens');
    const designPath = getFlagValue(syncArgs, '--design');
    const configPath = getFlagValue(syncArgs, '--config');
    const formatValue = getFlagValue(syncArgs, '--format');
    const outputPath = getFlagValue(syncArgs, '--out');
    const limitValue = getFlagValue(syncArgs, '--limit');
    const authorityValue = getFlagValue(syncArgs, '--authority');
    let loadedConfig: ReturnType<typeof loadConfig>;

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const resolvedTokenPath =
      tokenPath ?? config.tokens ?? config.sources?.tokens;
    const resolvedDesignPath = designPath ?? config.sources?.design;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const resolvedAuthority = authorityValue ?? config.authority;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    if (resolvedAuthority && !isAuthorityValue(resolvedAuthority)) {
      console.error(
        'The --authority option must be "design-md", "code", or "compare-only"',
      );
      process.exitCode = 1;
      return;
    }

    try {
      process.exitCode = sync({
        designPath: resolvedDesignPath,
        tokenPath: resolvedTokenPath,
        authority: isAuthorityValue(resolvedAuthority)
          ? resolvedAuthority
          : undefined,
        format: resolvedFormatValue === 'json' ? 'json' : undefined,
        outputPath: resolvedOutputPath,
        limit,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'design-diff') {
    if (!targetPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    const designDiffArgs = restArgs;
    const newDesignPath = getPositionalArgs(designDiffArgs)[0];
    const target = getFlagValue(designDiffArgs, '--target');
    const configPath = getFlagValue(designDiffArgs, '--config');
    const formatValue = getFlagValue(designDiffArgs, '--format');
    const outputPath = getFlagValue(designDiffArgs, '--out');
    const limitValue = getFlagValue(designDiffArgs, '--limit');
    let loadedConfig: ReturnType<typeof loadConfig>;

    if (!newDesignPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    try {
      process.exitCode = designDiff({
        oldDesignPath: targetPath,
        newDesignPath,
        targetPath: target,
        format: resolvedFormatValue === 'json' ? 'json' : undefined,
        outputPath: resolvedOutputPath,
        include: config.include,
        exclude: config.exclude,
        limit,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'scan') {
    if (!targetPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    const tokenPath = getFlagValue(restArgs, '--tokens');
    const configPath = getFlagValue(restArgs, '--config');
    const formatValue = getFlagValue(restArgs, '--format');
    const outputPath = getFlagValue(restArgs, '--out');
    const reportValue = getFlagValue(restArgs, '--report');
    const limitValue = getFlagValue(restArgs, '--limit');
    let loadedConfig: ReturnType<typeof loadConfig>;

    try {
      loadedConfig = loadConfig(configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const config = loadedConfig.config;
    const configuredTokenPath = config.tokens ?? config.sources?.tokens;
    const resolvedTokenPath = tokenPath ?? configuredTokenPath;
    const resolvedFormatValue = formatValue ?? config.report?.format;
    const resolvedOutputPath =
      outputPath ?? config.report?.out ?? config.report?.outputPath;
    const resolvedReportValue = reportValue ?? config.report?.mode;
    const limit = limitValue ? parseLimit(limitValue) : config.report?.limit;
    const explain =
      hasFlag(restArgs, '--explain') || config.report?.explain === true;

    if (resolvedFormatValue && resolvedFormatValue !== 'json') {
      console.error(`Unsupported format: ${resolvedFormatValue}`);
      process.exitCode = 1;
      return;
    }

    if (resolvedFormatValue === 'json' && !resolvedOutputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (
      resolvedReportValue &&
      resolvedReportValue !== 'summary' &&
      resolvedReportValue !== 'detailed'
    ) {
      console.error(`Unsupported report mode: ${resolvedReportValue}`);
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    scan(targetPath, {
      tokenPath: resolvedTokenPath,
      format: resolvedFormatValue === 'json' ? 'json' : undefined,
      outputPath: resolvedOutputPath,
      reportMode:
        resolvedReportValue === 'summary' || resolvedReportValue === 'detailed'
          ? resolvedReportValue
          : undefined,
      limit,
      explain,
      include: config.include,
      exclude: config.exclude,
    });
    process.exitCode = 0;
    return;
  }

  console.log('token-validator');
  console.log('');
  console.log(USAGE);
  process.exitCode = 1;
}

main();

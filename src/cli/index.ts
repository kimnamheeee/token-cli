import { loadConfig } from '../config/loadConfig.js';
import { scan } from './scan.js';
import { setup } from './setup.js';

const USAGE =
  'Usage: token-validator scan <target> --config <path> --tokens <path> --report summary|detailed --limit <n> --explain --format json --out <path>\n       token-validator setup --config <path> --force';

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

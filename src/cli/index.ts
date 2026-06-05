import { scan } from './scan.js';

const USAGE =
  'Usage: token-validator scan <target> --tokens <path> --report summary|detailed --limit <n> --explain --format json --out <path>';

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

  if (command === 'scan') {
    if (!targetPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    const tokenPath = getFlagValue(restArgs, '--tokens');
    const formatValue = getFlagValue(restArgs, '--format');
    const outputPath = getFlagValue(restArgs, '--out');
    const reportValue = getFlagValue(restArgs, '--report');
    const limitValue = getFlagValue(restArgs, '--limit');
    const limit = parseLimit(limitValue);
    const explain = hasFlag(restArgs, '--explain');

    if (formatValue && formatValue !== 'json') {
      console.error(`Unsupported format: ${formatValue}`);
      process.exitCode = 1;
      return;
    }

    if (formatValue === 'json' && !outputPath) {
      console.error('The --out option is required when using --format json');
      process.exitCode = 1;
      return;
    }

    if (
      reportValue &&
      reportValue !== 'summary' &&
      reportValue !== 'detailed'
    ) {
      console.error(`Unsupported report mode: ${reportValue}`);
      process.exitCode = 1;
      return;
    }

    if (limitValue && !limit) {
      console.error('The --limit option must be a positive integer');
      process.exitCode = 1;
      return;
    }

    scan(targetPath, {
      tokenPath,
      format: formatValue === 'json' ? 'json' : undefined,
      outputPath,
      reportMode:
        reportValue === 'summary' || reportValue === 'detailed'
          ? reportValue
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

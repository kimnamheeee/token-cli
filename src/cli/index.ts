import { scan } from './scan.js';

function getFlagValue(args: string[], flagName: string): string | undefined {
  const flagIndex = args.indexOf(flagName);

  if (flagIndex < 0) {
    return undefined;
  }

  return args[flagIndex + 1];
}

function main(): void {
  const [, , command, targetPath, ...restArgs] = process.argv;

  if (command === 'scan') {
    if (!targetPath) {
      console.error('Usage: token-validator scan <target> --tokens <path> --format json --out <path>');
      process.exitCode = 1;
      return;
    }

    const tokenPath = getFlagValue(restArgs, '--tokens');
    const formatValue = getFlagValue(restArgs, '--format');
    const outputPath = getFlagValue(restArgs, '--out');

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

    scan(targetPath, {
      tokenPath,
      format: formatValue === 'json' ? 'json' : undefined,
      outputPath,
    });
    process.exitCode = 0;
    return;
  }

  console.log('token-validator');
  console.log('');
  console.log('Usage: token-validator scan <target> --tokens <path> --format json --out <path>');
  process.exitCode = 1;
}

main();

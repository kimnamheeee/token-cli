import { scan } from './scan.js';

function main(): void {
  const [, , command, targetPath] = process.argv;

  if (command === 'scan') {
    if (!targetPath) {
      console.error('Usage: token-validator scan <target> --tokens <path>');
      process.exitCode = 1;
      return;
    }

    scan(targetPath);
    process.exitCode = 0;
    return;
  }

  console.log('token-validator');
  console.log('');
  console.log('Usage: token-validator scan <target> --tokens <path>');
  process.exitCode = 1;
}

main();

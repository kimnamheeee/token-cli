function main(): void {
  const [, , command] = process.argv;

  if (command === 'scan') {
    console.log('scan command is not implemented yet');
    process.exitCode = 0;
    return;
  }

  console.log('token-validator');
  console.log('');
  console.log('Usage: token-validator scan <target> --tokens <path>');
  process.exitCode = 1;
}

main();

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import {
  buildSetupConfig,
  parseCommaSeparatedList,
  writeSetupConfig,
} from '../config/setupConfig.js';
import type { ConfigAuthority, ReportMode } from '../config/loadConfig.js';

interface SetupOptions {
  configPath?: string;
  force?: boolean;
}

function normalizeAnswer(value: string): string {
  return value.trim();
}

function withDefault(value: string, defaultValue: string): string {
  const normalizedValue = normalizeAnswer(value);

  return normalizedValue || defaultValue;
}

function readBoolean(value: string, defaultValue: boolean): boolean {
  const normalizedValue = normalizeAnswer(value).toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  return normalizedValue === 'y' || normalizedValue === 'yes';
}

function readReportMode(value: string): ReportMode {
  const normalizedValue = normalizeAnswer(value);

  return normalizedValue === 'detailed' ? 'detailed' : 'summary';
}

function readAuthority(value: string): ConfigAuthority {
  const normalizedValue = normalizeAnswer(value);

  if (normalizedValue === 'design-md' || normalizedValue === 'code') {
    return normalizedValue;
  }

  return 'compare-only';
}

function readPositiveInteger(value: string, defaultValue: number): number {
  const normalizedValue = normalizeAnswer(value);

  if (!normalizedValue) {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

export async function setup(options: SetupOptions = {}): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answers = rl[Symbol.asyncIterator]();

  async function ask(question: string): Promise<string> {
    output.write(question);
    const answer = await answers.next();

    return answer.done ? '' : answer.value;
  }

  try {
    console.log('token-validator setup');
    console.log('');

    const tokens = await ask('Token file path? (src/tokens.ts) ');
    const include = await ask('Include globs? (src/**/*.tsx) ');
    const exclude = await ask('Exclude globs? (dist/**,node_modules/**) ');
    const reportMode = await ask('Report mode? summary/detailed (summary) ');
    const reportLimit = await ask('Default issue limit? (10) ');
    const writeJsonReport = await ask('Write JSON report by default? y/N ');
    const reportOut = readBoolean(writeJsonReport, false)
      ? await ask('JSON report path? (reports/token-report.json) ')
      : '';
    const designSource = await ask('DESIGN.md path? (optional) ');
    const authority = designSource
      ? await ask(
          'Source authority? compare-only/design-md/code (compare-only) ',
        )
      : '';

    const config = buildSetupConfig({
      tokens: withDefault(tokens, 'src/tokens.ts'),
      include: parseCommaSeparatedList(withDefault(include, 'src/**/*.tsx')),
      exclude: parseCommaSeparatedList(
        withDefault(exclude, 'dist/**,node_modules/**'),
      ),
      reportMode: readReportMode(reportMode),
      reportLimit: readPositiveInteger(reportLimit, 10),
      writeJsonReport: readBoolean(writeJsonReport, false),
      reportOut,
      designSource,
      authority: readAuthority(authority),
    });
    const resolvedPath = writeSetupConfig(config, {
      configPath: options.configPath,
      force: options.force,
    });

    console.log('');
    console.log(`Config written to ${resolvedPath}`);

    return resolvedPath;
  } finally {
    rl.close();
  }
}

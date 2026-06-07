import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_INCLUDE = ['**/*.{ts,tsx,js,jsx}'];
const DEFAULT_EXCLUDE = ['dist/**', 'node_modules/**'];

interface DiscoverOptions {
  include?: string[];
  exclude?: string[];
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function expandBraces(pattern: string): string[] {
  const match = pattern.match(/^(.*)\{([^{}]+)\}(.*)$/);

  if (!match) {
    return [pattern];
  }

  const [, prefix, values, suffix] = match;

  if (!values) {
    return [pattern];
  }

  return values
    .split(',')
    .flatMap((value) => expandBraces(`${prefix}${value}${suffix}`));
}

function globToRegExp(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];

    if (character === '*' && nextCharacter === '*') {
      if (pattern[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
        continue;
      }

      source += '.*';
      index += 1;
      continue;
    }

    if (character === '*') {
      source += '[^/]*';
      continue;
    }

    if (character === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegExp(character ?? '');
  }

  return new RegExp(`^${source}$`);
}

function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns
    .flatMap(expandBraces)
    .some((pattern) => globToRegExp(toPosixPath(pattern)).test(filePath));
}

function walkDirectory(directoryPath: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDirectory(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export function discoverTargetFiles(
  targetPath: string,
  options: DiscoverOptions = {},
): string[] {
  const resolvedTargetPath = path.resolve(targetPath);
  const targetStats = statSync(resolvedTargetPath);

  if (targetStats.isFile()) {
    return [resolvedTargetPath];
  }

  if (!targetStats.isDirectory()) {
    throw new Error(`Target is not a file or directory: ${targetPath}`);
  }

  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = [...DEFAULT_EXCLUDE, ...(options.exclude ?? [])];

  return walkDirectory(resolvedTargetPath)
    .filter((filePath) => {
      const relativePath = toPosixPath(
        path.relative(resolvedTargetPath, filePath),
      );

      return (
        matchesAnyPattern(relativePath, include) &&
        !matchesAnyPattern(relativePath, exclude)
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

export function filterDiscoveredFiles(
  filePaths: string[],
  rootPath = process.cwd(),
  options: DiscoverOptions = {},
): string[] {
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = [...DEFAULT_EXCLUDE, ...(options.exclude ?? [])];

  return filePaths
    .map((filePath) => path.resolve(rootPath, filePath))
    .filter((filePath) => {
      try {
        return statSync(filePath).isFile();
      } catch {
        return false;
      }
    })
    .filter((filePath) => {
      const relativePath = toPosixPath(path.relative(rootPath, filePath));

      return (
        matchesAnyPattern(relativePath, include) &&
        !matchesAnyPattern(relativePath, exclude)
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

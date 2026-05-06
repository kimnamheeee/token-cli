import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FlattenedToken, LoadedTokens, TokenNode } from '../types/index.js';

function isTokenNode(value: unknown): value is TokenNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenValue(value: string): string {
  return value.trim().toLowerCase();
}

export function flattenTokens(
  node: TokenNode,
  parentSegments: string[] = [],
): FlattenedToken[] {
  const entries: FlattenedToken[] = [];

  for (const [key, value] of Object.entries(node)) {
    const segments = [...parentSegments, key];

    if (typeof value === 'string') {
      entries.push({
        path: segments.join('.'),
        value,
        normalizedValue: normalizeTokenValue(value),
        segments,
        group: segments[0] ?? 'unknown',
      });
      continue;
    }

    if (isTokenNode(value)) {
      entries.push(...flattenTokens(value, segments));
      continue;
    }

    throw new Error(`Invalid token value at "${segments.join('.')}"`);
  }

  return entries;
}

export function buildTokenIndexes(entries: FlattenedToken[]): Pick<
  LoadedTokens,
  'entriesByPath' | 'entriesByNormalizedValue'
> {
  const entriesByPath = new Map<string, FlattenedToken>();
  const entriesByNormalizedValue = new Map<string, FlattenedToken[]>();

  for (const entry of entries) {
    entriesByPath.set(entry.path, entry);

    const bucket = entriesByNormalizedValue.get(entry.normalizedValue);

    if (bucket) {
      bucket.push(entry);
      continue;
    }

    entriesByNormalizedValue.set(entry.normalizedValue, [entry]);
  }

  return {
    entriesByPath,
    entriesByNormalizedValue,
  };
}

export function parseTokens(rawContent: string, sourcePath = 'tokens.json'): LoadedTokens {
  const parsed: unknown = JSON.parse(rawContent);

  if (!isTokenNode(parsed)) {
    throw new Error(`Token file must contain a JSON object: ${sourcePath}`);
  }

  const entries = flattenTokens(parsed);
  const indexes = buildTokenIndexes(entries);

  return {
    sourcePath,
    tree: parsed,
    entries,
    ...indexes,
  };
}

export function loadTokens(tokenFilePath: string): LoadedTokens {
  const resolvedPath = path.resolve(tokenFilePath);
  const rawContent = readFileSync(resolvedPath, 'utf8');

  return parseTokens(rawContent, resolvedPath);
}

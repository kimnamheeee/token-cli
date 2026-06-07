import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  createLoadedTokens,
  type TokenLeafInfo,
} from '../../tokens/loadTokens.js';
import type { LoadedTokens, TokenNode, TokenValue } from '../../types/index.js';

export type DesignMdIssueSeverity = 'error' | 'warning';

export interface DesignMdLintIssue {
  code:
    | 'missing-frontmatter'
    | 'invalid-frontmatter'
    | 'duplicate-token'
    | 'unsupported-value'
    | 'broken-reference';
  severity: DesignMdIssueSeverity;
  path?: string;
  message: string;
}

export interface ParsedDesignMd {
  sourcePath: string;
  tokens: LoadedTokens;
  issues: DesignMdLintIssue[];
  body: string;
}

interface FrontmatterLine {
  indent: number;
  key: string;
  value?: string;
  lineNumber: number;
}

const TOKEN_ROOTS = new Set([
  'colors',
  'color',
  'spacing',
  'rounded',
  'radius',
  'typography',
  'components',
  'component',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenValue(value: unknown): value is TokenValue {
  return typeof value === 'string' || typeof value === 'number';
}

function extractFrontmatter(rawContent: string): {
  frontmatter?: string;
  body: string;
} {
  if (!rawContent.startsWith('---')) {
    return { body: rawContent };
  }

  const lines = rawContent.split(/\r?\n/);
  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line === '---',
  );

  if (endIndex < 0) {
    return { body: rawContent };
  }

  return {
    frontmatter: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n'),
  };
}

function parseScalar(value: string): TokenValue | string {
  const trimmedValue = value.trim();
  const quotedMatch = trimmedValue.match(/^(['"])(.*)\1$/);

  if (quotedMatch) {
    return quotedMatch[2] ?? '';
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmedValue)) {
    return Number(trimmedValue);
  }

  return trimmedValue;
}

function parseFrontmatterLines(frontmatter: string): FrontmatterLine[] {
  return frontmatter
    .split(/\r?\n/)
    .map((line, index): FrontmatterLine | undefined => {
      if (!line.trim() || line.trimStart().startsWith('#')) {
        return undefined;
      }

      const match = line.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/);

      if (!match) {
        throw new Error(`Unsupported frontmatter line ${index + 1}: ${line}`);
      }

      return {
        indent: match[1]?.length ?? 0,
        key: match[2]?.trim() ?? '',
        value: match[3],
        lineNumber: index + 1,
      };
    })
    .filter((line): line is FrontmatterLine => Boolean(line));
}

function setNestedValue(
  root: Record<string, unknown>,
  pathSegments: string[],
  value: unknown,
  issues: DesignMdLintIssue[],
): void {
  let current = root;

  for (const segment of pathSegments.slice(0, -1)) {
    const nextValue = current[segment];

    if (!isRecord(nextValue)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const leafSegment = pathSegments[pathSegments.length - 1];

  if (leafSegment) {
    if (Object.hasOwn(current, leafSegment)) {
      issues.push({
        code: 'duplicate-token',
        severity: 'warning',
        path: pathSegments.join('.'),
        message: `Duplicate DESIGN.md token path: ${pathSegments.join('.')}`,
      });
    }

    current[leafSegment] = value;
  }
}

function parseSimpleYaml(
  frontmatter: string,
  issues: DesignMdLintIssue[],
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; path: string[] }> = [
    { indent: -1, path: [] },
  ];

  for (const line of parseFrontmatterLines(frontmatter)) {
    while (stack.length > 1 && line.indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const parentPath = stack[stack.length - 1]?.path ?? [];
    const currentPath = [...parentPath, line.key];

    if (line.value === undefined || line.value.trim() === '') {
      setNestedValue(root, currentPath, {}, issues);
      stack.push({ indent: line.indent, path: currentPath });
      continue;
    }

    setNestedValue(root, currentPath, parseScalar(line.value), issues);
  }

  return root;
}

function getTokenFrontmatterRoot(
  frontmatter: Record<string, unknown>,
): TokenNode {
  if (isRecord(frontmatter.tokens)) {
    return frontmatter.tokens as TokenNode;
  }

  return Object.fromEntries(
    Object.entries(frontmatter).filter(([key]) => TOKEN_ROOTS.has(key)),
  ) as TokenNode;
}

function getReferencePath(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = value.trim().match(/^\{([^{}]+)\}$/);

  return match?.[1]?.trim();
}

function getValueAtPath(root: unknown, tokenPath: string): unknown {
  return tokenPath.split('.').reduce((currentValue: unknown, segment) => {
    if (!isRecord(currentValue)) {
      return undefined;
    }

    return currentValue[segment];
  }, root);
}

function resolveTokenNode(
  node: unknown,
  root: TokenNode,
  currentPath: string[],
  leafInfoByPath: Map<string, TokenLeafInfo>,
  issues: DesignMdLintIssue[],
  resolving = new Set<string>(),
): unknown {
  const currentId = currentPath.join('.');

  if (isTokenValue(node)) {
    const referencePath = getReferencePath(node);

    if (!referencePath) {
      return node;
    }

    if (resolving.has(referencePath)) {
      issues.push({
        code: 'broken-reference',
        severity: 'error',
        path: currentId,
        message: `Circular DESIGN.md token reference: ${referencePath}`,
      });
      return node;
    }

    const referencedValue = getValueAtPath(root, referencePath);

    if (referencedValue === undefined) {
      issues.push({
        code: 'broken-reference',
        severity: 'error',
        path: currentId,
        message: `Broken DESIGN.md token reference: ${referencePath}`,
      });
      return node;
    }

    resolving.add(referencePath);
    const resolvedValue = resolveTokenNode(
      referencedValue,
      root,
      referencePath.split('.'),
      leafInfoByPath,
      issues,
      resolving,
    );
    resolving.delete(referencePath);

    if (isTokenValue(resolvedValue)) {
      leafInfoByPath.set(currentId, {
        rawValue: node,
        aliasOf: referencePath,
        metadata: {
          source: 'design-md',
        },
      });

      return resolvedValue;
    }

    issues.push({
      code: 'broken-reference',
      severity: 'error',
      path: currentId,
      message: `DESIGN.md reference does not point to a token value: ${referencePath}`,
    });
    return node;
  }

  if (!isRecord(node)) {
    issues.push({
      code: 'unsupported-value',
      severity: 'warning',
      path: currentId,
      message: `Unsupported DESIGN.md token value at ${currentId || '<root>'}`,
    });
    return undefined;
  }

  const resolvedNode: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    const resolvedValue = resolveTokenNode(
      value,
      root,
      [...currentPath, key],
      leafInfoByPath,
      issues,
      resolving,
    );

    if (resolvedValue !== undefined) {
      resolvedNode[key] = resolvedValue;
    }
  }

  return resolvedNode;
}

export function parseDesignMd(
  rawContent: string,
  sourcePath = 'DESIGN.md',
): ParsedDesignMd {
  const { frontmatter, body } = extractFrontmatter(rawContent);
  const issues: DesignMdLintIssue[] = [];

  if (!frontmatter) {
    issues.push({
      code: 'missing-frontmatter',
      severity: 'error',
      message: 'DESIGN.md must start with YAML frontmatter',
    });

    return {
      sourcePath,
      tokens: createLoadedTokens({}, sourcePath),
      issues,
      body,
    };
  }

  let parsedFrontmatter: Record<string, unknown>;

  try {
    parsedFrontmatter = parseSimpleYaml(frontmatter, issues);
  } catch (error) {
    issues.push({
      code: 'invalid-frontmatter',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      sourcePath,
      tokens: createLoadedTokens({}, sourcePath),
      issues,
      body,
    };
  }

  const tokenRoot = getTokenFrontmatterRoot(parsedFrontmatter);
  const leafInfoByPath = new Map<string, TokenLeafInfo>();
  const resolvedRoot = resolveTokenNode(
    tokenRoot,
    tokenRoot,
    [],
    leafInfoByPath,
    issues,
  ) as TokenNode;

  return {
    sourcePath,
    tokens: createLoadedTokens(resolvedRoot, sourcePath, leafInfoByPath),
    issues,
    body,
  };
}

export function loadDesignMd(designPath: string): ParsedDesignMd {
  const resolvedPath = path.resolve(designPath);

  return parseDesignMd(readFileSync(resolvedPath, 'utf8'), resolvedPath);
}

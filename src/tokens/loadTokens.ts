import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse as parseSource } from '@babel/parser';
import {
  isExportNamedDeclaration,
  isIdentifier,
  isMemberExpression,
  isNumericLiteral,
  isObjectExpression,
  isObjectProperty,
  isParenthesizedExpression,
  isStringLiteral,
  isTSAsExpression,
  isTSSatisfiesExpression,
  isTSTypeAssertion,
  isUnaryExpression,
  isVariableDeclaration,
  isVariableDeclarator,
  type Expression,
  type Node,
} from '@babel/types';

import type {
  FlattenedToken,
  LoadedTokens,
  TokenLayer,
  TokenNode,
  TokenValue,
} from '../types/index.js';
import { getSupportedTokenGroup } from '../utils/valueParsers.js';

type TokenExpressionValue = TokenNode | TokenValue;

function isTokenValue(value: unknown): value is TokenValue {
  return typeof value === 'string' || typeof value === 'number';
}

function isTokenNode(value: unknown): value is TokenNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenValue(value: TokenValue): string {
  return String(value).trim().toLowerCase();
}

function getTokenLayerFromSegments(segments: string[]): TokenLayer {
  const [firstSegment] = segments;

  if (
    firstSegment === 'primitive'
    || firstSegment === 'semantic'
    || firstSegment === 'component'
  ) {
    return firstSegment;
  }

  return 'unknown';
}

function getTokenGroupFromSegments(segments: string[], layer: TokenLayer): string {
  if (layer === 'primitive' || layer === 'semantic') {
    return segments[1] ?? 'unknown';
  }

  if (layer === 'component') {
    const propertyName = segments[segments.length - 1];

    if (!propertyName) {
      return 'unknown';
    }

    return getSupportedTokenGroup(propertyName) ?? 'unknown';
  }

  return segments[0] ?? 'unknown';
}

export function flattenTokens(
  node: TokenNode,
  parentSegments: string[] = [],
): FlattenedToken[] {
  const entries: FlattenedToken[] = [];

  for (const [key, value] of Object.entries(node)) {
    const segments = [...parentSegments, key];
    const layer = getTokenLayerFromSegments(segments);
    const group = getTokenGroupFromSegments(segments, layer);

    if (isTokenValue(value)) {
      entries.push({
        path: segments.join('.'),
        value,
        normalizedValue: normalizeTokenValue(value),
        segments,
        group,
        layer,
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

function createLoadedTokens(tree: TokenNode, sourcePath: string): LoadedTokens {
  const entries = flattenTokens(tree);
  const indexes = buildTokenIndexes(entries);

  return {
    sourcePath,
    tree,
    entries,
    ...indexes,
  };
}

function unwrapExpression(node: Node): Expression {
  if (isTSAsExpression(node) || isTSSatisfiesExpression(node) || isTSTypeAssertion(node)) {
    return unwrapExpression(node.expression);
  }

  if (isParenthesizedExpression(node)) {
    return unwrapExpression(node.expression);
  }

  return node as Expression;
}

function getObjectPropertyKey(node: Node, pathSegments: string[]): string {
  if (isIdentifier(node)) {
    return node.name;
  }

  if (isStringLiteral(node)) {
    return node.value;
  }

  if (isNumericLiteral(node)) {
    return String(node.value);
  }

  throw new Error(`Unsupported token object key at "${pathSegments.join('.')}"`);
}

function getMemberPropertyKey(node: Node, pathSegments: string[]): string {
  if (isIdentifier(node)) {
    return node.name;
  }

  if (isStringLiteral(node)) {
    return node.value;
  }

  if (isNumericLiteral(node)) {
    return String(node.value);
  }

  throw new Error(`Unsupported token member access at "${pathSegments.join('.')}"`);
}

function evaluateTokenExpression(
  node: Expression,
  resolveBinding: (name: string, pathSegments: string[]) => TokenExpressionValue,
  pathSegments: string[] = [],
): TokenExpressionValue {
  const expression = unwrapExpression(node);

  if (isStringLiteral(expression)) {
    return expression.value;
  }

  if (isNumericLiteral(expression)) {
    return expression.value;
  }

  if (
    isUnaryExpression(expression)
    && expression.operator === '-'
    && isNumericLiteral(expression.argument)
  ) {
    return -expression.argument.value;
  }

  if (isIdentifier(expression)) {
    return resolveBinding(expression.name, pathSegments);
  }

  if (isObjectExpression(expression)) {
    const objectValue: TokenNode = {};

    for (const property of expression.properties) {
      if (!isObjectProperty(property)) {
        throw new Error(
          `Unsupported token object entry at "${pathSegments.join('.') || '<root>'}"`,
        );
      }

      const key = getObjectPropertyKey(property.key, pathSegments);
      objectValue[key] = evaluateTokenExpression(
        property.value as Expression,
        resolveBinding,
        [...pathSegments, key],
      );
    }

    return objectValue;
  }

  if (isMemberExpression(expression)) {
    const objectValue = evaluateTokenExpression(
      expression.object as Expression,
      resolveBinding,
      pathSegments,
    );

    if (!isTokenNode(objectValue)) {
      throw new Error(
        `Cannot read token member from non-object at "${pathSegments.join('.') || '<root>'}"`,
      );
    }

    const propertyKey = expression.computed
      ? getMemberPropertyKey(expression.property, pathSegments)
      : getMemberPropertyKey(expression.property, pathSegments);

    const propertyValue = objectValue[propertyKey];

    if (propertyValue === undefined) {
      throw new Error(
        `Unknown token reference "${propertyKey}" at "${pathSegments.join('.') || '<root>'}"`,
      );
    }

    return propertyValue;
  }

  throw new Error(
    `Unsupported token expression at "${pathSegments.join('.') || '<root>'}"`,
  );
}

export function parseJsonTokens(
  rawContent: string,
  sourcePath = 'tokens.json',
): LoadedTokens {
  const parsed: unknown = JSON.parse(rawContent);

  if (!isTokenNode(parsed)) {
    throw new Error(`Token file must contain a JSON object: ${sourcePath}`);
  }

  return createLoadedTokens(parsed, sourcePath);
}

export function parseTypeScriptTokens(
  rawContent: string,
  sourcePath = 'tokens.ts',
): LoadedTokens {
  const ast = parseSource(rawContent, {
    sourceType: 'module',
    sourceFilename: sourcePath,
    plugins: ['typescript', 'jsx'],
  });

  const declarations = new Map<string, Expression>();
  const cache = new Map<string, TokenExpressionValue>();
  const resolving = new Set<string>();

  for (const statement of ast.program.body) {
    if (!isExportNamedDeclaration(statement) || !statement.declaration) {
      continue;
    }

    if (!isVariableDeclaration(statement.declaration)) {
      continue;
    }

    for (const declarator of statement.declaration.declarations) {
      if (!isVariableDeclarator(declarator) || !declarator.init || !isIdentifier(declarator.id)) {
        continue;
      }

      declarations.set(declarator.id.name, declarator.init as Expression);
    }
  }

  function resolveBinding(name: string, pathSegments: string[]): TokenExpressionValue {
    const cachedValue = cache.get(name);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    if (resolving.has(name)) {
      throw new Error(`Circular token reference detected for "${name}"`);
    }

    const declaration = declarations.get(name);

    if (!declaration) {
      throw new Error(
        `Unknown token binding "${name}" at "${pathSegments.join('.') || '<root>'}"`,
      );
    }

    resolving.add(name);

    const resolvedValue = evaluateTokenExpression(
      declaration,
      resolveBinding,
      [name],
    );

    resolving.delete(name);
    cache.set(name, resolvedValue);

    return resolvedValue;
  }

  const tree: TokenNode = {};

  for (const exportName of declarations.keys()) {
    const exportValue = resolveBinding(exportName, [exportName]);

    if (!isTokenNode(exportValue)) {
      throw new Error(`Top-level token export "${exportName}" must be an object`);
    }

    tree[exportName] = exportValue;
  }

  return createLoadedTokens(tree, sourcePath);
}

export function parseTokens(rawContent: string, sourcePath = 'tokens.json'): LoadedTokens {
  const extension = path.extname(sourcePath).toLowerCase();

  if (extension === '.json') {
    return parseJsonTokens(rawContent, sourcePath);
  }

  if (
    extension === '.ts'
    || extension === '.tsx'
    || extension === '.js'
    || extension === '.jsx'
    || extension === '.mjs'
    || extension === '.cjs'
  ) {
    return parseTypeScriptTokens(rawContent, sourcePath);
  }

  throw new Error(`Unsupported token file extension: ${extension || '<none>'}`);
}

export function loadTokens(tokenFilePath: string): LoadedTokens {
  const resolvedPath = path.resolve(tokenFilePath);
  const rawContent = readFileSync(resolvedPath, 'utf8');

  return parseTokens(rawContent, resolvedPath);
}

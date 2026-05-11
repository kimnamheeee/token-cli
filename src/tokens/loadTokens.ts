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
  TokenRecord,
  TokenResolvedValue,
  TokenType,
  TokenValue,
} from '../types/index.js';
import { getSupportedTokenGroup } from '../utils/valueParsers.js';

type TokenExpressionValue = TokenNode | TokenValue;

interface TokenLeafInfo {
  rawValue: unknown;
  aliasOf?: string;
  metadata?: Record<string, unknown>;
}

interface TokenSourceAdapter {
  parse(rawContent: string, sourcePath: string): LoadedTokens;
  supports(extension: string): boolean;
}

function isTokenValue(value: unknown): value is TokenValue {
  return typeof value === 'string' || typeof value === 'number';
}

function isTokenNode(value: unknown): value is TokenNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenResolvedObject(value: TokenResolvedValue): value is Record<string, TokenValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenValue(value: TokenValue): string {
  return String(value).trim().toLowerCase();
}

function normalizeResolvedValue(value: TokenResolvedValue): string {
  if (!isTokenResolvedObject(value)) {
    return normalizeTokenValue(value);
  }

  const sortedEntries = Object.entries(value).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );

  return JSON.stringify(
    Object.fromEntries(
      sortedEntries.map(([key, entryValue]) => [key, normalizeTokenValue(entryValue)]),
    ),
  );
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

function getTokenTypeFromGroup(group: string): TokenType {
  if (group === 'color' || group === 'spacing' || group === 'radius') {
    return group;
  }

  if (group === 'typography' || group === 'shadow') {
    return group;
  }

  return 'unknown';
}

function buildFlattenedToken(record: TokenRecord): FlattenedToken {
  const scalarValue = isTokenResolvedObject(record.resolvedValue)
    ? JSON.stringify(record.resolvedValue)
    : record.resolvedValue;

  return {
    path: record.id,
    value: scalarValue,
    normalizedValue: record.normalizedResolvedValue,
    segments: record.path,
    group: record.type,
    layer: record.level,
    source: record.source,
    rawValue: record.rawValue,
    aliasOf: record.aliasOf,
    metadata: record.metadata,
  };
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

function buildRecordIndexes(records: TokenRecord[]): Pick<
  LoadedTokens,
  'recordsById' | 'recordsByNormalizedValue'
> {
  const recordsById = new Map<string, TokenRecord>();
  const recordsByNormalizedValue = new Map<string, TokenRecord[]>();

  for (const record of records) {
    recordsById.set(record.id, record);

    const bucket = recordsByNormalizedValue.get(record.normalizedResolvedValue);

    if (bucket) {
      bucket.push(record);
      continue;
    }

    recordsByNormalizedValue.set(record.normalizedResolvedValue, [record]);
  }

  return {
    recordsById,
    recordsByNormalizedValue,
  };
}

function createRecordMetadata(
  segments: string[],
  level: TokenLayer,
  type: TokenType,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    pathDepth: segments.length,
  };

  if (level === 'component') {
    metadata.component = segments[1] ?? null;
    metadata.slot = segments.slice(2, -1).join('.') || null;
    metadata.role = segments[segments.length - 1] ?? null;
  } else if (level === 'semantic') {
    metadata.role = segments[2] ?? segments[segments.length - 1] ?? null;
  } else if (level === 'primitive') {
    metadata.scale = segments[segments.length - 1] ?? null;
  }

  metadata.type = type;

  return metadata;
}

function flattenTokenRecords(
  node: TokenNode,
  sourcePath: string,
  leafInfoByPath = new Map<string, TokenLeafInfo>(),
  parentSegments: string[] = [],
): TokenRecord[] {
  const records: TokenRecord[] = [];

  for (const [key, value] of Object.entries(node)) {
    const segments = [...parentSegments, key];
    const id = segments.join('.');
    const level = getTokenLayerFromSegments(segments);
    const group = getTokenGroupFromSegments(segments, level);
    const type = getTokenTypeFromGroup(group);

    if (isTokenValue(value)) {
      const leafInfo = leafInfoByPath.get(id);

      records.push({
        id,
        path: segments,
        rawValue: leafInfo?.rawValue ?? value,
        resolvedValue: value,
        normalizedResolvedValue: normalizeResolvedValue(value),
        type,
        level,
        source: sourcePath,
        aliasOf: leafInfo?.aliasOf,
        metadata: {
          ...createRecordMetadata(segments, level, type),
          ...leafInfo?.metadata,
        },
      });
      continue;
    }

    if (isTokenNode(value)) {
      records.push(...flattenTokenRecords(value, sourcePath, leafInfoByPath, segments));
      continue;
    }

    throw new Error(`Invalid token value at "${id}"`);
  }

  return records;
}

export function flattenTokens(
  node: TokenNode,
  parentSegments: string[] = [],
): FlattenedToken[] {
  const records = flattenTokenRecords(node, '<inline>', new Map(), parentSegments);
  return records.map(buildFlattenedToken);
}

function createLoadedTokens(
  tree: TokenNode,
  sourcePath: string,
  leafInfoByPath = new Map<string, TokenLeafInfo>(),
): LoadedTokens {
  const records = flattenTokenRecords(tree, sourcePath, leafInfoByPath);
  const entries = records.map(buildFlattenedToken);
  const recordIndexes = buildRecordIndexes(records);
  const entryIndexes = buildTokenIndexes(entries);

  return {
    sourcePath,
    tree,
    records,
    ...recordIndexes,
    entries,
    ...entryIndexes,
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

function getReferencePath(
  node: Expression,
  pathSegments: string[],
): string[] | null {
  const expression = unwrapExpression(node);

  if (isIdentifier(expression)) {
    return [expression.name];
  }

  if (!isMemberExpression(expression)) {
    return null;
  }

  const objectPath = getReferencePath(expression.object as Expression, pathSegments);

  if (!objectPath) {
    return null;
  }

  return [
    ...objectPath,
    getMemberPropertyKey(expression.property, pathSegments),
  ];
}

function getSourceSnippet(node: Node, rawContent: string): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') {
    return '';
  }

  return rawContent.slice(node.start, node.end);
}

function setLeafInfo(
  leafInfoByPath: Map<string, TokenLeafInfo>,
  pathSegments: string[],
  rawValue: unknown,
  aliasOf?: string,
): void {
  if (pathSegments.length === 0) {
    return;
  }

  leafInfoByPath.set(pathSegments.join('.'), {
    rawValue,
    aliasOf,
  });
}

function evaluateTokenExpression(
  node: Expression,
  resolveBinding: (name: string, pathSegments: string[]) => TokenExpressionValue,
  rawContent: string,
  leafInfoByPath: Map<string, TokenLeafInfo>,
  pathSegments: string[] = [],
): TokenExpressionValue {
  const expression = unwrapExpression(node);

  if (isStringLiteral(expression)) {
    setLeafInfo(leafInfoByPath, pathSegments, expression.value);
    return expression.value;
  }

  if (isNumericLiteral(expression)) {
    setLeafInfo(leafInfoByPath, pathSegments, expression.value);
    return expression.value;
  }

  if (
    isUnaryExpression(expression)
    && expression.operator === '-'
    && isNumericLiteral(expression.argument)
  ) {
    const value = -expression.argument.value;
    setLeafInfo(leafInfoByPath, pathSegments, value);
    return value;
  }

  if (isIdentifier(expression)) {
    const resolvedValue = resolveBinding(expression.name, pathSegments);

    if (isTokenValue(resolvedValue)) {
      setLeafInfo(
        leafInfoByPath,
        pathSegments,
        getSourceSnippet(expression, rawContent),
        expression.name,
      );
    }

    return resolvedValue;
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
        rawContent,
        leafInfoByPath,
        [...pathSegments, key],
      );
    }

    return objectValue;
  }

  if (isMemberExpression(expression)) {
    const objectValue = evaluateTokenExpression(
      expression.object as Expression,
      resolveBinding,
      rawContent,
      leafInfoByPath,
      pathSegments,
    );

    if (!isTokenNode(objectValue)) {
      throw new Error(
        `Cannot read token member from non-object at "${pathSegments.join('.') || '<root>'}"`,
      );
    }

    const propertyKey = getMemberPropertyKey(expression.property, pathSegments);
    const propertyValue = objectValue[propertyKey];

    if (propertyValue === undefined) {
      throw new Error(
        `Unknown token reference "${propertyKey}" at "${pathSegments.join('.') || '<root>'}"`,
      );
    }

    if (isTokenValue(propertyValue)) {
      const referencePath = getReferencePath(expression, pathSegments);
      setLeafInfo(
        leafInfoByPath,
        pathSegments,
        getSourceSnippet(expression, rawContent),
        referencePath?.join('.'),
      );
    }

    return propertyValue;
  }

  throw new Error(
    `Unsupported token expression at "${pathSegments.join('.') || '<root>'}"`,
  );
}

function parseJsonTokens(
  rawContent: string,
  sourcePath: string,
): LoadedTokens {
  const parsed: unknown = JSON.parse(rawContent);

  if (!isTokenNode(parsed)) {
    throw new Error(`Token file must contain a JSON object: ${sourcePath}`);
  }

  return createLoadedTokens(parsed, sourcePath);
}

function parseTypeScriptTokens(
  rawContent: string,
  sourcePath: string,
): LoadedTokens {
  const ast = parseSource(rawContent, {
    sourceType: 'module',
    sourceFilename: sourcePath,
    plugins: ['typescript', 'jsx'],
  });

  const declarations = new Map<string, Expression>();
  const cache = new Map<string, TokenExpressionValue>();
  const resolving = new Set<string>();
  const leafInfoByPath = new Map<string, TokenLeafInfo>();

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
      rawContent,
      leafInfoByPath,
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

  return createLoadedTokens(tree, sourcePath, leafInfoByPath);
}

const jsonTokenAdapter: TokenSourceAdapter = {
  parse(rawContent, sourcePath) {
    return parseJsonTokens(rawContent, sourcePath);
  },
  supports(extension) {
    return extension === '.json';
  },
};

const typeScriptTokenAdapter: TokenSourceAdapter = {
  parse(rawContent, sourcePath) {
    return parseTypeScriptTokens(rawContent, sourcePath);
  },
  supports(extension) {
    return (
      extension === '.ts'
      || extension === '.tsx'
      || extension === '.js'
      || extension === '.jsx'
      || extension === '.mjs'
      || extension === '.cjs'
    );
  },
};

const tokenSourceAdapters: TokenSourceAdapter[] = [
  jsonTokenAdapter,
  typeScriptTokenAdapter,
];

export function parseTokens(rawContent: string, sourcePath = 'tokens.json'): LoadedTokens {
  const extension = path.extname(sourcePath).toLowerCase();
  const adapter = tokenSourceAdapters.find((candidate) => candidate.supports(extension));

  if (!adapter) {
    throw new Error(`Unsupported token file extension: ${extension || '<none>'}`);
  }

  return adapter.parse(rawContent, sourcePath);
}

export function loadTokens(tokenFilePath: string): LoadedTokens {
  const resolvedPath = path.resolve(tokenFilePath);
  const rawContent = readFileSync(resolvedPath, 'utf8');

  return parseTokens(rawContent, resolvedPath);
}

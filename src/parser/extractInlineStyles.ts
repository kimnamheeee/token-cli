import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';
import traverseImport, {
  type NodePath,
  type Scope,
  type TraverseOptions,
} from '@babel/traverse';
import {
  type Node,
  isIdentifier,
  isJSXAttribute,
  isJSXExpressionContainer,
  isJSXIdentifier,
  isNumericLiteral,
  isObjectExpression,
  isObjectProperty,
  isStringLiteral,
  isTemplateLiteral,
} from '@babel/types';

import type { InlineStyleBlock, InlineStyleDeclaration } from '../types/index.js';

type TraverseFunction = (
  parent: Node,
  opts?: TraverseOptions,
  scope?: Scope,
  state?: unknown,
  parentPath?: NodePath,
) => void;

const traverse = (traverseImport as { default: TraverseFunction }).default;

function getPropertyName(property: Node | null | undefined): string | null {
  if (isIdentifier(property)) {
    return property.name;
  }

  if (isStringLiteral(property)) {
    return property.value;
  }

  return null;
}

function getLiteralDeclarationValue(
  value: Node | null | undefined,
): Pick<InlineStyleDeclaration, 'rawValue' | 'valueType'> | null {
  if (isStringLiteral(value)) {
    return {
      rawValue: value.value,
      valueType: 'string',
    };
  }

  if (isNumericLiteral(value)) {
    return {
      rawValue: String(value.value),
      valueType: 'number',
    };
  }

  if (isTemplateLiteral(value) && value.expressions.length === 0) {
    return {
      rawValue: value.quasis.map((quasi) => quasi.value.cooked ?? '').join(''),
      valueType: 'string',
    };
  }

  return null;
}

export function extractInlineStylesFromCode(
  sourceCode: string,
  filePath = '<inline>',
): InlineStyleBlock[] {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    sourceFilename: filePath,
    plugins: ['jsx', 'typescript'],
  });

  const blocks: InlineStyleBlock[] = [];

  traverse(ast, {
    JSXAttribute(attributePath) {
      const node = attributePath.node;

      if (!isJSXAttribute(node) || !isJSXIdentifier(node.name) || node.name.name !== 'style') {
        return;
      }

      if (!node.value || !isJSXExpressionContainer(node.value)) {
        return;
      }

      const expression = node.value.expression;

      if (!isObjectExpression(expression)) {
        return;
      }

      const declarations: InlineStyleDeclaration[] = [];

      for (const property of expression.properties) {
        if (!isObjectProperty(property) || property.computed) {
          continue;
        }

        const propertyName = getPropertyName(property.key);
        const literalValue = getLiteralDeclarationValue(property.value);

        if (!propertyName || !literalValue || !property.loc) {
          continue;
        }

        declarations.push({
          property: propertyName,
          rawValue: literalValue.rawValue,
          valueType: literalValue.valueType,
          line: property.loc.start.line,
          column: property.loc.start.column,
        });
      }

      if (declarations.length === 0 || !node.loc) {
        return;
      }

      blocks.push({
        filePath,
        line: node.loc.start.line,
        column: node.loc.start.column,
        declarations,
      });
    },
  });

  return blocks;
}

export function extractInlineStylesFromFile(filePath: string): InlineStyleBlock[] {
  const resolvedPath = path.resolve(filePath);
  const sourceCode = readFileSync(resolvedPath, 'utf8');

  return extractInlineStylesFromCode(sourceCode, resolvedPath);
}

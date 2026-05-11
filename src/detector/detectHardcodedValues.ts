import type {
  DetectedHardcodedValue,
  InlineStyleBlock,
} from '../types/index.js';
import { parseDeclarationValue } from '../utils/valueParsers.js';

export function detectHardcodedValues(
  blocks: InlineStyleBlock[],
): DetectedHardcodedValue[] {
  const detectedValues: DetectedHardcodedValue[] = [];

  for (const block of blocks) {
    detectedValues.push(...detectHardcodedValuesInBlock(block));
  }

  return detectedValues;
}

export function detectHardcodedValuesInBlock(
  block: InlineStyleBlock,
): DetectedHardcodedValue[] {
  const detectedValues: DetectedHardcodedValue[] = [];

  for (const declaration of block.declarations) {
    const parsedValue = parseDeclarationValue(declaration);

    if (!parsedValue) {
      continue;
    }

    detectedValues.push({
      filePath: block.filePath,
      line: declaration.line,
      column: declaration.column,
      property: declaration.property,
      rawValue: declaration.rawValue,
      normalizedValue: parsedValue.normalizedValue,
      valueType: declaration.valueType,
      tokenGroup: parsedValue.tokenGroup,
    });
  }

  return detectedValues;
}

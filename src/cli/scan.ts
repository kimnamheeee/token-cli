import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { matchTokens } from '../matcher/matchTokens.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadTokens } from '../tokens/loadTokens.js';

function getDetectedValueKey(
  detectedValue: {
    filePath: string;
    line: number;
    column: number;
    property: string;
    rawValue: string;
  },
): string {
  return [
    detectedValue.filePath,
    detectedValue.line,
    detectedValue.column,
    detectedValue.property,
    detectedValue.rawValue,
  ].join(':');
}

export function scan(targetPath: string, tokenPath?: string): void {
  const blocks = extractInlineStylesFromFile(targetPath);
  const detectedValues = detectHardcodedValues(blocks);

  if (blocks.length === 0) {
    console.log(`No inline style literals found in ${targetPath}`);
    return;
  }

  if (detectedValues.length === 0) {
    console.log(`No supported hardcoded color or spacing values found in ${targetPath}`);
    return;
  }

  if (tokenPath) {
    const tokens = loadTokens(tokenPath);
    const matches = matchTokens(detectedValues, tokens);
    const matchedKeys = new Set(matches.map(getDetectedValueKey));
    const otherHardcodedValues = detectedValues.filter(
      (detectedValue) => !matchedKeys.has(getDetectedValueKey(detectedValue)),
    );

    if (matches.length === 0 && otherHardcodedValues.length === 0) {
      console.log(`No exact matching tokens found for supported values in ${targetPath}`);
      return;
    }

    if (matches.length > 0) {
      console.log('Deterministic matches');
      console.log('');

      for (const match of matches) {
        console.log(`${match.filePath}:${match.line}:${match.column}`);
        console.log(
          `  ${match.property}: ${JSON.stringify(match.rawValue)}`
          + ` -> ${match.suggestion} (${match.case})`,
        );
      }
    }

    if (otherHardcodedValues.length > 0) {
      if (matches.length > 0) {
        console.log('');
      }

      console.log('Other hardcoded values');
      console.log('');

      for (const detectedValue of otherHardcodedValues) {
        console.log(
          `${detectedValue.filePath}:${detectedValue.line}:${detectedValue.column}`,
        );
        console.log(
          `  ${detectedValue.property}: ${JSON.stringify(detectedValue.rawValue)}`
          + ` (${detectedValue.valueType}, ${detectedValue.tokenGroup})`,
        );
      }
    }

    return;
  }

  for (const detectedValue of detectedValues) {
    console.log(`${detectedValue.filePath}:${detectedValue.line}:${detectedValue.column}`);
    console.log(
      `  ${detectedValue.property}: ${JSON.stringify(detectedValue.rawValue)}`
      + ` (${detectedValue.valueType}, ${detectedValue.tokenGroup})`,
    );
  }
}

import { classifyIssues } from '../classifier/classifyIssues.js';
import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';
import { loadTokens } from '../tokens/loadTokens.js';

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
    const classifiedIssues = classifyIssues(detectedValues, tokens);
    const {
      deterministic,
      ambiguous,
      unresolved: otherHardcodedValues,
    } = classifiedIssues;

    if (
      deterministic.length === 0
      && ambiguous.length === 0
      && otherHardcodedValues.length === 0
    ) {
      console.log(`No exact matching tokens found for supported values in ${targetPath}`);
      return;
    }

    if (deterministic.length > 0) {
      console.log('Deterministic matches');
      console.log('');

      for (const match of deterministic) {
        console.log(`${match.filePath}:${match.line}:${match.column}`);
        console.log(
          `  ${match.property}: ${JSON.stringify(match.rawValue)}`
          + ` -> ${match.suggestion} (${match.case})`,
        );
      }
    }

    if (ambiguous.length > 0) {
      if (deterministic.length > 0) {
        console.log('');
      }

      console.log('Ambiguous matches');
      console.log('');

      for (const match of ambiguous) {
        console.log(`${match.filePath}:${match.line}:${match.column}`);
        console.log(
          `  ${match.property}: ${JSON.stringify(match.rawValue)}`
          + ` -> ${match.candidates.join(', ')} (${match.case})`,
        );
      }
    }

    if (otherHardcodedValues.length > 0) {
      if (deterministic.length > 0 || ambiguous.length > 0) {
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

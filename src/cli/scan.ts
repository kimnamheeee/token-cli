import { detectHardcodedValues } from '../detector/detectHardcodedValues.js';
import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';

export function scan(targetPath: string): void {
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

  for (const detectedValue of detectedValues) {
    console.log(`${detectedValue.filePath}:${detectedValue.line}:${detectedValue.column}`);
    console.log(
      `  ${detectedValue.property}: ${JSON.stringify(detectedValue.rawValue)}`
      + ` (${detectedValue.valueType}, ${detectedValue.tokenGroup})`,
    );
  }
}

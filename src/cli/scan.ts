import { extractInlineStylesFromFile } from '../parser/extractInlineStyles.js';

export function scan(targetPath: string): void {
  const blocks = extractInlineStylesFromFile(targetPath);

  if (blocks.length === 0) {
    console.log(`No inline style literals found in ${targetPath}`);
    return;
  }

  for (const block of blocks) {
    console.log(`${block.filePath}:${block.line}:${block.column}`);

    for (const declaration of block.declarations) {
      console.log(
        `  ${declaration.property}: ${JSON.stringify(declaration.rawValue)} (${declaration.valueType}) @ ${declaration.line}:${declaration.column}`,
      );
    }
  }
}

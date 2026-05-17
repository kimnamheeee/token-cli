# Test Directory

This directory contains unit tests for the design token validation CLI.
The current test suite focuses on the core analysis pipeline in `src/`:

- `src/parser/`: parses source code and extracts literal inline style declarations from JSX
- `src/utils/`: normalizes raw style values and maps CSS properties to supported token groups
- `src/detector/`: converts extracted declarations into hardcoded-value detections
- `src/matcher/`: finds exact token matches for detected values
- `src/classifier/`: classifies detections into `deterministic`, `ambiguous`, `no-candidate`, and `unsupported`
- `src/tokens/`: loads token definitions from JSON or TypeScript and builds lookup indexes
- `src/reporter/`: exports structured JSON reports for downstream use

The tests in this directory are written as unit tests around those modules rather than end-to-end CLI tests. The goal is to lock down parsing, normalization, classification, and token-loading behavior independently.

## Test Files

### `valueParsers.test.ts`

Tests the normalization and grouping helpers in `src/utils/valueParsers.ts`.

- verifies supported property-to-token-group mapping
- verifies color parsing and lowercase normalization for supported literal formats
- verifies spacing parsing for number values and unit-based strings
- verifies that unsupported properties or invalid values are ignored

### `detector.test.ts`

Tests detection logic in `src/detector/detectHardcodedValues.ts`.

- verifies that supported declarations are converted into detected hardcoded values
- verifies normalized output for color and spacing examples
- verifies that unsupported declarations are skipped
- verifies that detections are flattened correctly across multiple inline style blocks

### `classification.test.ts`

Tests matching and classification behavior in `src/matcher/matchTokens.ts` and `src/classifier/classifyIssues.ts`.

- verifies exact-match lookup by normalized value and token group
- verifies that deterministic matches are returned only when a single exact token exists
- verifies classification into `deterministic`, `ambiguous`, `no-candidate`, and `unsupported`
- verifies the reasons and candidate lists attached to classified issues

### `parser.test.ts`

Tests inline style extraction in `src/parser/extractInlineStyles.ts`.

- verifies extraction of literal inline style declarations from JSX `style={{ ... }}`
- verifies support for string literals, number literals, and static template literals
- verifies that dynamic values are ignored
- verifies that non-object `style` props are ignored

### `exportJsonReport.test.ts`

Tests structured JSON export in `src/reporter/exportJsonReport.ts`.

- verifies summary fields in detection reports
- verifies issue fields written for detected and classified reports
- verifies sorting of classified issues by file, line, and column
- verifies formatting details such as `detected_type`

### `loadTokens.test.ts`

Tests token loading and indexing behavior in `src/tokens/loadTokens.ts`.

- verifies flattening of nested token trees into indexed records
- verifies lookup index creation by token path and normalized value
- verifies JSON token parsing
- verifies TypeScript token parsing with alias resolution
- verifies handling of parenthesized expressions, `as const`, and `satisfies`
- verifies handling of negative numeric values and component-token metadata
- verifies handling of string or numeric object keys and bracket member access
- verifies error handling for unsupported file extensions, invalid JSON roots, unknown bindings, non-object top-level exports, and circular references

## Scope Notes

- The current suite is centered on unit tests for reusable modules.
- CLI argument parsing and console output formatting are not the primary focus.
- `printCliReport.ts` is currently covered indirectly through report data preparation rather than direct output snapshot tests.

# token-validator

Static analysis CLI for validating design token usage in frontend codebases.

## Current status

Project bootstrap for Phase 1 / Commit 1 is in place:

- Node.js + TypeScript project configuration
- CLI entry point
- Lint / format / typecheck configuration
- Source directory scaffold
- Initial token schema example and token loader utilities
- Babel-based inline style extraction POC

## Scan command

```bash
token-validator scan ./src/Button.tsx --tokens ./tokens.json
token-validator scan ./src/Button.tsx --config ./token-validator.config.json
```

CLI options override config values.

Create a config interactively:

```bash
token-validator setup
token-validator setup --config ./token-validator.config.json --force
```

```json
{
  "tokens": "samples/tokens/storefront.tokens.ts",
  "report": {
    "mode": "summary",
    "limit": 10,
    "format": "json",
    "out": "reports/token-report.json",
    "explain": false
  },
  "sources": {
    "design": "DESIGN.md",
    "tokens": "src/tokens.ts"
  },
  "authority": "compare-only"
}
```

## Current POC

After installing dependencies, you can inspect a sample file with:

```bash
npm run dev -- scan samples/before/PromoBanner.tsx --tokens samples/tokens/storefront.tokens.ts
```

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

## Planned command

```bash
token-validator scan ./src --tokens ./tokens.json
```

## Current POC

After installing dependencies, you can inspect a sample file with:

```bash
npm run dev -- scan samples/before/Button.tsx
```

# token-validator

Static analysis CLI for validating design token usage in frontend codebases.

## Current status

The CLI can scan files/directories, produce summary or JSON reports, create a
starter config interactively, and run git-diff focused checks for PR/CI hooks.

## Scan command

```bash
token-validator scan ./src/Button.tsx --tokens ./tokens.json
token-validator scan ./src --tokens ./tokens.json --report summary --limit 10
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

## Diff command

`diff` scans only changed files so legacy violations do not drown out PR signal.
By default it compares the working tree against `HEAD`; use `--staged` for
pre-commit hooks or `--base`/`--head` for PR and pre-push checks.

```bash
token-validator diff --config ./token-validator.config.json
token-validator diff --staged --config ./token-validator.config.json
token-validator diff --base origin/main --head HEAD --config ./token-validator.config.json --strict
token-validator diff src/Button.tsx --tokens ./tokens.json
```

Exit policy:

- default: fail when an `error` severity issue or scan error is found
- `--strict`: fail on `warning` severity too
- `info` and `unknown` are reported but do not fail the command

Structured output for CI annotations:

```bash
token-validator diff --staged --config ./token-validator.config.json --format json --out reports/token-diff.json
```

Husky examples:

```sh
# .husky/pre-commit
npx token-validator diff --staged --config token-validator.config.json
```

```sh
# .husky/pre-push
npx token-validator diff --base origin/main --head HEAD --config token-validator.config.json --strict
```

## Migrate command

`migrate` produces a replacement plan without editing code. It groups findings
by migration action so teams can split safe codemod candidates from manual
review and missing-token work.

```bash
token-validator migrate ./src --config ./token-validator.config.json
token-validator migrate ./src --tokens ./tokens.json --format json --out reports/token-migration.json
```

Report groups:

- `safe replacements`: high-confidence replacements from the decision model
- `needs review`: multiple plausible token candidates
- `no token found`: values that may need a new token or corrected value
- `unsupported`: detected values outside current matcher coverage

JSON output includes stable migration issue ids such as `MIG-1a2b3c4d5e` and
`replacementCandidateId` for future codemod/apply support.

## DESIGN.md sync

`sync` compares DESIGN.md frontmatter tokens with the code token source. This
does not generate DESIGN.md from Figma; it checks whether an existing DESIGN.md
and implementation token file still agree.

```bash
token-validator sync --design ./DESIGN.md --tokens ./src/tokens.ts
token-validator sync --config ./token-validator.config.json
token-validator sync --design ./DESIGN.md --tokens ./tokens.json --authority design-md --format json --out reports/design-sync.json
```

The initial DESIGN.md adapter supports YAML frontmatter token maps such as
`colors`, `spacing`, `rounded`, `typography`, and `components`. It resolves
simple `{path.to.token}` references and reports broken references as lint issues.

Sync report categories:

- `design lint`: invalid frontmatter, unsupported values, broken references
- `value mismatch`: same token path exists in both sources with different values
- `missing in code`: DESIGN.md token absent from code tokens
- `code-only token`: code token absent from DESIGN.md
- `same value/different name`: tokens that resolve to the same value under different names

`--authority design-md|code|compare-only` controls mismatch severity.

## Current POC

After installing dependencies, you can inspect a sample file with:

```bash
npm run dev -- scan samples/before/PromoBanner.tsx --tokens samples/tokens/storefront.tokens.ts
```

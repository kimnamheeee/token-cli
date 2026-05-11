# After samples

These files show the same UI intent as the `before/` directory, but with token references instead of hardcoded literals.

- token references are pulled from `tokens.ts`
- inline style objects are still used so the before/after difference stays easy to inspect
- the files are intended for demo comparison, not as final production patterns

Example:

```bash
token-validator scan samples/after/ProductCard.tsx --tokens tokens.ts
token-validator scan samples/after/SettingsPanel.tsx --tokens tokens.ts
token-validator scan samples/after/PromoBanner.tsx --tokens tokens.ts
```

The expected result is that these files produce fewer or no hardcoded literal findings compared to `before/`.

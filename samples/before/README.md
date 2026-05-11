# Before samples

These files represent a more realistic pre-adoption codebase.

- `ProductCard.tsx`: product shelf / commerce card UI
- `SettingsPanel.tsx`: account settings section
- `PromoBanner.tsx`: marketing banner / announcement block

They intentionally contain:

- deterministic values that map to one token
- ambiguous values shared by primitive / semantic / component layers
- no-candidate values that require token definition
- unsupported values such as radius values when no radius token rule is configured

Example:

```bash
token-validator scan samples/before/ProductCard.tsx --tokens tokens.ts
token-validator scan samples/before/SettingsPanel.tsx --tokens tokens.ts
token-validator scan samples/before/PromoBanner.tsx --tokens tokens.ts
```

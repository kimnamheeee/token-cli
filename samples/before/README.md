# Before samples

These files represent a more realistic pre-adoption codebase.

- `ProductCard.tsx`: product shelf / commerce card UI
- `SettingsPanel.tsx`: account settings section
- `PromoBanner.tsx`: marketing banner / announcement block
- `OrderSummary.tsx`: checkout sidebar / order recap block
- `../tokens/storefront.tokens.ts`: realistic primitive / semantic / component token definition used as the comparison source

They intentionally contain:

- deterministic values that map to one token
- ambiguous values shared by primitive / semantic / component layers
- no-candidate values that require token definition
- product-specific values that are not yet covered by the current token set

Example:

```bash
token-validator scan samples/before/ProductCard.tsx --tokens samples/tokens/storefront.tokens.ts
token-validator scan samples/before/SettingsPanel.tsx --tokens samples/tokens/storefront.tokens.ts
token-validator scan samples/before/PromoBanner.tsx --tokens samples/tokens/storefront.tokens.ts
token-validator scan samples/before/OrderSummary.tsx --tokens samples/tokens/storefront.tokens.ts
```

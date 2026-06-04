import type {
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  LoadedTokens,
  TokenRecord,
} from '../types/index.js';

export function findExactMatchingTokens(
  detectedValue: DetectedHardcodedValue,
  tokens: LoadedTokens,
): TokenRecord[] {
  const candidates = tokens.recordsByNormalizedValue.get(
    detectedValue.normalizedValue,
  );

  if (!candidates) {
    return [];
  }

  return candidates.filter(
    (candidate) => candidate.type === detectedValue.tokenGroup,
  );
}

export function matchTokens(
  detectedValues: DetectedHardcodedValue[],
  tokens: LoadedTokens,
): DeterministicTokenMatch[] {
  const matches: DeterministicTokenMatch[] = [];

  for (const detectedValue of detectedValues) {
    const exactMatches = findExactMatchingTokens(detectedValue, tokens);

    if (exactMatches.length !== 1) {
      continue;
    }

    const [exactMatch] = exactMatches;

    if (!exactMatch) {
      continue;
    }

    matches.push({
      ...detectedValue,
      case: 'deterministic',
      suggestion: exactMatch.id,
      reason: 'single exact token candidate was found',
    });
  }

  return matches;
}

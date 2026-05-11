import type {
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  FlattenedToken,
  LoadedTokens,
} from '../types/index.js';

export function findExactMatchingTokens(
  detectedValue: DetectedHardcodedValue,
  tokens: LoadedTokens,
): FlattenedToken[] {
  const candidates = tokens.entriesByNormalizedValue.get(
    detectedValue.normalizedValue,
  );

  if (!candidates) {
    return [];
  }

  return candidates.filter((candidate) => candidate.group === detectedValue.tokenGroup);
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
      suggestion: exactMatch.path,
    });
  }

  return matches;
}

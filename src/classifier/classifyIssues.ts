import { findExactMatchingTokens } from '../matcher/matchTokens.js';
import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  LoadedTokens,
} from '../types/index.js';

function toDeterministicMatch(
  detectedValue: DetectedHardcodedValue,
  suggestion: string,
): DeterministicTokenMatch {
  return {
    ...detectedValue,
    case: 'deterministic',
    suggestion,
  };
}

function toAmbiguousMatch(
  detectedValue: DetectedHardcodedValue,
  candidates: string[],
): AmbiguousTokenMatch {
  return {
    ...detectedValue,
    case: 'ambiguous',
    candidates,
  };
}

export function classifyIssues(
  detectedValues: DetectedHardcodedValue[],
  tokens: LoadedTokens,
): ClassifiedIssueSets {
  const deterministic: DeterministicTokenMatch[] = [];
  const ambiguous: AmbiguousTokenMatch[] = [];
  const unresolved: DetectedHardcodedValue[] = [];

  for (const detectedValue of detectedValues) {
    const exactMatches = findExactMatchingTokens(detectedValue, tokens);

    if (exactMatches.length === 1) {
      const [exactMatch] = exactMatches;

      if (exactMatch) {
        deterministic.push(
          toDeterministicMatch(detectedValue, exactMatch.path),
        );
      }

      continue;
    }

    if (exactMatches.length > 1) {
      ambiguous.push(
        toAmbiguousMatch(
          detectedValue,
          exactMatches.map((exactMatch) => exactMatch.path),
        ),
      );
      continue;
    }

    unresolved.push(detectedValue);
  }

  return {
    deterministic,
    ambiguous,
    unresolved,
  };
}

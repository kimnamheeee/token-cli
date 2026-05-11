import { findExactMatchingTokens } from '../matcher/matchTokens.js';
import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  LoadedTokens,
  NoCandidateMatch,
  UnsupportedMatch,
} from '../types/index.js';

function toDeterministicMatch(
  detectedValue: DetectedHardcodedValue,
  suggestion: string,
): DeterministicTokenMatch {
  return {
    ...detectedValue,
    case: 'deterministic',
    suggestion,
    reason: 'exactly one matching token was found',
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
    reason: 'same raw value is used by multiple tokens',
  };
}

function toNoCandidateMatch(
  detectedValue: DetectedHardcodedValue,
): NoCandidateMatch {
  return {
    ...detectedValue,
    case: 'no-candidate',
    reason: 'no token with the same normalized value was found',
  };
}

function toUnsupportedMatch(
  detectedValue: DetectedHardcodedValue,
): UnsupportedMatch {
  return {
    ...detectedValue,
    case: 'unsupported',
    reason: `${detectedValue.tokenGroup} token category is not configured`,
  };
}

export function classifyIssues(
  detectedValues: DetectedHardcodedValue[],
  tokens: LoadedTokens,
): ClassifiedIssueSets {
  const deterministic: DeterministicTokenMatch[] = [];
  const ambiguous: AmbiguousTokenMatch[] = [];
  const noCandidate: NoCandidateMatch[] = [];
  const unsupported: UnsupportedMatch[] = [];

  for (const detectedValue of detectedValues) {
    const hasTokenCategory = tokens.entries.some(
      (entry) => entry.group === detectedValue.tokenGroup,
    );

    if (!hasTokenCategory) {
      unsupported.push(toUnsupportedMatch(detectedValue));
      continue;
    }

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

    noCandidate.push(toNoCandidateMatch(detectedValue));
  }

  return {
    deterministic,
    ambiguous,
    noCandidate,
    unsupported,
  };
}

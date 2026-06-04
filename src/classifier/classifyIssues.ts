import { findExactMatchingTokens } from '../matcher/matchTokens.js';
import { rankTokenCandidates } from '../matcher/rankTokenCandidates.js';
import type {
  AmbiguousTokenMatch,
  ClassifiedIssueSets,
  DetectedHardcodedValue,
  DeterministicTokenMatch,
  LoadedTokens,
  NoCandidateMatch,
  TokenRecord,
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
    reason: 'single exact token candidate was found',
  };
}

function toAmbiguousMatch(
  detectedValue: DetectedHardcodedValue,
  exactMatches: TokenRecord[],
): AmbiguousTokenMatch {
  return {
    ...detectedValue,
    case: 'ambiguous',
    candidates: exactMatches.map((exactMatch) => exactMatch.id),
    rankedCandidates: rankTokenCandidates(detectedValue, exactMatches),
    reason: 'multiple token candidates were found',
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
    const hasTokenCategory = tokens.records.some(
      (record) => record.type === detectedValue.tokenGroup,
    );

    if (!hasTokenCategory) {
      unsupported.push(toUnsupportedMatch(detectedValue));
      continue;
    }

    const exactMatches = findExactMatchingTokens(detectedValue, tokens);
    const deterministicCandidate =
      exactMatches.length === 1 ? (exactMatches[0] ?? null) : null;

    if (deterministicCandidate) {
      deterministic.push(
        toDeterministicMatch(detectedValue, deterministicCandidate.id),
      );
      continue;
    }

    if (exactMatches.length > 1) {
      ambiguous.push(toAmbiguousMatch(detectedValue, exactMatches));
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

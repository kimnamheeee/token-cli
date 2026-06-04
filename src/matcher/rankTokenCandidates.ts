import path from 'node:path';

import type {
  DetectedHardcodedValue,
  RankedTokenCandidate,
  TokenLayer,
  TokenRecord,
} from '../types/index.js';

const LAYER_TIE_BREAKER: Record<TokenLayer, number> = {
  semantic: 0,
  component: 1,
  primitive: 2,
  unknown: 3,
};

function normalizeWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);
}

function getCandidateWords(candidate: TokenRecord): Set<string> {
  const metadataWords = Object.values(candidate.metadata ?? {})
    .filter((value): value is string => typeof value === 'string')
    .flatMap(normalizeWords);

  return new Set([...candidate.path.flatMap(normalizeWords), ...metadataWords]);
}

function getRoleKeywords(property: string): string[] {
  const propertyWords = normalizeWords(property);
  const lowerProperty = property.toLowerCase();

  if (lowerProperty === 'color') {
    return ['text', 'content', 'foreground', 'fg'];
  }

  if (lowerProperty === 'backgroundcolor') {
    return ['surface', 'background', 'bg'];
  }

  if (propertyWords.includes('border') && propertyWords.includes('color')) {
    return ['border', 'stroke', 'outline'];
  }

  if (lowerProperty.includes('radius')) {
    return ['radius', 'corner', 'surface', 'control'];
  }

  if (lowerProperty.startsWith('padding')) {
    return ['inset', 'padding', 'space'];
  }

  if (
    propertyWords.includes('gap') ||
    lowerProperty.startsWith('margin') ||
    lowerProperty.endsWith('gap')
  ) {
    return ['stack', 'gap', 'space'];
  }

  return [];
}

function getComponentName(candidate: TokenRecord): string | null {
  const metadataComponent = candidate.metadata?.component;

  if (typeof metadataComponent === 'string') {
    return metadataComponent;
  }

  if (candidate.level === 'component') {
    return candidate.path[1] ?? null;
  }

  return null;
}

function hasMatchingComponentContext(
  detectedValue: DetectedHardcodedValue,
  candidate: TokenRecord,
): boolean {
  const componentName = getComponentName(candidate);

  if (!componentName) {
    return false;
  }

  const fileBaseName = path.basename(
    detectedValue.filePath,
    path.extname(detectedValue.filePath),
  );
  const fileWords = normalizeWords(fileBaseName);
  const componentWords = normalizeWords(componentName);

  return componentWords.some((word) => fileWords.includes(word));
}

function isUnrelatedComponentToken(
  detectedValue: DetectedHardcodedValue,
  candidate: TokenRecord,
): boolean {
  return (
    candidate.level === 'component' &&
    !hasMatchingComponentContext(detectedValue, candidate)
  );
}

function scoreCandidate(
  detectedValue: DetectedHardcodedValue,
  candidate: TokenRecord,
): RankedTokenCandidate {
  let score = 0;
  const reasons: string[] = [];
  const candidateWords = getCandidateWords(candidate);
  const matchedRoleKeywords = getRoleKeywords(detectedValue.property).filter(
    (keyword) => candidateWords.has(keyword),
  );

  if (matchedRoleKeywords.length > 0) {
    score += 30;
    reasons.push(
      `matches ${detectedValue.property} role keyword: ${matchedRoleKeywords.join(', ')}`,
    );
  }

  if (candidate.level === 'semantic') {
    score += 10;
    reasons.push('semantic token is preferred over raw primitive tokens');
  }

  if (candidate.level === 'primitive') {
    reasons.push('primitive token is treated as a fallback candidate');
  }

  if (
    candidate.level === 'component' &&
    hasMatchingComponentContext(detectedValue, candidate)
  ) {
    score += 18;
    reasons.push('component token matches the file context');
  }

  if (isUnrelatedComponentToken(detectedValue, candidate)) {
    score -= 10;
    reasons.push('component token does not match the file context');
  }

  if (
    candidate.aliasOf &&
    candidate.level !== 'primitive' &&
    !isUnrelatedComponentToken(detectedValue, candidate)
  ) {
    score += 5;
    reasons.push(
      'token aliases another token instead of using a raw primitive value',
    );
  }

  if (reasons.length === 0) {
    reasons.push('exact value match');
  }

  return {
    id: candidate.id,
    score,
    reasons,
  };
}

export function rankTokenCandidates(
  detectedValue: DetectedHardcodedValue,
  candidates: TokenRecord[],
): RankedTokenCandidate[] {
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  return candidates
    .map((candidate) => scoreCandidate(detectedValue, candidate))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      const leftCandidate = candidatesById.get(left.id);
      const rightCandidate = candidatesById.get(right.id);
      const leftLayerRank = leftCandidate
        ? LAYER_TIE_BREAKER[leftCandidate.level]
        : LAYER_TIE_BREAKER.unknown;
      const rightLayerRank = rightCandidate
        ? LAYER_TIE_BREAKER[rightCandidate.level]
        : LAYER_TIE_BREAKER.unknown;

      if (leftLayerRank !== rightLayerRank) {
        return leftLayerRank - rightLayerRank;
      }

      return left.id.localeCompare(right.id);
    });
}

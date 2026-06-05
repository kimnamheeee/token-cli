import type {
  DetectedHardcodedValue,
  RankedTokenCandidate,
  TokenRecord,
} from '../types/index.js';

interface NearbyCandidate {
  candidate: TokenRecord;
  distance: number;
  reason: string;
}

function parseNumericValue(value: string): number | null {
  const parsedValue = Number.parseFloat(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function expandHexColor(value: string): string | null {
  const normalizedValue = value.trim().toLowerCase();

  if (/^#[0-9a-f]{3}$/.test(normalizedValue)) {
    const [, red, green, blue] = normalizedValue;

    if (!red || !green || !blue) {
      return null;
    }

    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  if (/^#[0-9a-f]{6}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return null;
}

function parseHexColor(
  value: string,
): { red: number; green: number; blue: number } | null {
  const expandedValue = expandHexColor(value);

  if (!expandedValue) {
    return null;
  }

  return {
    red: Number.parseInt(expandedValue.slice(1, 3), 16),
    green: Number.parseInt(expandedValue.slice(3, 5), 16),
    blue: Number.parseInt(expandedValue.slice(5, 7), 16),
  };
}

function getRgbDistance(leftValue: string, rightValue: string): number | null {
  const left = parseHexColor(leftValue);
  const right = parseHexColor(rightValue);

  if (!left || !right) {
    return null;
  }

  return Math.sqrt(
    (left.red - right.red) ** 2 +
      (left.green - right.green) ** 2 +
      (left.blue - right.blue) ** 2,
  );
}

function toNearbyCandidate(
  detectedValue: DetectedHardcodedValue,
  candidate: TokenRecord,
): NearbyCandidate | null {
  if (
    detectedValue.tokenGroup === 'spacing' ||
    detectedValue.tokenGroup === 'radius'
  ) {
    const detectedNumericValue = parseNumericValue(
      detectedValue.normalizedValue,
    );
    const candidateNumericValue = parseNumericValue(
      candidate.normalizedResolvedValue,
    );

    if (detectedNumericValue === null || candidateNumericValue === null) {
      return null;
    }

    const distance = Math.abs(detectedNumericValue - candidateNumericValue);

    if (distance === 0) {
      return null;
    }

    return {
      candidate,
      distance,
      reason: `${detectedValue.tokenGroup} scale is ${distance} away from ${candidate.normalizedResolvedValue}`,
    };
  }

  if (detectedValue.tokenGroup === 'color') {
    const distance = getRgbDistance(
      detectedValue.normalizedValue,
      candidate.normalizedResolvedValue,
    );

    if (distance === null || distance === 0) {
      return null;
    }

    return {
      candidate,
      distance,
      reason: `hex color is ${Math.round(distance)} RGB units away from ${candidate.normalizedResolvedValue}`,
    };
  }

  return null;
}

function getNearbyScore(distance: number): number {
  return Math.max(0, Math.round(100 - distance));
}

export function findNearbyTokenCandidates(
  detectedValue: DetectedHardcodedValue,
  candidates: TokenRecord[],
  limit = 3,
): RankedTokenCandidate[] {
  return candidates
    .filter((candidate) => candidate.type === detectedValue.tokenGroup)
    .map((candidate) => toNearbyCandidate(detectedValue, candidate))
    .filter((candidate): candidate is NearbyCandidate => candidate !== null)
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .slice(0, limit)
    .map(({ candidate, distance, reason }) => ({
      id: candidate.id,
      score: getNearbyScore(distance),
      reasons: [reason, 'nearby candidate only; not an exact replacement'],
    }));
}

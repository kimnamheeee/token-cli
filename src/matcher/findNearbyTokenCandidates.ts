import type {
  DetectedHardcodedValue,
  RankedTokenCandidate,
  TokenRecord,
} from '../types/index.js';

interface NearbyCandidate {
  candidate: TokenRecord;
  distance: number;
  kind: NonNullable<RankedTokenCandidate['kind']>;
  reason: string;
  scaleStepsAway?: number;
  scaleDistanceRatio?: number;
  score: number;
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

function srgbToLinear(value: number): number {
  const normalized = value / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function pivotXyz(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function rgbToLab({
  red,
  green,
  blue,
}: {
  red: number;
  green: number;
  blue: number;
}): { lightness: number; a: number; b: number } {
  const linearRed = srgbToLinear(red);
  const linearGreen = srgbToLinear(green);
  const linearBlue = srgbToLinear(blue);
  const x = (0.4124 * linearRed + 0.3576 * linearGreen + 0.1805 * linearBlue) / 0.95047;
  const y = 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
  const z = (0.0193 * linearRed + 0.1192 * linearGreen + 0.9505 * linearBlue) / 1.08883;
  const fx = pivotXyz(x);
  const fy = pivotXyz(y);
  const fz = pivotXyz(z);

  return {
    lightness: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function getDeltaEDistance(leftValue: string, rightValue: string): number | null {
  const leftColor = parseHexColor(leftValue);
  const rightColor = parseHexColor(rightValue);

  if (!leftColor || !rightColor) {
    return null;
  }

  const left = rgbToLab(leftColor);
  const right = rgbToLab(rightColor);

  return Math.sqrt(
    (left.lightness - right.lightness) ** 2 +
      (left.a - right.a) ** 2 +
      (left.b - right.b) ** 2,
  );
}

function getScaleStepsAway(
  detectedValue: number,
  candidateValue: number,
  scaleValues: number[],
): number {
  return (
    scaleValues.filter((value) => {
      const lower = Math.min(detectedValue, candidateValue);
      const upper = Math.max(detectedValue, candidateValue);

      return value > lower && value < upper;
    }).length + 1
  );
}

function getScaleIntervalWidth(
  candidateValue: number,
  detectedValue: number,
  scaleValues: number[],
): number {
  const candidateIndex = scaleValues.indexOf(candidateValue);

  if (candidateIndex === -1) {
    return Math.abs(candidateValue - detectedValue);
  }

  const neighbor =
    candidateValue < detectedValue
      ? scaleValues[candidateIndex + 1]
      : scaleValues[candidateIndex - 1];
  const fallbackNeighbor =
    candidateValue < detectedValue
      ? scaleValues[candidateIndex - 1]
      : scaleValues[candidateIndex + 1];
  const intervalNeighbor = neighbor ?? fallbackNeighbor;

  if (intervalNeighbor === undefined) {
    return Math.abs(candidateValue - detectedValue);
  }

  return Math.abs(candidateValue - intervalNeighbor);
}

function getScaleDistanceRatio(
  detectedValue: number,
  candidateValue: number,
  scaleValues: number[],
): number {
  const distance = Math.abs(detectedValue - candidateValue);
  const intervalWidth = getScaleIntervalWidth(
    candidateValue,
    detectedValue,
    scaleValues,
  );

  if (intervalWidth === 0) {
    return distance;
  }

  return distance / intervalWidth;
}

function getScaleAwareScore(
  scaleStepsAway: number,
  scaleDistanceRatio: number,
): number {
  return Math.max(
    0,
    Math.round(100 - (scaleStepsAway - 1) * 15 - scaleDistanceRatio * 40),
  );
}

function toNearbyCandidate(
  detectedValue: DetectedHardcodedValue,
  candidate: TokenRecord,
  scaleValues: number[],
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

    const scaleStepsAway = getScaleStepsAway(
      detectedNumericValue,
      candidateNumericValue,
      scaleValues,
    );
    const scaleDistanceRatio = getScaleDistanceRatio(
      detectedNumericValue,
      candidateNumericValue,
      scaleValues,
    );

    return {
      candidate,
      distance,
      kind: scaleStepsAway === 1 ? 'adjacent-scale-value' : 'numeric-nearby',
      scaleStepsAway,
      scaleDistanceRatio,
      score: getScaleAwareScore(scaleStepsAway, scaleDistanceRatio),
      reason:
        scaleStepsAway === 1
          ? `${detectedValue.tokenGroup} scale is adjacent to ${candidate.normalizedResolvedValue} (${Number(scaleDistanceRatio.toFixed(2))} of the scale interval away)`
          : `${detectedValue.tokenGroup} scale is ${scaleStepsAway} steps and ${Number(scaleDistanceRatio.toFixed(2))} scale intervals away from ${candidate.normalizedResolvedValue}`,
    };
  }

  if (detectedValue.tokenGroup === 'color') {
    const distance = getDeltaEDistance(
      detectedValue.normalizedValue,
      candidate.normalizedResolvedValue,
    );

    if (distance === null || distance === 0) {
      return null;
    }

    return {
      candidate,
      distance,
      kind: 'perceptual-color-nearby',
      score: getNearbyScore(distance),
      reason: `hex color is ${Number(distance.toFixed(2))} Delta E units away from ${candidate.normalizedResolvedValue}`,
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
  const sameTypeCandidates = candidates.filter(
    (candidate) => candidate.type === detectedValue.tokenGroup,
  );
  const scaleValues = [
    ...new Set(
      sameTypeCandidates
        .map((candidate) => parseNumericValue(candidate.normalizedResolvedValue))
        .filter((value): value is number => value !== null),
    ),
  ].sort((left, right) => left - right);

  return sameTypeCandidates
    .map((candidate) => toNearbyCandidate(detectedValue, candidate, scaleValues))
    .filter((candidate): candidate is NearbyCandidate => candidate !== null)
    .sort((left, right) => {
      const leftSteps = left.scaleStepsAway ?? Number.POSITIVE_INFINITY;
      const rightSteps = right.scaleStepsAway ?? Number.POSITIVE_INFINITY;

      if (leftSteps !== rightSteps) {
        return leftSteps - rightSteps;
      }

      const leftRatio = left.scaleDistanceRatio ?? Number.POSITIVE_INFINITY;
      const rightRatio = right.scaleDistanceRatio ?? Number.POSITIVE_INFINITY;

      if (leftRatio !== rightRatio) {
        return leftRatio - rightRatio;
      }

      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .slice(0, limit)
    .map(
      ({
        candidate,
        distance,
        kind,
        reason,
        scaleStepsAway,
        scaleDistanceRatio,
        score,
      }) => ({
      id: candidate.id,
      score,
      kind,
      reviewOnly: true,
      distance,
      ...(scaleStepsAway === undefined ? {} : { scaleStepsAway }),
      ...(scaleDistanceRatio === undefined
        ? {}
        : { scaleDistanceRatio: Number(scaleDistanceRatio.toFixed(4)) }),
      reasons: [reason, 'nearby candidate only; not an exact replacement'],
      }),
    );
}

import type {
  InlineStyleDeclaration,
  SupportedTokenGroup,
} from '../types/index.js';

const HEX_COLOR_PATTERN =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*[-\d.%\s,]+\)$/i;
const HSL_COLOR_PATTERN =
  /^hsla?\(\s*[-\d.%\s,]+\)$/i;
const SPACING_UNIT_PATTERN =
  /^-?(?:\d+|\d*\.\d+)(px|rem|em|%)$/i;
const NUMBER_PATTERN =
  /^-?(?:\d+|\d*\.\d+)$/;

const COLOR_PROPERTIES = new Set([
  'accentColor',
  'backgroundColor',
  'borderBlockColor',
  'borderBlockEndColor',
  'borderBlockStartColor',
  'borderBottomColor',
  'borderColor',
  'borderInlineColor',
  'borderInlineEndColor',
  'borderInlineStartColor',
  'borderLeftColor',
  'borderRightColor',
  'borderTopColor',
  'caretColor',
  'color',
  'columnRuleColor',
  'fill',
  'outlineColor',
  'stroke',
  'textDecorationColor',
]);

const RADIUS_PROPERTIES = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
]);

const SPACING_PROPERTIES = new Set([
  'bottom',
  'columnGap',
  'gap',
  'inset',
  'insetBlock',
  'insetBlockEnd',
  'insetBlockStart',
  'insetInline',
  'insetInlineEnd',
  'insetInlineStart',
  'left',
  'margin',
  'marginBlock',
  'marginBlockEnd',
  'marginBlockStart',
  'marginBottom',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginLeft',
  'marginRight',
  'marginTop',
  'padding',
  'paddingBlock',
  'paddingBlockEnd',
  'paddingBlockStart',
  'paddingBottom',
  'paddingHorizontal',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingVertical',
  'right',
  'rowGap',
  'top',
  'marginHorizontal',
  'marginVertical',
]);

function normalizeRawValue(value: string): string {
  return value.trim().toLowerCase();
}

export function isSupportedColorProperty(property: string): boolean {
  return COLOR_PROPERTIES.has(property);
}

export function isSupportedSpacingProperty(property: string): boolean {
  return SPACING_PROPERTIES.has(property);
}

export function isSupportedRadiusProperty(property: string): boolean {
  return RADIUS_PROPERTIES.has(property);
}

export function getSupportedTokenGroup(
  property: string,
): SupportedTokenGroup | null {
  if (isSupportedColorProperty(property)) {
    return 'color';
  }

  if (isSupportedRadiusProperty(property)) {
    return 'radius';
  }

  if (isSupportedSpacingProperty(property)) {
    return 'spacing';
  }

  return null;
}

export function parseColorValue(rawValue: string): string | null {
  const normalizedValue = normalizeRawValue(rawValue);

  if (
    HEX_COLOR_PATTERN.test(normalizedValue)
    || RGB_COLOR_PATTERN.test(normalizedValue)
    || HSL_COLOR_PATTERN.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  return null;
}

export function parseSpacingValue(
  rawValue: string,
  valueType: InlineStyleDeclaration['valueType'],
): string | null {
  const normalizedValue = normalizeRawValue(rawValue);

  if (valueType === 'number') {
    return NUMBER_PATTERN.test(normalizedValue) ? normalizedValue : null;
  }

  if (
    NUMBER_PATTERN.test(normalizedValue)
    || SPACING_UNIT_PATTERN.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  return null;
}

export function parseDeclarationValue(
  declaration: InlineStyleDeclaration,
): { tokenGroup: SupportedTokenGroup; normalizedValue: string } | null {
  const tokenGroup = getSupportedTokenGroup(declaration.property);

  if (!tokenGroup) {
    return null;
  }

  const normalizedValue = tokenGroup === 'color'
    ? parseColorValue(declaration.rawValue)
    : parseSpacingValue(declaration.rawValue, declaration.valueType);

  if (!normalizedValue) {
    return null;
  }

  return {
    tokenGroup,
    normalizedValue,
  };
}

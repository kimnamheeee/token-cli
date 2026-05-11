export type TokenValue = string | number;
export type TokenResolvedValue = TokenValue | Record<string, TokenValue>;

export type TokenNode = {
  [key: string]: TokenNode | TokenValue;
};

export type TokenLayer = 'primitive' | 'semantic' | 'component' | 'unknown';
export type TokenType =
  | 'color'
  | 'spacing'
  | 'radius'
  | 'typography'
  | 'shadow'
  | 'unknown';

export interface TokenRecord {
  id: string;
  path: string[];
  rawValue: unknown;
  resolvedValue: TokenResolvedValue;
  normalizedResolvedValue: string;
  type: TokenType;
  level: TokenLayer;
  source: string;
  aliasOf?: string;
  metadata?: Record<string, unknown>;
}

export interface FlattenedToken {
  path: string;
  value: TokenValue;
  normalizedValue: string;
  segments: string[];
  group: string;
  layer: TokenLayer;
  source: string;
  rawValue?: unknown;
  aliasOf?: string;
  metadata?: Record<string, unknown>;
}

export interface LoadedTokens {
  sourcePath: string;
  tree: TokenNode;
  records: TokenRecord[];
  recordsById: Map<string, TokenRecord>;
  recordsByNormalizedValue: Map<string, TokenRecord[]>;
  entries: FlattenedToken[];
  entriesByPath: Map<string, FlattenedToken>;
  entriesByNormalizedValue: Map<string, FlattenedToken[]>;
}

export interface InlineStyleDeclaration {
  property: string;
  rawValue: string;
  valueType: 'string' | 'number';
  line: number;
  column: number;
}

export interface InlineStyleBlock {
  filePath: string;
  line: number;
  column: number;
  declarations: InlineStyleDeclaration[];
}

export type SupportedTokenGroup = 'color' | 'spacing' | 'radius';

export interface DetectedHardcodedValue {
  filePath: string;
  line: number;
  column: number;
  property: string;
  rawValue: string;
  normalizedValue: string;
  valueType: 'string' | 'number';
  tokenGroup: SupportedTokenGroup;
}

export interface DeterministicTokenMatch extends DetectedHardcodedValue {
  case: 'deterministic';
  suggestion: string;
  reason: string;
}

export interface AmbiguousTokenMatch extends DetectedHardcodedValue {
  case: 'ambiguous';
  candidates: string[];
  reason: string;
}

export interface NoCandidateMatch extends DetectedHardcodedValue {
  case: 'no-candidate';
  reason: string;
}

export interface UnsupportedMatch extends DetectedHardcodedValue {
  case: 'unsupported';
  reason: string;
}

export interface ClassifiedIssueSets {
  deterministic: DeterministicTokenMatch[];
  ambiguous: AmbiguousTokenMatch[];
  noCandidate: NoCandidateMatch[];
  unsupported: UnsupportedMatch[];
}

export type TokenValue = string;

export type TokenNode = {
  [key: string]: TokenNode | TokenValue;
};

export interface FlattenedToken {
  path: string;
  value: TokenValue;
  normalizedValue: string;
  segments: string[];
  group: string;
}

export interface LoadedTokens {
  sourcePath: string;
  tree: TokenNode;
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

export type SupportedTokenGroup = 'color' | 'spacing';

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
}

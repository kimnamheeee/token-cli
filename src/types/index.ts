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

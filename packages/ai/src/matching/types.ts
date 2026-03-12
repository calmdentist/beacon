import type { MatchType } from '@beacon/core';

export interface MatchCandidate {
  beaconId: string;
  semanticSimilarity: number;
  tagOverlap: number;
  helpComplementarity: number;
  recencyBonus: number;
  createdAt: string;
  title: string;
  summary: string;
}

export interface ScoredMatch {
  beaconId: string;
  score: number;
  matchType: MatchType;
  reason: string;
}

export interface MatchWeights {
  semantic: number;
  tag: number;
  help: number;
  recency: number;
}

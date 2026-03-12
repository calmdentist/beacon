import type { MatchType } from '@beacon/core';

import type { MatchCandidate, MatchWeights, ScoredMatch } from './types';

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  semantic: 0.65,
  tag: 0.15,
  help: 0.15,
  recency: 0.05
};

export interface ScoreCandidatesOptions {
  limit?: number;
}

export function computeMatchScore(candidate: MatchCandidate, weights = DEFAULT_MATCH_WEIGHTS): number {
  const raw =
    weights.semantic * candidate.semanticSimilarity +
    weights.tag * candidate.tagOverlap +
    weights.help * candidate.helpComplementarity +
    weights.recency * candidate.recencyBonus;

  return clamp(raw, 0, 1);
}

export function labelMatchType(candidate: MatchCandidate): MatchType {
  if (candidate.semanticSimilarity > 0.8 && candidate.tagOverlap > 0.4) {
    return 'same_topic';
  }

  if (candidate.helpComplementarity > 0.6) {
    return 'can_help';
  }

  return 'adjacent_angle';
}

export function explainMatch(candidate: MatchCandidate, matchType: MatchType): string {
  if (matchType === 'same_topic') {
    return 'Exploring a highly similar topic with strong concept overlap.';
  }

  if (matchType === 'can_help') {
    return 'Likely to help based on complementarity between their exploration and your help request.';
  }

  return 'Approaches a related problem from an adjacent angle that may unlock progress.';
}

export function scoreCandidates(
  candidates: MatchCandidate[],
  options: ScoreCandidatesOptions = {}
): ScoredMatch[] {
  const limit = clampInt(options.limit ?? 5, 1, 20);

  return candidates
    .map((candidate) => {
      const matchType = labelMatchType(candidate);
      return {
        beaconId: candidate.beaconId,
        score: computeMatchScore(candidate),
        matchType,
        reason: explainMatch(candidate, matchType)
      } satisfies ScoredMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

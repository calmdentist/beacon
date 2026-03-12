import { z } from 'zod';

export const matchTypeSchema = z.enum(['same_topic', 'adjacent_angle', 'can_help']);
export type MatchType = z.infer<typeof matchTypeSchema>;

export const matchStatusSchema = z.enum([
  'suggested',
  'dismissed',
  'intro_requested',
  'accepted'
]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchSchema = z.object({
  id: z.string(),
  beaconId: z.string(),
  matchedBeaconId: z.string(),
  matchType: matchTypeSchema,
  score: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
  status: matchStatusSchema,
  createdAt: z.string().datetime()
});

export type Match = z.infer<typeof matchSchema>;

export const relatedBeaconResponseSchema = z.array(
  z.object({
    beaconId: z.string(),
    matchType: matchTypeSchema,
    score: z.number().min(0).max(1),
    reason: z.string().min(1).max(500)
  })
);

export type RelatedBeaconResponse = z.infer<typeof relatedBeaconResponseSchema>;

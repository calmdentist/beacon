import { z } from 'zod';

export const beaconStatusSchema = z.enum(['draft', 'saved', 'archived']);
export type BeaconStatus = z.infer<typeof beaconStatusSchema>;

export const sourceTypeSchema = z.enum(['manual', 'mcp']);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const beaconSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  exploring: z.string().min(1).max(2000),
  helpWanted: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(20),
  sourceLlm: z.string().min(1).max(64).optional(),
  sourceType: sourceTypeSchema,
  status: beaconStatusSchema,
  isMatchable: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Beacon = z.infer<typeof beaconSchema>;

export const createBeaconInputSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  exploring: z.string().min(1).max(2000),
  helpWanted: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(20),
  sourceLlm: z.string().min(1).max(64).optional(),
  sourceType: sourceTypeSchema.default('manual'),
  status: beaconStatusSchema.default('saved'),
  isMatchable: z.boolean().default(false)
});

export type CreateBeaconInput = z.infer<typeof createBeaconInputSchema>;

export const updateBeaconInputSchema = createBeaconInputSchema.partial();
export type UpdateBeaconInput = z.infer<typeof updateBeaconInputSchema>;

export const beaconDraftFromContextInputSchema = z.object({
  title: z.string().max(160).optional(),
  summary: z.string().max(1200).optional(),
  conversationContext: z.string().min(1),
  sourceLlm: z.string().min(1).max(64).optional()
});

export type BeaconDraftFromContextInput = z.infer<typeof beaconDraftFromContextInputSchema>;

export const beaconDraftSchema = z.object({
  draftId: z.string(),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  exploring: z.string().min(1).max(2000),
  helpWanted: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(20),
  suggestedMatchable: z.boolean(),
  reviewUrl: z.string().url()
});

export type BeaconDraft = z.infer<typeof beaconDraftSchema>;

import { z } from 'zod';

import {
  beaconDraftSchema,
  beaconSchema,
  createBeaconInputSchema,
  updateBeaconInputSchema
} from '../beacon/types';
import { createIntroRequestInputSchema, introRequestSchema } from '../intro/types';
import { relatedBeaconResponseSchema } from '../match/types';

export const createBeaconRequestSchema = createBeaconInputSchema;
export const createBeaconResponseSchema = beaconSchema;

export const updateBeaconRequestSchema = updateBeaconInputSchema;
export const updateBeaconResponseSchema = beaconSchema;

export const relatedBeaconsResponseSchema = relatedBeaconResponseSchema;

export const createIntroRequestSchema = createIntroRequestInputSchema;
export const createIntroResponseSchema = introRequestSchema;

export const mcpCreateDraftRequestSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  conversationContext: z.string().min(1),
  sourceLlm: z.string().optional()
});

export const mcpCreateDraftResponseSchema = beaconDraftSchema;

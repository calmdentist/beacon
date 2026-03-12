import { z } from 'zod';

export const introRequestStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired'
]);

export type IntroRequestStatus = z.infer<typeof introRequestStatusSchema>;

export const introRequestSchema = z.object({
  id: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  fromBeaconId: z.string(),
  toBeaconId: z.string(),
  status: introRequestStatusSchema,
  createdAt: z.string().datetime()
});

export type IntroRequest = z.infer<typeof introRequestSchema>;

export const createIntroRequestInputSchema = z.object({
  toUserId: z.string(),
  fromBeaconId: z.string(),
  toBeaconId: z.string()
});

export type CreateIntroRequestInput = z.infer<typeof createIntroRequestInputSchema>;

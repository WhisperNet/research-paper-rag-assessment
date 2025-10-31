import { z } from 'zod';

export const querySchema = z.object({
  question: z.string().min(1).max(1000).trim(),
  top_k: z.number().int().min(1).max(10).optional(),
  paper_ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).optional(),
});

export const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/, 'Invalid ObjectId format');

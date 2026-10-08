import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const sessionSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.literal("owner") }),
  expiresAt: z.iso.datetime(),
});
export const loginResponseSchema = sessionSchema.extend({
  token: z.string().regex(/^nh1_[a-f0-9]{64}$/),
});
export type OwnerSession = z.infer<typeof sessionSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

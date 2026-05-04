import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'client', 'bidder']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema,
  createdAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

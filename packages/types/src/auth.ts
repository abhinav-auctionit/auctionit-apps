import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(255).trim(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'client', 'bidder']),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(255).trim(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'client', 'bidder']),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

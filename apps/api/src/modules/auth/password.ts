import { hash, verify } from '@node-rs/argon2';

const opts = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashPassword = (plain: string) => hash(plain, opts);
export const verifyPassword = (stored: string, plain: string) => verify(stored, plain);

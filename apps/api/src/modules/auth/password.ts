import { createHash, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { PasswordHashAlgo } from '@prisma/client';

const opts = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashPassword = (plain: string) => hash(plain, opts);

export const verifyArgon2 = (stored: string, plain: string) => verify(stored, plain);

// Matches the legacy C# routine: MD5 over ASCII bytes, lowercase hex.
export function md5Hex(plain: string): string {
  return createHash('md5').update(plain, 'ascii').digest('hex');
}

export function verifyMd5(stored: string, plain: string): boolean {
  const computed = md5Hex(plain);
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(computed));
}

export async function verifyPassword(
  stored: string,
  plain: string,
  algo: PasswordHashAlgo,
): Promise<boolean> {
  if (algo === 'md5') return verifyMd5(stored, plain);
  return verifyArgon2(stored, plain);
}

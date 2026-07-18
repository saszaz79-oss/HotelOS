import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a temporary password for a newly-created account or an
 * admin-triggered reset (Constitution: "first login must require changing
 * the temporary password"). Base64url of random bytes — never a
 * predictable pattern, never derived from the username/hotel name.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url'); // 16 chars, ~96 bits of entropy
}

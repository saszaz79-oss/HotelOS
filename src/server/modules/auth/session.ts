import { randomBytes } from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { timed } from '@/lib/perf-trace'; // TEMPORARY (production incident diagnostic)

const SESSION_COOKIE = 'hotelos_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: token, userId, expiresAt },
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: token } });
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Re-derives the current user from the session cookie against the database
 * on every call — authorization is never trusted from client-supplied state
 * (Architecture §5, Constitution §5).
 *
 * Wrapped in React's `cache()` (request-scoped memoization, not a
 * cross-request cache — a fresh request always gets a fresh call) because
 * both a layout and its page routinely call this independently with no way
 * to share the result via props; before this, every request re-ran the
 * session lookup query once per layout/page pair (M7 performance audit).
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await timed('getCurrentUser.sessionLookup', () =>
    prisma.session.findUnique({
      where: { id: token },
      include: { user: true },
    })
  );

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: token } });
    return null;
  }

  if (session.user.status !== 'active') return null;

  return session.user;
});

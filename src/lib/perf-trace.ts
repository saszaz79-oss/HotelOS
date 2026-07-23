// TEMPORARY diagnostic instrumentation (production incident). Delete this
// file, the `_PerfEvent` table, and every import of it once the real
// bottleneck is found and fixed — this is not meant to ship long-term.
//
// Writes go straight to Postgres (a throwaway `_PerfEvent` table, not part
// of the real schema) instead of relying solely on console.log, because
// `vercel logs` proved unreliable for pulling back real traffic on this
// project's plan during this same incident. Fire-and-forget: never awaited
// by the caller, and any failure here is swallowed so the diagnostic
// instrumentation itself can never slow down or break the request it's
// measuring.
import { prisma } from './prisma';

// Vercel stamps every request with a unique x-vercel-id (format
// "region::id", e.g. "bom1::abc123") — reading it here means every
// instrumented call site gets real cross-layer correlation for free,
// without threading a request id through every function signature
// (several of the instrumented functions are React cache()-wrapped and
// called from multiple sites; changing their signature risked breaking
// that dedup). Safe to call from anywhere in a request-scoped async
// context; swallows and falls back to 'unknown' anywhere it isn't
// (e.g. inside an after() background callback).
async function currentReqId(): Promise<string> {
  try {
    const { headers } = await import('next/headers');
    return (await headers()).get('x-vercel-id') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function trace(label: string, extra?: Record<string, unknown> & { ms?: number }): void {
  console.log(`[PERF] ${new Date().toISOString()} ${label}${extra ? ' ' + JSON.stringify(extra) : ''}`);
  const { ms, ...rest } = extra ?? {};
  currentReqId()
    .then((reqId) =>
      prisma.$executeRaw`INSERT INTO "_PerfEvent" (req_id, label, ms, extra) VALUES (${reqId}, ${label}, ${ms ?? null}, ${JSON.stringify(rest)}::jsonb)`
    )
    .catch(() => {
      // Never let diagnostic logging break or slow the real request.
    });
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    trace(label, { ms: Math.round((performance.now() - start) * 100) / 100 });
    return result;
  } catch (err) {
    trace(label, { ms: Math.round((performance.now() - start) * 100) / 100, failed: true });
    throw err;
  }
}

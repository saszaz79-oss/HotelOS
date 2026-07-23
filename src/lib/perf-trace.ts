// TEMPORARY diagnostic instrumentation (Zero-Lag Sprint, production incident).
// Delete this file and every import of it once the real bottleneck is found
// and fixed — this is not meant to ship long-term.
export function trace(label: string, extra?: Record<string, unknown>): void {
  console.log(`[PERF] ${new Date().toISOString()} ${label}${extra ? ' ' + JSON.stringify(extra) : ''}`);
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

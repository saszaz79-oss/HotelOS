// Makes Cloudflare bindings (Hyperdrive, R2, etc.) available to
// getCloudflareContext() during `next dev` only — separate from
// `opennextjs-cloudflare build`/`preview`/`deploy`, which build the actual
// Worker (docs/CLOUDFLARE_DEPLOYMENT.md). Must NOT run during `next build`
// (including the `next build` that `opennextjs-cloudflare build` runs
// internally): it eagerly resolves each binding's local dev proxy, and
// without a reachable local Postgres for Hyperdrive that resolution throws
// and aborts the build — confirmed directly in this environment.
if (process.env.NEXT_PHASE === 'phase-development-server') {
  const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default nextConfig;

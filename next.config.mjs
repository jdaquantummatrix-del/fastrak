/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js dev-tools indicator (the little "n" badge). Dev-only anyway —
  // it never shipped to production — but we don't want it while we work.
  devIndicators: false,
  // PGlite ships WASM + a Node FS adapter; let Next load it as-is instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Keep the build from scanning the legacy source / learning workspace.
  outputFileTracingExcludes: {
    "*": ["./incoming/**", "./learning/**"]
  }
};

export default nextConfig;

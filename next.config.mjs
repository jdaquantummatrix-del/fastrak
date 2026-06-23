/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM + a Node FS adapter; let Next load it as-is instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Keep the build from scanning the legacy source / learning workspace.
  outputFileTracingExcludes: {
    "*": ["./incoming/**", "./learning/**"]
  }
};

export default nextConfig;

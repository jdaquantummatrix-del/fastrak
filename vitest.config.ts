import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // PGlite (WASM) is happiest one DB per test file.
    pool: "forks",
    testTimeout: 20000
  }
});

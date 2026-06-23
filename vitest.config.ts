import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // PGlite (WASM) is happiest one DB per test file. Running the test files in
    // PARALLEL forks pits several PGlite WASM instances against each other for CPU,
    // and under that contention a single file would intermittently blow the 20s
    // per-test timeout (every file passes in isolation). singleFork serialises the
    // files into one worker — no cross-fork WASM contention — so `npm test` is
    // reliably green in one run. testTimeout is also raised to 30s as a safety margin.
    pool: "forks",
    // One worker, no file parallelism: serialises the PGlite (WASM) test files so they
    // don't contend for CPU and blow the timeout. testTimeout raised to 30s for margin.
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000
  }
});

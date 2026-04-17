// Import Vitest's config helper — similar to how vite.config.ts works
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable global test functions (describe, it, expect) without importing them in every test file
    globals: true,

    // Use Node.js as the test environment (not jsdom/browser, since this is a backend project)
    environment: "node",

    // Tell Vitest where to find test files across the monorepo:
    // - shared/src/**/*.test.ts  → shared library tests
    // - services/*/src/**/*.test.ts → any service's tests
    include: ["shared/src/**/*.test.ts", "services/*/src/**/*.test.ts"],

    // Coverage configuration — tracks how much of the source code is exercised by tests
    coverage: {
      // V8 provider uses Node's built-in coverage (faster than Istanbul)
      provider: "v8",

      // Only measure coverage for actual source files in shared/ and services/
      include: ["shared/src/**/*.ts", "services/*/src/**/*.ts"],

      // Exclude files that don't contain testable business logic:
      exclude: [
        "**/*.test.ts", // test files themselves
        "**/app.ts", // server entry points (Express setup, listen calls)
        "**/server.ts", // server bootstrap (listen calls)
        "**/config/**", // environment config (just reads env vars)
        "**/swagger.ts", // OpenAPI spec definitions
        "**/generated/**", // Prisma generated client code
      ],

      // Output formats: "text" prints a table per file, "text-summary" prints totals
      reporter: ["text", "text-summary"],

      // Minimum coverage thresholds — CI will fail if coverage drops below these
      thresholds: {
        statements: 80, // 80% of statements must be executed
        branches: 70, // 70% of if/else/switch branches must be covered
        functions: 80, // 80% of functions must be called
        lines: 80, // 80% of lines must be hit
      },
    },
  },
});

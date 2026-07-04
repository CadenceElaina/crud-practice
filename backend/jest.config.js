module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/tests/**/*.test.ts"], // Only test files inside `tests/` folder
  setupFiles: ["./src/tests/helpers/env.ts"], // runs before any module is imported
};

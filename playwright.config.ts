import { defineConfig, devices } from "@playwright/test";

const DASHBOARD_PORT = 3100;
const API_PORT = 3101;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${DASHBOARD_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: `API_PORT=${API_PORT} pnpm --filter @arcana/api start`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `NEXT_PUBLIC_API_URL=http://127.0.0.1:${API_PORT} NEXT_PUBLIC_WS_URL=ws://127.0.0.1:${API_PORT} pnpm --filter @arcana/dashboard exec next start --hostname 127.0.0.1 --port ${DASHBOARD_PORT}`,
      url: `http://127.0.0.1:${DASHBOARD_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

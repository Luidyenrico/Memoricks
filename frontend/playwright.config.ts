import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        (process.platform === "win32"
          ? '"..\\backend\\venv\\Scripts\\python.exe"'
          : "../backend/venv/bin/python") + " ../backend/tests/e2e_server.py",
      url: "http://127.0.0.1:8100/groups",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:8100", MEMORICKS_E2E: "1",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.MEMORICKS_AUTH_E2E === "1" ? "e2e.apps.googleusercontent.com" : "",
      },
    },
  ],
});

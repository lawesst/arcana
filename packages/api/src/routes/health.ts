import type { App } from "../types";

export function registerHealthRoutes(app: App) {
  app.get("/health", async () => {
    return { status: "ok", service: "arcana-api", timestamp: Date.now() };
  });
}

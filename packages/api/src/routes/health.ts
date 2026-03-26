import type { App } from "../types";

export function registerHealthRoutes(app: App) {
  const healthHandler = async () => {
    return { status: "ok", service: "arcana-api", timestamp: Date.now() };
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
}

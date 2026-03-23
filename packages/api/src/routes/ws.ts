import type { App } from "../types";
import { REDIS_CHANNELS } from "@arcana/shared";

export function registerWsRoutes(app: App) {
  app.get("/ws", { websocket: true }, (socket, _req) => {
    const channels = Object.values(REDIS_CHANNELS);

    // Subscribe to all Redis channels
    for (const channel of channels) {
      app.redisSub.subscribe(channel).catch((err: Error) => {
        app.log.error(`Failed to subscribe to ${channel}: ${err.message}`);
      });
    }

    // Forward Redis messages to WebSocket client
    const messageHandler = (_channel: string, message: string) => {
      try {
        if (socket.readyState === 1) {
          socket.send(message);
        }
      } catch {
        // Client disconnected
      }
    };

    app.redisSub.on("message", messageHandler);

    // Send initial connection confirmation
    socket.send(
      JSON.stringify({
        type: "connected",
        data: { message: "Connected to Arcana real-time feed" },
        timestamp: Date.now(),
      }),
    );

    socket.on("close", () => {
      app.redisSub.off("message", messageHandler);
    });

    socket.on("error", () => {
      app.redisSub.off("message", messageHandler);
    });
  });
}

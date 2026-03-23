import type { App } from "../types";
import type { WebSocket } from "ws";
import { REDIS_CHANNELS } from "@arcana/shared";

export function registerWsRoutes(app: App) {
  // Track all connected WebSocket clients
  const clients = new Set<WebSocket>();

  // Subscribe to Redis channels ONCE at registration time
  const channels = Object.values(REDIS_CHANNELS);
  for (const channel of channels) {
    app.redisSub.subscribe(channel).catch((err: Error) => {
      app.log.error(`Failed to subscribe to ${channel}: ${err.message}`);
    });
  }

  // Forward Redis messages to ALL connected WebSocket clients
  app.redisSub.on("message", (_channel: string, message: string) => {
    for (const client of clients) {
      try {
        if (client.readyState === 1) {
          client.send(message);
        }
      } catch {
        // Client disconnected, will be cleaned up on close
      }
    }
  });

  app.get("/ws", { websocket: true }, (socket, _req) => {
    clients.add(socket);

    // Send initial connection confirmation
    socket.send(
      JSON.stringify({
        type: "connected",
        dappId: null,
        data: { message: "Connected to Arcana real-time feed" },
        timestamp: Date.now(),
      }),
    );

    socket.on("close", () => {
      clients.delete(socket);
    });

    socket.on("error", () => {
      clients.delete(socket);
    });
  });
}

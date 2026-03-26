"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

interface WsMessage {
  type: string;
  dappId: string | null;
  data: unknown;
  timestamp: number;
}

type MessageHandler = (data: WsMessage) => void;

interface WsHandlers {
  onTransaction?: (tx: unknown) => void;
  onBlock?: (block: unknown) => void;
  onMetrics?: (metrics: unknown) => void;
  onAlert?: (alert: unknown) => void;
  onMessage?: MessageHandler;
}

export function useWebSocket(handlers?: WsHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const disposedRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (disposedRef.current) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const ws = new WebSocket(`${WS_URL}/ws`);

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        const h = handlersRef.current;
        if (!h) return;

        h.onMessage?.(msg);

        switch (msg.type) {
          case "arcana:transactions":
            h.onTransaction?.(msg.data);
            break;
          case "arcana:blocks":
            h.onBlock?.(msg.data);
            break;
          case "arcana:metrics":
            h.onMetrics?.(msg.data);
            break;
          case "arcana:alerts":
            h.onAlert?.(msg.data);
            break;
        }
      } catch {
        // Invalid JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (disposedRef.current) return;

      reconnectTimer.current = setTimeout(() => {
        if (disposedRef.current) return;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected };
}

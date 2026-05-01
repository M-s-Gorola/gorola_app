import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

import { useAuthStore } from "@/store/auth.store";

export type OrderStatusUpdate = {
  orderId: string;
  status: string;
};

export function useOrderSocket(
  orderId: string | undefined,
  onStatusChanged: (data: OrderStatusUpdate) => void
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId || !accessToken) return;

    const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    const socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_order", orderId);
    });

    socket.on("order_status_changed", (data: OrderStatusUpdate) => {
      onStatusChanged(data);
    });

    socket.on("error", (err: unknown) => {
      console.error("Socket error:", err);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId, accessToken, onStatusChanged]);

  return socketRef.current;
}

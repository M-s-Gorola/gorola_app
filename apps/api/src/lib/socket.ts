import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server, Socket } from "socket.io";

import type { AccessTokenPayload, AccessTokenVerifier } from "../modules/auth/auth.types.js";
import { OrderRepository } from "../modules/order/order.repository.js";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export type SocketPluginOptions = {
  tokenVerifier: AccessTokenVerifier;
  orderRepository: OrderRepository;
};

export const socketPlugin = fp(async (app: FastifyInstance, options: SocketPluginOptions) => {
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const io = new Server(app.server, {
    cors: {
      credentials: true,
      origin: process.env.NODE_ENV === "development" ? true : (corsOrigins.length === 0 ? true : corsOrigins),
    },
  });

  interface AuthenticatedSocket extends Socket {
    user: AccessTokenPayload;
  }

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== "string") {
        return next(new Error("Authentication error: Missing token"));
      }

      const payload = await options.tokenVerifier.verifyAccessToken(token);
      (socket as AuthenticatedSocket).user = payload;
      next();
    } catch {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.user;
    app.log.info({ socketId: socket.id, userId: user.sub }, "Socket connected");

    socket.on("join_order", async (orderId: string) => {
      try {
        const order = await options.orderRepository.findById(orderId);
        if (!order) {
          socket.emit("error", { message: "Order not found" });
          return;
        }

        if (order.userId !== user.sub && user.role !== "ADMIN") {
          socket.emit("error", { message: "Unauthorized access to order" });
          return;
        }

        const room = `order:${orderId}`;
        void socket.join(room);
        app.log.info({ orderId, socketId: socket.id, userId: user.sub }, "Joined order room");
      } catch {
        socket.emit("error", { message: "Failed to join order room" });
      }
    });

    socket.on("join_store", async (storeId: string) => {
      try {
        if (user.role !== "STORE_OWNER" && user.role !== "ADMIN") {
          socket.emit("error", { message: "Unauthorized access to store updates" });
          return;
        }

        const room = `store:${storeId}`;
        void socket.join(room);
        app.log.info({ storeId, socketId: socket.id, userId: user.sub }, "Joined store room");
      } catch {
        socket.emit("error", { message: "Failed to join store room" });
      }
    });

    socket.on("disconnect", () => {
      app.log.info({ userId: user.sub, socketId: socket.id }, "Socket disconnected");
    });
  });

  // Rider namespace
  const riderNamespace = io.of("/rider");

  riderNamespace.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== "string") {
        return next(new Error("Authentication error: Missing token"));
      }

      const payload = await options.tokenVerifier.verifyAccessToken(token);
      if (payload.role !== "RIDER" && payload.role !== "ADMIN") {
        return next(new Error("Authentication error: Unauthorized role"));
      }
      (socket as AuthenticatedSocket).user = payload;
      next();
    } catch {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  riderNamespace.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.user;
    app.log.info({ socketId: socket.id, userId: user.sub }, "Rider socket connected");

    socket.on("disconnect", () => {
      app.log.info({ userId: user.sub, socketId: socket.id }, "Rider socket disconnected");
    });
  });

  app.decorate("io", io);

  app.addHook("onClose", async () => {
    io.close();
  });
});

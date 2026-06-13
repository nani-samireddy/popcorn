import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { Server } from "socket.io";
import { config } from "./config";
import { RoomService } from "./room-service";
import { registerSocketHandlers } from "./socket";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_URL }));
  app.use(express.json({ limit: "32kb" }));
  app.use(pinoHttp());

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "popcorn-server" });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: config.CLIENT_URL },
    maxHttpBufferSize: 100_000,
  });
  registerSocketHandlers(io, new RoomService());
  return { app, httpServer, io };
}

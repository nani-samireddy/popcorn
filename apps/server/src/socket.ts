import {
  chatMessageSchema,
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  playbackEventSchema,
  reactionSchema,
  videoSetSchema,
  webRtcSignalSchema,
  type SocketAck,
} from "@popcorn/shared";
import type { Server, Socket } from "socket.io";
import type { z } from "zod";
import { RoomError } from "./room-service";
import type { RoomService } from "./room-service";

type Ack<T = undefined> = (result: SocketAck<T>) => void;

function parsePayload<T, TData>(
  schema: z.ZodType<T>,
  payload: unknown,
  ack: Ack<TData>,
): T | undefined {
  const result = schema.safeParse(payload);
  if (!result.success) {
    ack({ ok: false, error: result.error.issues[0]?.message ?? "Invalid payload" });
    return undefined;
  }
  return result.data;
}

function handleError<TData>(error: unknown, ack?: Ack<TData>): void {
  const message = error instanceof RoomError ? error.message : "Unable to complete request";
  ack?.({ ok: false, error: message });
}

export function registerSocketHandlers(io: Server, rooms: RoomService): void {
  io.on("connection", (socket) => {
    socket.on("room:create", (payload: unknown, ack: Ack<{ roomId: string }>) => {
      const data = parsePayload(createRoomSchema, payload, ack);
      if (!data) return;
      try {
        const room = rooms.createRoom(socket.id, data.displayName);
        void socket.join(room.roomId);
        ack({ ok: true, data: { roomId: room.roomId } });
        socket.emit("room:state", room);
      } catch (error) {
        handleError(error, ack);
      }
    });

    socket.on("room:join", (payload: unknown, ack: Ack) => {
      const data = parsePayload(joinRoomSchema, payload, ack);
      if (!data) return;
      try {
        const room = rooms.joinRoom(data.roomId, socket.id, data.displayName);
        void socket.join(room.roomId);
        ack({ ok: true });
        io.to(room.roomId).emit("room:state", room);
      } catch (error) {
        handleError(error, ack);
      }
    });

    socket.on("room:leave", (payload: unknown, ack: Ack) => {
      const data = parsePayload(leaveRoomSchema, payload, ack);
      if (!data) return;
      const room = rooms.leaveRoom(data.roomId, socket.id);
      void socket.leave(data.roomId);
      ack({ ok: true });
      if (room) io.to(data.roomId).emit("room:state", room);
    });

    socket.on("video:set", (payload: unknown, ack: Ack) => {
      const data = parsePayload(videoSetSchema, payload, ack);
      if (!data) return;
      try {
        const room = rooms.setVideo(data.roomId, socket.id, {
          type: data.type,
          source: data.source,
          title: data.title,
        });
        ack({ ok: true });
        io.to(data.roomId).emit("room:state", room);
      } catch (error) {
        handleError(error, ack);
      }
    });

    for (const [event, forcedPlaying] of [
      ["video:play", true],
      ["video:pause", false],
      ["video:seek", undefined],
    ] as const) {
      socket.on(event, (payload: unknown, ack: Ack) => {
        const data = parsePayload(playbackEventSchema, payload, ack);
        if (!data) return;
        try {
          const currentPlayback = rooms.getRoom(data.roomId)?.playback;
          const room = rooms.setPlayback(data.roomId, socket.id, {
            isPlaying:
              forcedPlaying ??
              data.isPlaying ??
              currentPlayback?.isPlaying ??
              false,
            currentTime: data.currentTime,
          });
          ack({ ok: true });
          socket.to(data.roomId).emit(event, room.playback);
          io.to(data.roomId).emit("room:state", room);
        } catch (error) {
          handleError(error, ack);
        }
      });
    }

    socket.on("chat:message", (payload: unknown, ack: Ack) => {
      const data = parsePayload(chatMessageSchema, payload, ack);
      if (!data) return;
      try {
        const message = rooms.addChatMessage(data.roomId, socket.id, data.body);
        ack({ ok: true });
        io.to(data.roomId).emit("chat:message", message);
      } catch (error) {
        handleError(error, ack);
      }
    });

    socket.on("reaction:send", (payload: unknown, ack: Ack) => {
      const data = parsePayload(reactionSchema, payload, ack);
      if (!data) return;
      if (!rooms.isMember(data.roomId, socket.id)) {
        ack({ ok: false, error: "Join the room before reacting" });
        return;
      }
      ack({ ok: true });
      io.to(data.roomId).emit("reaction:send", {
        ...data,
        id: crypto.randomUUID(),
        senderId: socket.id,
        createdAt: Date.now(),
      });
    });

    for (const event of ["webrtc:offer", "webrtc:answer", "webrtc:ice-candidate"] as const) {
      socket.on(event, (payload: unknown, ack: Ack) => {
        const data = parsePayload(webRtcSignalSchema, payload, ack);
        if (!data) return;
        if (!rooms.isMember(data.roomId, socket.id)) {
          ack({ ok: false, error: "Join the room before using voice chat" });
          return;
        }
        ack({ ok: true });
        io.to(data.targetId).emit(event, { senderId: socket.id, signal: data.signal });
      });
    }

    registerVoiceEvent(socket, io, rooms, "voice:join", "connected");
    registerVoiceEvent(socket, io, rooms, "voice:leave", "disconnected");
    registerVoiceEvent(socket, io, rooms, "voice:mute", "muted");
    registerVoiceEvent(socket, io, rooms, "voice:unmute", "connected");
    registerVideoEvent(socket, io, rooms, "camera:join", "connected");
    registerVideoEvent(socket, io, rooms, "camera:leave", "disconnected");

    socket.on("disconnect", () => {
      for (const roomId of rooms.leaveAllRooms(socket.id)) {
        const room = rooms.getRoom(roomId);
        if (room) io.to(roomId).emit("room:state", room);
      }
    });
  });
}

function registerVideoEvent(
  socket: Socket,
  io: Server,
  rooms: RoomService,
  event: "camera:join" | "camera:leave",
  status: "connected" | "disconnected",
): void {
  socket.on(event, (payload: unknown, ack: Ack) => {
    const data = parsePayload(leaveRoomSchema, payload, ack);
    if (!data) return;
    try {
      const room = rooms.updateVideoStatus(data.roomId, socket.id, status);
      ack({ ok: true });
      io.to(data.roomId).emit("room:state", room);
    } catch (error) {
      handleError(error, ack);
    }
  });
}

function registerVoiceEvent(
  socket: Socket,
  io: Server,
  rooms: RoomService,
  event: "voice:join" | "voice:leave" | "voice:mute" | "voice:unmute",
  status: "connected" | "disconnected" | "muted",
): void {
  socket.on(event, (payload: unknown, ack: Ack) => {
    const data = parsePayload(leaveRoomSchema, payload, ack);
    if (!data) return;
    try {
      const room = rooms.updateVoiceStatus(data.roomId, socket.id, status);
      ack({ ok: true });
      io.to(data.roomId).emit("room:state", room);
    } catch (error) {
      handleError(error, ack);
    }
  });
}

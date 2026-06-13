import type { AddressInfo } from "node:net";
import type { PlaybackState, SocketAck } from "@popcorn/shared";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

const clients: Socket[] = [];
const servers: ReturnType<typeof createApp>[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of servers.splice(0)) {
    server.io.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

describe("playback socket integration", () => {
  it("broadcasts host play, seek, and pause while rejecting guest controls", async () => {
    const server = createApp();
    servers.push(server);
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    const host = await connectClient(url);
    const guest = await connectClient(url);

    const created = await emitAck<{ roomId: string }>(host, "room:create", {
      displayName: "Host",
    });
    const roomId = created.data?.roomId;
    expect(roomId).toBeDefined();
    await emitAck(guest, "room:join", { roomId, displayName: "Guest" });

    const playEvent = once<PlaybackState>(guest, "video:play");
    await emitAck(host, "video:play", { roomId, currentTime: 12 });
    expect(await playEvent).toMatchObject({ isPlaying: true, currentTime: 12 });

    const seekEvent = once<PlaybackState>(guest, "video:seek");
    await emitAck(host, "video:seek", {
      roomId,
      currentTime: 42,
      isPlaying: true,
    });
    expect(await seekEvent).toMatchObject({ isPlaying: true, currentTime: 42 });

    const pauseEvent = once<PlaybackState>(guest, "video:pause");
    await emitAck(host, "video:pause", { roomId, currentTime: 47 });
    expect(await pauseEvent).toMatchObject({ isPlaying: false, currentTime: 47 });

    const rejected = await emitAck(guest, "video:play", {
      roomId,
      currentTime: 50,
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: "Only the host can control playback",
    });
  });
});

async function connectClient(url: string): Promise<Socket> {
  const client = createClient(url, { transports: ["websocket"] });
  clients.push(client);
  await once(client, "connect");
  return client;
}

function emitAck<T = undefined>(
  socket: Socket,
  event: string,
  payload: object,
): Promise<SocketAck<T>> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function once<T = void>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

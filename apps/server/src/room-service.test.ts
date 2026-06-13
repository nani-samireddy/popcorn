import { describe, expect, it } from "vitest";
import { RoomService } from "./room-service";

describe("RoomService", () => {
  it("creates a room with its creator as host", () => {
    const room = new RoomService().createRoom("socket-1", "Nani");
    expect(room.hostId).toBe("socket-1");
    expect(room.users[0]).toMatchObject({ displayName: "Nani", isHost: true });
  });

  it("joins users and transfers host when the host leaves", () => {
    const service = new RoomService();
    const room = service.createRoom("socket-1", "Nani");
    service.joinRoom(room.roomId, "socket-2", "Friend");
    const updated = service.leaveRoom(room.roomId, "socket-1");
    expect(updated?.hostId).toBe("socket-2");
    expect(updated?.users[0]?.isHost).toBe(true);
  });

  it("deletes empty rooms", () => {
    const service = new RoomService();
    const room = service.createRoom("socket-1", "Nani");
    service.leaveRoom(room.roomId, "socket-1");
    expect(service.getRoom(room.roomId)).toBeUndefined();
  });

  it("enforces host-only playback control", () => {
    const service = new RoomService();
    const room = service.createRoom("socket-1", "Nani");
    service.joinRoom(room.roomId, "socket-2", "Friend");
    expect(() =>
      service.setPlayback(room.roomId, "socket-2", {
        isPlaying: true,
        currentTime: 0,
      }),
    ).toThrow("Only the host");
  });

  it("updates camera presence for participant avatars", () => {
    const service = new RoomService();
    const room = service.createRoom("socket-1", "Nani");
    const updated = service.updateVideoStatus(
      room.roomId,
      "socket-1",
      "connected",
    );
    expect(updated.users[0]?.videoStatus).toBe("connected");
  });
});

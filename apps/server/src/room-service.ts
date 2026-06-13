import { randomBytes, randomUUID } from "node:crypto";
import type {
  ChatMessage,
  PlaybackState,
  RoomState,
  RoomUser,
  VideoState,
} from "@popcorn/shared";

export class RoomError extends Error {}

export class RoomService {
  private readonly rooms = new Map<string, RoomState>();

  createRoom(socketId: string, displayName: string): RoomState {
    const roomId = this.generateRoomId();
    const host = this.createUser(socketId, displayName, true);
    const room: RoomState = {
      roomId,
      hostId: socketId,
      users: [host],
      video: { type: null, source: null },
      playback: { isPlaying: false, currentTime: 0, updatedAt: Date.now() },
      chatMessages: [],
      settings: {
        controlMode: "host-only",
        chatEnabled: true,
        voiceEnabled: true,
      },
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, socketId: string, displayName: string): RoomState {
    const room = this.requireRoom(roomId);
    const existingUser = room.users.find((user) => user.id === socketId);
    if (existingUser) return room;

    room.users.push(this.createUser(socketId, displayName, false));
    this.addSystemMessage(room, `${displayName} joined the room`);
    return room;
  }

  leaveRoom(roomId: string, socketId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const leavingUser = room.users.find((user) => user.id === socketId);
    room.users = room.users.filter((user) => user.id !== socketId);
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    if (room.hostId === socketId) {
      const nextHost = room.users[0];
      if (!nextHost) throw new RoomError("Unable to transfer host");
      room.hostId = nextHost.id;
      nextHost.isHost = true;
      this.addSystemMessage(room, `${nextHost.displayName} is now the host`);
    }
    if (leavingUser) {
      this.addSystemMessage(room, `${leavingUser.displayName} left the room`);
    }
    return room;
  }

  leaveAllRooms(socketId: string): string[] {
    const affectedRoomIds: string[] = [];
    for (const room of this.rooms.values()) {
      if (room.users.some((user) => user.id === socketId)) {
        affectedRoomIds.push(room.roomId);
        this.leaveRoom(room.roomId, socketId);
      }
    }
    return affectedRoomIds;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  setVideo(roomId: string, socketId: string, video: VideoState): RoomState {
    const room = this.requireControl(roomId, socketId);
    room.video = video;
    room.playback = {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
    };
    const user = this.requireUser(room, socketId);
    this.addSystemMessage(room, `${user.displayName} changed the video`);
    return room;
  }

  setPlayback(
    roomId: string,
    socketId: string,
    update: Pick<PlaybackState, "isPlaying" | "currentTime">,
  ): RoomState {
    const room = this.requireControl(roomId, socketId);
    room.playback = { ...update, updatedAt: Date.now() };
    return room;
  }

  addChatMessage(roomId: string, socketId: string, body: string): ChatMessage {
    const room = this.requireRoom(roomId);
    if (!room.settings.chatEnabled) throw new RoomError("Chat is disabled");
    const user = this.requireUser(room, socketId);
    const message: ChatMessage = {
      id: randomUUID(),
      roomId,
      senderId: socketId,
      senderName: user.displayName,
      body: body.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      createdAt: Date.now(),
      type: "user",
    };
    room.chatMessages.push(message);
    room.chatMessages = room.chatMessages.slice(-100);
    return message;
  }

  updateVoiceStatus(
    roomId: string,
    socketId: string,
    status: RoomUser["voiceStatus"],
  ): RoomState {
    const room = this.requireRoom(roomId);
    this.requireUser(room, socketId).voiceStatus = status;
    return room;
  }

  updateVideoStatus(
    roomId: string,
    socketId: string,
    status: RoomUser["videoStatus"],
  ): RoomState {
    const room = this.requireRoom(roomId);
    this.requireUser(room, socketId).videoStatus = status;
    return room;
  }

  isMember(roomId: string, socketId: string): boolean {
    return (
      this.rooms.get(roomId)?.users.some((user) => user.id === socketId) ?? false
    );
  }

  private requireRoom(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) throw new RoomError("Room not found");
    return room;
  }

  private requireUser(room: RoomState, socketId: string): RoomUser {
    const user = room.users.find((candidate) => candidate.id === socketId);
    if (!user) throw new RoomError("Join the room before performing this action");
    return user;
  }

  private requireControl(roomId: string, socketId: string): RoomState {
    const room = this.requireRoom(roomId);
    this.requireUser(room, socketId);
    if (room.settings.controlMode === "host-only" && room.hostId !== socketId) {
      throw new RoomError("Only the host can control playback");
    }
    return room;
  }

  private addSystemMessage(room: RoomState, body: string): void {
    room.chatMessages.push({
      id: randomUUID(),
      roomId: room.roomId,
      senderId: null,
      senderName: "Popcorn",
      body,
      createdAt: Date.now(),
      type: "system",
    });
  }

  private createUser(
    id: string,
    displayName: string,
    isHost: boolean,
  ): RoomUser {
    return {
      id,
      displayName,
      isHost,
      voiceStatus: "disconnected",
      videoStatus: "disconnected",
    };
  }

  private generateRoomId(): string {
    let id: string;
    do {
      id = randomBytes(4).toString("hex").toUpperCase();
    } while (this.rooms.has(id));
    return id;
  }
}

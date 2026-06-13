export type VideoType = "youtube" | "local" | null;

export interface RoomUser {
  id: string;
  displayName: string;
  isHost: boolean;
  voiceStatus: "disconnected" | "connected" | "muted";
  videoStatus: "disconnected" | "connected";
}

export interface VideoState {
  type: VideoType;
  source: string | null;
  title?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  body: string;
  createdAt: number;
  type: "user" | "system";
}

export interface RoomSettings {
  controlMode: "host-only" | "everyone";
  chatEnabled: boolean;
  voiceEnabled: boolean;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  users: RoomUser[];
  video: VideoState;
  playback: PlaybackState;
  chatMessages: ChatMessage[];
  settings: RoomSettings;
}

export interface Reaction {
  id: string;
  roomId: string;
  senderId: string;
  emoji: string;
  createdAt: number;
}

export interface SocketAck<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

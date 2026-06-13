import { z } from "zod";

const displayName = z.string().trim().min(1).max(32);
const roomId = z.string().trim().min(4).max(12).regex(/^[A-Z0-9]+$/);

export const createRoomSchema = z.object({ displayName });
export const joinRoomSchema = z.object({ roomId, displayName });
export const leaveRoomSchema = z.object({ roomId });

export const chatMessageSchema = z.object({
  roomId,
  body: z.string().trim().min(1).max(500),
});

export const reactionSchema = z.object({
  roomId,
  emoji: z.enum(["❤️", "😂", "😮", "👏", "🍿"]),
});

export const videoSetSchema = z.object({
  roomId,
  type: z.enum(["youtube", "local"]),
  source: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(120).optional(),
});

export const playbackEventSchema = z.object({
  roomId,
  currentTime: z.number().finite().nonnegative(),
  isPlaying: z.boolean().optional(),
});

export const webRtcSignalSchema = z.object({
  roomId,
  targetId: z.string().min(1),
  signal: z.unknown(),
});

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
export type ChatMessagePayload = z.infer<typeof chatMessageSchema>;
export type ReactionPayload = z.infer<typeof reactionSchema>;
export type VideoSetPayload = z.infer<typeof videoSetSchema>;
export type PlaybackEventPayload = z.infer<typeof playbackEventSchema>;

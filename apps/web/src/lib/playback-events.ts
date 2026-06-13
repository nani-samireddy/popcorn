import {
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayerState,
} from "./youtube-api";

export type PlaybackSocketEvent = "video:play" | "video:pause";

export function getPlaybackSocketEvent(
  state: YouTubePlayerState,
  isHost: boolean,
  isSuppressed: boolean,
): PlaybackSocketEvent | null {
  if (!isHost || isSuppressed) return null;
  if (state === YOUTUBE_PLAYER_STATE.PLAYING) return "video:play";
  if (
    state === YOUTUBE_PLAYER_STATE.PAUSED ||
    state === YOUTUBE_PLAYER_STATE.ENDED
  ) {
    return "video:pause";
  }
  return null;
}

import type { PlaybackState } from "./types";

export const DRIFT_THRESHOLD_SECONDS = 1.5;

export function getExpectedPlaybackTime(
  playback: PlaybackState,
  now = Date.now(),
): number {
  if (!playback.isPlaying) return playback.currentTime;
  return playback.currentTime + Math.max(0, now - playback.updatedAt) / 1000;
}

export function shouldCorrectPlayback(
  localTime: number,
  playback: PlaybackState,
  now = Date.now(),
): boolean {
  return (
    Math.abs(localTime - getExpectedPlaybackTime(playback, now)) >
    DRIFT_THRESHOLD_SECONDS
  );
}

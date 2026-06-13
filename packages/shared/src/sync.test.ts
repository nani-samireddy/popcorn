import { describe, expect, it } from "vitest";
import { getExpectedPlaybackTime, shouldCorrectPlayback } from "./sync";

describe("playback sync", () => {
  it("advances playing video using the server timestamp", () => {
    expect(
      getExpectedPlaybackTime(
        { isPlaying: true, currentTime: 10, updatedAt: 1_000 },
        3_500,
      ),
    ).toBe(12.5);
  });

  it("corrects only meaningful drift", () => {
    const playback = { isPlaying: false, currentTime: 10, updatedAt: 1_000 };
    expect(shouldCorrectPlayback(11, playback)).toBe(false);
    expect(shouldCorrectPlayback(12, playback)).toBe(true);
  });
});

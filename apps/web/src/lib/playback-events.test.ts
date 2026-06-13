import { describe, expect, it } from "vitest";
import { getPlaybackSocketEvent } from "./playback-events";
import { YOUTUBE_PLAYER_STATE } from "./youtube-api";

describe("getPlaybackSocketEvent", () => {
  it("ignores temporary pause callbacks during a programmatic seek", () => {
    expect(
      getPlaybackSocketEvent(YOUTUBE_PLAYER_STATE.PAUSED, true, true),
    ).toBeNull();
  });

  it("broadcasts deliberate host playback changes", () => {
    expect(
      getPlaybackSocketEvent(YOUTUBE_PLAYER_STATE.PLAYING, true, false),
    ).toBe("video:play");
    expect(
      getPlaybackSocketEvent(YOUTUBE_PLAYER_STATE.PAUSED, true, false),
    ).toBe("video:pause");
  });

  it("never broadcasts guest player callbacks", () => {
    expect(
      getPlaybackSocketEvent(YOUTUBE_PLAYER_STATE.PLAYING, false, false),
    ).toBeNull();
  });
});

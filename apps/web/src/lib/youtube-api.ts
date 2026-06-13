export const YOUTUBE_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YouTubePlayerState =
  (typeof YOUTUBE_PLAYER_STATE)[keyof typeof YOUTUBE_PLAYER_STATE];

interface YouTubePlayerOptions {
  videoId: string;
  playerVars: {
    controls: number;
    playsinline: number;
    rel: number;
  };
  events: {
    onReady: () => void;
    onStateChange: (event: { data: YouTubePlayerState }) => void;
    onError: () => void;
  };
}

export interface YouTubePlayerInstance {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | undefined;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube IFrame API did not initialize"));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Unable to load YouTube IFrame API"));
    document.head.append(script);
  });
  return apiPromise;
}

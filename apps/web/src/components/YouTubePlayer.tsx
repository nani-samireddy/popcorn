import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  loadYouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerState,
} from "../lib/youtube-api";

export interface YouTubePlayerHandle {
  getCurrentTime(): number;
  getDuration(): number;
  pause(): void;
  play(): void;
  seekTo(seconds: number): void;
}

interface YouTubePlayerProps {
  onError(message: string): void;
  onReady(): void;
  onStateChange(state: YouTubePlayerState): void;
  videoId: string;
}

export const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  YouTubePlayerProps
>(function YouTubePlayer({ onError, onReady, onStateChange, videoId }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
      pause: () => playerRef.current?.pauseVideo(),
      play: () => playerRef.current?.playVideo(),
      seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    }),
    [],
  );

  useEffect(() => {
    let disposed = false;

    async function createPlayer() {
      try {
        const youtube = await loadYouTubeIframeApi();
        if (disposed || !containerRef.current) return;
        playerRef.current = new youtube.Player(containerRef.current, {
          videoId,
          playerVars: { controls: 0, playsinline: 1, rel: 0 },
          events: {
            onReady,
            onStateChange: (event) => onStateChange(event.data),
            onError: () => onError("YouTube could not play this video."),
          },
        });
      } catch {
        if (!disposed) onError("Unable to load the YouTube player.");
      }
    }

    void createPlayer();
    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [onError, onReady, onStateChange, videoId]);

  return <div className="absolute inset-0 z-[1] h-full w-full" ref={containerRef} />;
});

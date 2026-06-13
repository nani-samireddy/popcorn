import {
  getExpectedPlaybackTime,
  type ChatMessage,
  type PlaybackState,
  type Reaction,
  type RoomState,
  type SocketAck,
} from "@popcorn/shared";
import {
  Copy,
  Crown,
  Camera,
  CameraOff,
  Hand,
  Link2,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Send,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from "../components/YouTubePlayer";
import { socket } from "../lib/socket";
import { getYouTubeVideoId } from "../lib/youtube";
import {
  YOUTUBE_PLAYER_STATE,
  type YouTubePlayerState,
} from "../lib/youtube-api";
import { getPlaybackSocketEvent } from "../lib/playback-events";

const reactions = ["❤️", "😂", "😮", "👏", "🍿"] as const;

export function RoomPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [floating, setFloating] = useState<Reaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showStageChrome, setShowStageChrome] = useState(true);
  const hideChromeTimer = useRef<number | undefined>(undefined);
  const youtubePlayerRef = useRef<YouTubePlayerHandle>(null);
  const roomRef = useRef<RoomState | null>(null);
  const isHostRef = useRef(false);
  const suppressPlayerEvents = useRef(false);
  const suppressTimer = useRef<number | undefined>(undefined);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCameraStream = useRef<MediaStream | null>(null);
  const [playerState, setPlayerState] = useState<YouTubePlayerState>(
    YOUTUBE_PLAYER_STATE.UNSTARTED,
  );
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    socket.connect();
    const onState = (nextRoom: RoomState) => {
      roomRef.current = nextRoom;
      setRoom({ ...nextRoom });
    };
    const onMessage = (nextMessage: ChatMessage) => {
      setRoom((current) =>
        current
          ? {
              ...current,
              chatMessages: [...current.chatMessages, nextMessage].slice(-100),
            }
          : current,
      );
    };
    const onReaction = (reaction: Reaction) => {
      setFloating((current) => [...current, reaction]);
      window.setTimeout(
        () =>
          setFloating((current) =>
            current.filter((item) => item.id !== reaction.id),
          ),
        2200,
      );
    };
    const onRemotePlayback = (playback: PlaybackState) => {
      applyRemotePlayback(playback);
    };
    socket.on("room:state", onState);
    socket.on("chat:message", onMessage);
    socket.on("reaction:send", onReaction);
    socket.on("video:play", onRemotePlayback);
    socket.on("video:pause", onRemotePlayback);
    socket.on("video:seek", onRemotePlayback);
    socket.emit(
      "room:join",
      { roomId, displayName: localStorage.getItem("popcorn:name") ?? "" },
      (result: SocketAck) => {
        if (!result.ok) setError(result.error ?? "Could not join room.");
      },
    );
    return () => {
      socket.off("room:state", onState);
      socket.off("chat:message", onMessage);
      socket.off("reaction:send", onReaction);
      socket.off("video:play", onRemotePlayback);
      socket.off("video:pause", onRemotePlayback);
      socket.off("video:seek", onRemotePlayback);
      localCameraStream.current?.getTracks().forEach((track) => track.stop());
      window.clearTimeout(suppressTimer.current);
    };
  }, [roomId]);

  const hasVideo = Boolean(room?.video.source);
  const me = room?.users.find((user) => user.id === socket.id);
  const isHost = room?.hostId === socket.id;
  roomRef.current = room;
  isHostRef.current = isHost;

  useEffect(() => {
    if (!playerReady || !hasVideo) return;
    const interval = window.setInterval(() => {
      setCurrentTime(youtubePlayerRef.current?.getCurrentTime() ?? 0);
      setDuration(youtubePlayerRef.current?.getDuration() ?? 0);
    }, 500);
    return () => window.clearInterval(interval);
  }, [hasVideo, playerReady]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    window.clearTimeout(hideChromeTimer.current);
    setShowStageChrome(true);
    if (!hasVideo) return;

    setShowChat(false);
    hideChromeTimer.current = window.setTimeout(
      () => setShowStageChrome(false),
      2500,
    );
    return () => window.clearTimeout(hideChromeTimer.current);
  }, [hasVideo, room?.video.source]);

  function revealStageChrome() {
    if (!hasVideo) return;
    setShowStageChrome(true);
    window.clearTimeout(hideChromeTimer.current);
    hideChromeTimer.current = window.setTimeout(
      () => setShowStageChrome(false),
      2500,
    );
  }

  function applyRemotePlayback(playback: PlaybackState) {
    if (!youtubePlayerRef.current) return;
    suppressPlaybackCallbacks();
    const expectedTime = getExpectedPlaybackTime(playback);
    youtubePlayerRef.current.seekTo(expectedTime);
    if (playback.isPlaying) youtubePlayerRef.current.play();
    else youtubePlayerRef.current.pause();
    setCurrentTime(expectedTime);
  }

  function suppressPlaybackCallbacks() {
    suppressPlayerEvents.current = true;
    window.clearTimeout(suppressTimer.current);
    suppressTimer.current = window.setTimeout(() => {
      suppressPlayerEvents.current = false;
    }, 1200);
  }

  const handleYouTubeReady = useCallback(() => {
    setPlayerState(YOUTUBE_PLAYER_STATE.CUED);
    setPlayerReady(true);
    const playback = roomRef.current?.playback;
    if (playback) applyRemotePlayback(playback);
  }, []);

  const handleYouTubeStateChange = useCallback((state: YouTubePlayerState) => {
    setPlayerState(state);
    const event = getPlaybackSocketEvent(
      state,
      isHostRef.current,
      suppressPlayerEvents.current,
    );
    if (!event) return;
    const player = youtubePlayerRef.current;
    if (!player) return;
    socket.emit(event, {
      roomId,
      currentTime: player.getCurrentTime(),
    });
  }, [roomId]);

  const handleYouTubeError = useCallback((message: string) => {
    setError(message);
  }, []);

  async function toggleCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      localCameraStream.current = null;
      setCameraStream(null);
      emitWithError("camera:leave", { roomId });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      localCameraStream.current = stream;
      setCameraStream(stream);
      emitWithError("camera:join", { roomId });
    } catch {
      setError("Camera permission was denied or no camera is available.");
    }
  }

  function setYouTubeVideo(event: FormEvent) {
    event.preventDefault();
    const videoId = getYouTubeVideoId(videoUrl);
    if (!videoId) {
      setError("That does not look like a valid YouTube URL.");
      return;
    }
    emitWithError("video:set", { roomId, type: "youtube", source: videoId });
    setVideoUrl("");
    setShowVideoInput(false);
  }

  function togglePlayback() {
    if (!isHost || !youtubePlayerRef.current) return;
    if (playerState === YOUTUBE_PLAYER_STATE.PLAYING) {
      youtubePlayerRef.current.pause();
    } else {
      youtubePlayerRef.current.play();
    }
  }

  function seekPlayback(nextTime: number) {
    if (!isHost || !youtubePlayerRef.current) return;
    const wasPlaying = playerState === YOUTUBE_PLAYER_STATE.PLAYING;
    suppressPlaybackCallbacks();
    youtubePlayerRef.current.seekTo(nextTime);
    if (wasPlaying) youtubePlayerRef.current.play();
    setCurrentTime(nextTime);
    setPlayerState(
      wasPlaying ? YOUTUBE_PLAYER_STATE.PLAYING : YOUTUBE_PLAYER_STATE.PAUSED,
    );
    emitWithError("video:seek", {
      roomId,
      currentTime: nextTime,
      isPlaying: wasPlaying,
    });
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    emitWithError("chat:message", { roomId, body: message });
    setMessage("");
  }

  function emitWithError(event: string, payload: object) {
    socket.emit(event, payload, (result: SocketAck) => {
      setError(result.ok ? "" : result.error ?? "Something went wrong.");
    });
  }

  function leaveRoom() {
    socket.emit("room:leave", { roomId }, () => navigate("/"));
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (error && !room) return <NotInRoom error={error} />;
  if (!room) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream text-ink">
        <p className="rounded-full border-2 border-ink bg-corn px-5 py-3 font-black uppercase tracking-wider shadow-hard">
          Joining room {roomId}…
        </p>
      </main>
    );
  }

  const visibleMessages = room.chatMessages.filter(
    (item) => item.type === "user",
  );

  return (
    <main className="room-page min-h-screen bg-cream p-3 text-ink sm:p-6 lg:grid lg:place-items-center lg:p-10">
      <section className="watch-window mx-auto w-full max-w-[1380px]">
        <div className="browser-bar">
          <div className="flex items-center gap-2">
              <span className="browser-dot bg-tomato" />
              <span className="browser-dot bg-corn" />
              <span className="browser-dot bg-cream" />
          </div>
          <button className="browser-address" onClick={copyInvite}>
            <span className="h-2 w-2 rounded-full bg-white/25" />
            <span>{copied ? "Invite link copied" : `popcorn.party/${roomId}`}</span>
          </button>
          <button aria-label="More options" className="browser-more">
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="watch-body">
          <div
            className={`video-stage ${hasVideo ? "viewing-mode" : ""} ${showStageChrome ? "chrome-visible" : "chrome-hidden"}`}
            onFocusCapture={revealStageChrome}
            onPointerDown={revealStageChrome}
            onPointerEnter={revealStageChrome}
            onPointerMove={revealStageChrome}
          >
            <div className="viewing-chrome absolute left-5 top-5 z-30 flex items-center gap-3 sm:left-8 sm:top-7">
              <button
                className="room-brand"
                onClick={() => navigate("/")}
                type="button"
              >
                popcorn
              </button>
              <span className="live-pill">
                <Radio size={13} /> Live
              </span>
            </div>

            <div className="viewing-chrome absolute right-5 top-5 z-40 flex items-center gap-2 sm:right-8 sm:top-7">
              {isHost && (
                <button
                  aria-label="Set YouTube video"
                  className="glass-button"
                  onClick={() => setShowVideoInput((current) => !current)}
                >
                  <Link2 size={17} />
                  <span className="hidden sm:inline">Set video</span>
                </button>
              )}
              <button className="glass-button" onClick={copyInvite}>
                <Copy size={17} />
                <span className="hidden sm:inline">
                  {copied ? "Copied" : "Invite"}
                </span>
              </button>
            </div>

            {showVideoInput && (
              <form className="video-link-popover" onSubmit={setYouTubeVideo}>
                <Link2 className="shrink-0 text-ink/50" size={18} />
                <input
                  autoFocus
                  disabled={!isHost}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="Paste a YouTube link"
                  value={videoUrl}
                />
                <button type="submit">Load</button>
              </form>
            )}

            {room.video.type === "youtube" && room.video.source ? (
              <YouTubePlayer
                key={room.video.source}
                onError={handleYouTubeError}
                onReady={handleYouTubeReady}
                onStateChange={handleYouTubeStateChange}
                ref={youtubePlayerRef}
                videoId={room.video.source}
              />
            ) : (
              <div className="empty-stage">
                <div className="empty-stage-orb">🍿</div>
                <h1>Tonight&apos;s watch party</h1>
                <p>
                  {isHost
                    ? "Choose a YouTube video to get everyone watching."
                    : "The host is choosing the feature presentation."}
                </p>
              </div>
            )}

            <div className="viewing-chrome stage-shade" />

            {showChat && (
              <div className="chat-overlay persistent-overlay">
                <div className="chat-overlay-messages">
                  {visibleMessages.length === 0 ? (
                    <p className="text-sm text-white/55">
                      The room is quiet. Say hello.
                    </p>
                  ) : (
                    visibleMessages.slice(-3).map((item) => (
                      <div className="overlay-message" key={item.id}>
                        <span className="message-avatar">
                          {item.senderName.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <p>{item.senderName}</p>
                          <span>{item.body}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form className="overlay-chat-form" onSubmit={sendMessage}>
                  <input
                    maxLength={500}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Message the room…"
                    value={message}
                  />
                  <button aria-label="Send message">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            <div className="viewing-chrome stage-title">
              <p className="text-xs font-black uppercase tracking-[.2em] text-corn">
                Now watching
              </p>
              <h1>Room {roomId}</h1>
              <p className="mt-2 text-sm font-bold text-white/70">
                {room.users.length} {room.users.length === 1 ? "friend" : "friends"}{" "}
                watching together
                {hasVideo && ` · ${getPlayerStateLabel(playerState)}`}
              </p>
            </div>

            <div className="viewing-chrome stage-controls">
              {hasVideo && (
                <button
                  aria-label={
                    playerState === YOUTUBE_PLAYER_STATE.PLAYING
                      ? "Pause video"
                      : "Play video"
                  }
                  className="round-control active"
                  disabled={!isHost || !playerReady}
                  onClick={togglePlayback}
                >
                  {playerState === YOUTUBE_PLAYER_STATE.PLAYING ? (
                    <Pause size={20} />
                  ) : (
                    <Play fill="currentColor" size={20} />
                  )}
                </button>
              )}
              <button
                aria-label="Toggle chat"
                className={`round-control ${showChat ? "active" : ""}`}
                onClick={() => {
                  setShowChat((current) => !current);
                  revealStageChrome();
                }}
              >
                <MessageCircle size={20} />
              </button>
              {me?.voiceStatus === "disconnected" ? (
                <button
                  aria-label="Join voice"
                  className="round-control"
                  onClick={() => emitWithError("voice:join", { roomId })}
                >
                  <Mic size={20} />
                </button>
              ) : (
                <button
                  aria-label={me?.voiceStatus === "muted" ? "Unmute" : "Mute"}
                  className={`round-control ${me?.voiceStatus !== "muted" ? "active" : ""}`}
                  onClick={() =>
                    emitWithError(
                      me?.voiceStatus === "muted" ? "voice:unmute" : "voice:mute",
                      { roomId },
                    )
                  }
                >
                  {me?.voiceStatus === "muted" ? (
                    <MicOff size={20} />
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
              )}
              <button
                aria-label={cameraStream ? "Turn camera off" : "Turn camera on"}
                className={`round-control ${cameraStream ? "active" : ""}`}
                onClick={toggleCamera}
              >
                {cameraStream ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>
              <div className="reaction-menu">
                <button aria-label="Send reaction" className="round-control active">
                  <Hand size={20} />
                </button>
                <div className="reaction-options">
                  {reactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() =>
                        emitWithError("reaction:send", { roomId, emoji })
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hasVideo && (
              <div className="viewing-chrome playback-scrubber">
                <span>{formatTime(currentTime)}</span>
                <input
                  aria-label="Seek video"
                  disabled={!isHost || !playerReady}
                  max={Math.max(duration, 1)}
                  min="0"
                  onChange={(event) => seekPlayback(Number(event.target.value))}
                  step="1"
                  type="range"
                  value={Math.min(currentTime, Math.max(duration, 1))}
                />
                <span>{formatTime(duration)}</span>
              </div>
            )}

            <button aria-label="Leave room" className="viewing-chrome leave-control" onClick={leaveRoom}>
              <X size={22} />
            </button>

            {floating.map((reaction, index) => (
              <span
                className="reaction-float"
                key={reaction.id}
                style={{ left: `${20 + (index % 5) * 15}%` }}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>

          <div className="participant-strip">
            <div className="flex min-w-max items-center gap-4 sm:gap-5">
              {room.users.map((user, index) => (
                <div className="participant" key={user.id}>
                  <div className={`participant-avatar avatar-color-${index % 6}`}>
                    {user.id === socket.id && cameraStream ? (
                      <video
                        autoPlay
                        className="participant-video"
                        muted
                        playsInline
                        ref={localVideoRef}
                      />
                    ) : (
                      user.displayName.slice(0, 2).toUpperCase()
                    )}
                    <span className="participant-status">
                      {user.videoStatus === "connected" ? (
                        <Camera size={12} />
                      ) : user.voiceStatus === "muted" ? (
                        <MicOff size={12} />
                      ) : (
                        <Mic size={12} />
                      )}
                    </span>
                  </div>
                  <span className="participant-name">
                    {user.id === socket.id ? "You" : user.displayName}
                  </span>
                  {user.isHost && <Crown className="text-tomato" size={14} />}
                </div>
              ))}
              <button className="participant-add" onClick={copyInvite}>
                +{Math.max(1, 8 - room.users.length)}
              </button>
            </div>
          </div>
        </div>
      </section>
      {error && <p className="mt-4 text-center text-sm font-black text-tomato">{error}</p>}
    </main>
  );
}

function getPlayerStateLabel(state: YouTubePlayerState): string {
  switch (state) {
    case YOUTUBE_PLAYER_STATE.PLAYING:
      return "Playing";
    case YOUTUBE_PLAYER_STATE.PAUSED:
      return "Paused";
    case YOUTUBE_PLAYER_STATE.BUFFERING:
      return "Buffering";
    case YOUTUBE_PLAYER_STATE.ENDED:
      return "Ended";
    default:
      return "Ready";
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function NotInRoom({ error }: { error: string }) {
  const navigate = useNavigate();
  return (
    <main className="grid min-h-screen place-items-center bg-cream p-6 text-center text-ink">
      <div className="max-w-xl rounded-[2rem] border-4 border-ink bg-corn p-10 shadow-hard-lg">
        <p className="font-display text-5xl leading-none tracking-[-.06em]">No screening here.</p>
        <p className="mt-4 font-bold text-ink/65">{error}</p>
        <button className="button-primary mx-auto mt-8" onClick={() => navigate("/")}>
          Back home
        </button>
      </div>
    </main>
  );
}

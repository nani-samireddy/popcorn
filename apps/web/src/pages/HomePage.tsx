import { ArrowRight, MessageCircle, Mic2, Play, Sparkles, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SocketAck } from "@popcorn/shared";
import { socket } from "../lib/socket";

export function HomePage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(
    localStorage.getItem("popcorn:name") ?? "",
  );
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function rememberName() {
    localStorage.setItem("popcorn:name", displayName.trim());
  }

  function createRoom() {
    if (!displayName.trim()) {
      setError("Add your display name first.");
      return;
    }
    setBusy(true);
    setError("");
    socket.connect();
    socket.emit(
      "room:create",
      { displayName },
      (result: SocketAck<{ roomId: string }>) => {
        setBusy(false);
        if (!result.ok || !result.data) {
          setError(result.error ?? "Could not create the room.");
          return;
        }
        rememberName();
        navigate(`/room/${result.data.roomId}`);
      },
    );
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || !roomId.trim()) {
      setError("Add your name and a room code.");
      return;
    }
    rememberName();
    navigate(`/room/${roomId.trim().toUpperCase()}`);
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <span className="rounded-full border-2 border-ink px-4 py-2 text-xs font-black uppercase tracking-widest">
          Open source
        </span>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-20">
        <div>
          <div className="mb-6 inline-flex rotate-[-2deg] items-center gap-2 rounded-full bg-corn px-4 py-2 text-sm font-black uppercase tracking-wide shadow-hard">
            <Sparkles size={16} /> Your couch, now multiplayer
          </div>
          <h1 className="max-w-3xl font-display text-6xl leading-[.92] tracking-[-.07em] sm:text-8xl">
            Good movies.
            <br />
            <span className="text-tomato">Better company.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-semibold leading-relaxed text-ink/70">
            Start a room, share the code, and keep every play, pause, message,
            and reaction together.
          </p>
          <div className="mt-8 max-w-lg space-y-3">
            <label className="label" htmlFor="display-name">Your display name</label>
            <input
              id="display-name"
              className="input"
              maxLength={32}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="What should friends call you?"
              value={displayName}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="button-primary" disabled={busy} onClick={createRoom}>
                <Play fill="currentColor" size={18} /> Create a room
              </button>
              <form className="flex gap-2" onSubmit={joinRoom}>
                <input
                  aria-label="Room code"
                  className="input min-w-0 uppercase"
                  maxLength={12}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder="ROOM CODE"
                  value={roomId}
                />
                <button aria-label="Join room" className="button-square" type="submit">
                  <ArrowRight />
                </button>
              </form>
            </div>
            {error && <p className="text-sm font-bold text-tomato">{error}</p>}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-corn" />
          <div className="relative rotate-2 rounded-[2rem] border-4 border-ink bg-ink p-4 shadow-hard-lg">
            <div className="aspect-video rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#ed5038,#461b18_70%)] p-6 text-cream">
              <div className="flex h-full flex-col justify-between">
                <span className="w-fit rounded-full bg-cream/15 px-3 py-1 text-xs font-black uppercase tracking-widest">
                  Live with 4 friends
                </span>
                <div>
                  <p className="font-display text-3xl leading-none">Friday night, perfectly synced.</p>
                  <div className="mt-4 h-2 rounded-full bg-cream/20">
                    <div className="h-full w-2/3 rounded-full bg-corn" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-wider text-cream">
              <span className="rounded-xl bg-white/10 p-3">Play</span>
              <span className="rounded-xl bg-white/10 p-3">React</span>
              <span className="rounded-xl bg-white/10 p-3">Talk</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y-4 border-ink bg-corn">
        <div className="mx-auto grid max-w-6xl divide-y-2 divide-ink/20 px-5 sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
          <Feature icon={<Users />} title="One shared room" text="Invite friends with a simple room code." />
          <Feature icon={<MessageCircle />} title="Live chat" text="Commentary is half the movie." />
          <Feature icon={<Mic2 />} title="Voice ready" text="Voice status and signaling are built in." />
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return <span className="font-display text-2xl tracking-[-.08em]">POPCORN<span className="text-tomato">.</span></span>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4 py-8 sm:px-6">
      <span className="mt-1">{icon}</span>
      <div><h2 className="font-black">{title}</h2><p className="mt-1 text-sm font-semibold text-ink/65">{text}</p></div>
    </div>
  );
}

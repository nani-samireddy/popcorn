import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream p-6 text-center text-ink">
      <div className="relative max-w-xl rounded-[2rem] border-4 border-ink bg-corn p-10 shadow-hard-lg sm:p-14">
        <span className="absolute -right-5 -top-7 rotate-12 text-6xl">🍿</span>
        <p className="font-display text-8xl leading-none text-tomato">404</p>
        <h1 className="mt-4 text-2xl font-black">
          This screening room does not exist.
        </h1>
        <p className="mt-3 font-semibold text-ink/60">
          The credits rolled, or maybe the link took a wrong turn.
        </p>
        <Link className="button-primary mx-auto mt-8 w-fit" to="/">Back home</Link>
      </div>
    </main>
  );
}

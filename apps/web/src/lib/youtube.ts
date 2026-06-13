export function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] ?? null;
      return url.searchParams.get("v");
    }
  } catch {
    return /^[\w-]{11}$/.test(value) ? value : null;
  }
  return null;
}

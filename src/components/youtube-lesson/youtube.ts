// YouTube links and ids. Pure: no React and no Node imports.

// A YouTube video id: 11 letters, digits, "-" or "_".
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// The hosts a YouTube video link can be on.
const YOUTUBE_HOSTS = ["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"];

// The video id of a YouTube link, or the id itself, or "" when it is neither.
// Accepts:
//   dQw4w9WgXcQ                                  a plain id
//   https://www.youtube.com/watch?v=dQw4w9WgXcQ  (other query parts are fine)
//   https://youtu.be/dQw4w9WgXcQ?t=42
//   https://www.youtube.com/embed/dQw4w9WgXcQ    also on youtube-nocookie.com
//   https://www.youtube.com/shorts/dQw4w9WgXcQ   and /live/ and /v/
// A link without "https://" ("youtu.be/...") works too.
export function youtubeIdFrom(urlOrId: string) {
  const value = urlOrId.trim();
  if (VIDEO_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") {
    id = parts[0] ?? "";
  } else if (YOUTUBE_HOSTS.includes(host)) {
    if (parts[0] === "watch") id = url.searchParams.get("v") ?? "";
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? "";
  }
  return VIDEO_ID.test(id) ? id : "";
}

// The privacy-enhanced embed address of a video: youtube-nocookie.com sets no
// cookies until the visitor plays the video. `rel=0` keeps the suggestions at
// the end to the same channel. `start` is in whole seconds.
export function youtubeEmbedUrl(videoId: string, options: { start?: number } = {}) {
  const params = new URLSearchParams({ rel: "0" });
  if (options.start && options.start > 0) params.set("start", String(Math.floor(options.start)));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}

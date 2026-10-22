import { youtubeEmbedUrl, youtubeIdFrom } from "./youtube";
import styles from "./YouTubeLesson.module.css";

// One YouTube video in a 16:9 box, through YouTube's privacy-enhanced embed
// (youtube-nocookie.com: no cookies until the video is played). The player
// is only loaded when it comes near the screen (loading="lazy").
//
// The video must be "unlisted" on YouTube, not "private": a private video
// only plays for the YouTube accounts it is shared with, so everyone else
// sees an error in the player. An unlisted video plays for anyone who has
// the link, and does not show up in search or on the channel. That is
// "hidden", not "secret": the page decides who gets to see the player.
//
// The site's Content Security Policy, if it has one, must allow
// `frame-src https://www.youtube-nocookie.com`. YouTube also needs to see
// where it is embedded (the Referer header), so the iframe asks for
// "strict-origin-when-cross-origin" (the browsers' default) even when the
// page sets a stricter policy.

export type YouTubePlayerTexts = {
  // Shown instead of the player when `video` is not a YouTube link or id.
  invalid: string;
};

const DEFAULT_TEXTS: YouTubePlayerTexts = {
  invalid: "This video link is not valid.",
};

export type YouTubePlayerProps = {
  // A YouTube video id or any YouTube link to it (see youtubeIdFrom).
  video: string;
  // The accessible name of the player, e.g. the lesson's title.
  title: string;
  // Start at this second.
  start?: number;
  texts?: Partial<YouTubePlayerTexts>;
  className?: string;
};

export default function YouTubePlayer({ video, title, start, texts, className }: YouTubePlayerProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const id = youtubeIdFrom(video);
  const boxClass = className ? `${styles.player} ${className}` : styles.player;

  if (!id) {
    return (
      <div className={`${boxClass} ${styles.invalid}`} role="note">
        {t.invalid}
      </div>
    );
  }

  return (
    <div className={boxClass}>
      <iframe
        src={youtubeEmbedUrl(id, { start })}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

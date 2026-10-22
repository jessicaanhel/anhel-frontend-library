"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the ENVELOPE OPENING.
// The first screen guests see: a closed envelope; one tap plays a short video
// with background music, then the entry blurs away to reveal the invitation
// page. It also owns the floating music on/off button that stays on screen
// for the rest of the site.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import type { RenderImage } from "../../types";
import styles from "./VideoEntry.module.css";

// Adapted from angela-simon-wedding/components/invitation/VideoEntry.tsx.

type Stage = "closed" | "playing" | "dissolving" | "entered";

export type VideoEntryTexts = {
  // Shown under the closed image, gently bobbing.
  tapToOpen: string;
  // Accessible name of the big clickable entry button.
  openLabel: string;
  // Accessible names of the floating music button (it describes the action).
  musicOn: string;
  musicOff: string;
};

export type VideoEntryTimings = {
  // Fraction of the video's duration (0-1) at which the dissolve starts. The
  // video keeps playing underneath while the overlay fades away.
  dissolveAt: number;
  // Seconds the overlay takes to blur+fade away. Deliberately slow by
  // default: a cross-dissolve, not a cut.
  dissolveDuration: number;
  // The page's own content stays invisible for the first part of the
  // dissolve (so nothing feels "already there" underneath), then fades in on
  // top of the now-revealed background. The defaults finish just after the
  // overlay itself has cleared, so text visibly settles onto the background
  // rather than popping in instantly.
  textRevealDelay: number;
  textRevealDuration: number;
};

export type VideoEntryProps = {
  // The real page. It is mounted underneath the overlay as soon as the
  // dissolve starts, so it is already in place when the overlay clears.
  children: ReactNode;
  // Static illustration shown before the tap (not a video frame).
  closedImageSrc: string;
  closedImageAlt?: string;
  videoSrc: string;
  // Optional looping background music, started by the same tap as the video.
  // Leave it out for no music and no floating music button.
  audioSrc?: string;
  // 0-1. Background music is meant to sit under the page, not dominate it.
  musicVolume?: number;
  texts?: Partial<VideoEntryTexts>;
  timings?: Partial<VideoEntryTimings>;
  // Optional wrapper around the page (e.g. a "paper panel" component). It is
  // rendered once and stays mounted from the dissolve onwards.
  wrapper?: ComponentType<{ children: ReactNode }>;
  // Must match the video's own canvas colour so there is no visible box
  // around the video while it plays.
  backgroundColor?: string;
  // Aspect ratio of the box that holds both the closed image and the video.
  // See the README: matching it to the part of the video frame that actually
  // has content lets object-fit: cover crop away empty margins, and the
  // closed image should have (almost) the same ratio so nothing jumps when
  // playback starts.
  aspectRatio?: string;
  // CSS width of that box.
  width?: string;
  // Swap the default <img> for your own image component (e.g. next/image).
  renderClosedImage?: RenderImage;
};

const DEFAULT_TEXTS: VideoEntryTexts = {
  tapToOpen: "Tap to open",
  openLabel: "Open the invitation",
  musicOn: "Turn music on",
  musicOff: "Turn music off",
};

const DEFAULT_TIMINGS: VideoEntryTimings = {
  dissolveAt: 0.5,
  dissolveDuration: 1.8,
  textRevealDelay: 1.0,
  textRevealDuration: 1.0,
};

function defaultRenderImage({ src, alt, className, priority }: Parameters<RenderImage>[0]) {
  return <img src={src} alt={alt} className={className} fetchPriority={priority ? "high" : "auto"} />;
}

// Entry screen backed by a real video. Shows a clean static illustration
// first (not a video frame); tapping it starts the actual video (and the
// music: starting playback from a click counts as a user gesture, so
// browsers allow audio); partway through it slowly dissolves away to reveal
// the real page, which is already mounted underneath it by then.
//
// The <video> element is kept at the exact same position in the JSX across
// every stage (only the surrounding wrapper's class/animation changes) so
// React never unmounts/remounts it. Otherwise, right as the dissolve
// starts, a freshly-mounted video would reset to its first frame instead of
// staying frozen on the last one it actually played. If you ever see the
// video "flash back" to its start during the fade, check whether a refactor
// introduced a second early-return JSX branch.
//
// The same goes for the <audio> element: it's the first child of the
// returned fragment in every stage, so the background music carries on
// playing (looped) after the entry has dissolved, with the floating button
// as its on/off switch.
//
// The page itself also has one fixed slot (mounted from "dissolving"
// onwards), so it is not remounted when the dissolve finishes either.
export default function VideoEntry({
  children,
  closedImageSrc,
  closedImageAlt = "A closed envelope",
  videoSrc,
  audioSrc,
  musicVolume = 0.5,
  texts,
  timings,
  wrapper: Wrapper,
  backgroundColor = "#ffffff",
  aspectRatio = "16 / 9",
  width = "min(70.5vw, 585px)",
  renderClosedImage = defaultRenderImage,
}: VideoEntryProps) {
  const [stage, setStage] = useState<Stage>("closed");
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const t = { ...DEFAULT_TEXTS, ...texts };
  const timing = { ...DEFAULT_TIMINGS, ...timings };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
  }, [musicVolume]);

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (stage !== "closed") return;
    setStage("playing");
    e.currentTarget.querySelector("video")?.play();
    // Starting the music from the same click as the video above is what
    // makes the browser allow audio: calling .play() from inside a click
    // handler counts as a user gesture. Caught so a blocked or failed
    // play() just leaves the music off (the button shows that).
    audioRef.current?.play().catch(() => {});
  }

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function startDissolve() {
    // Called from both timeupdate and ended; only ever move forward, so a
    // late event can't pull "entered" back to "dissolving".
    setStage((current) => (current === "playing" ? "dissolving" : current));
  }

  const isDissolving = stage === "dissolving";
  const showPage = stage === "dissolving" || stage === "entered";
  const showOverlay = stage !== "entered";

  const page = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: timing.textRevealDelay,
        duration: timing.textRevealDuration,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );

  // `wrapper` should be a stable component (defined at module level, not
  // inline in the parent's render), otherwise React sees a new component
  // type on every render and remounts the whole page.
  let pageSlot: ReactNode = null;
  if (showPage) {
    pageSlot = Wrapper ? <Wrapper>{page}</Wrapper> : page;
  }

  // Custom properties so the CSS module can use the prop values.
  const overlayStyle = {
    "--video-entry-bg": backgroundColor,
    "--video-entry-aspect-ratio": aspectRatio,
    "--video-entry-width": width,
  } as CSSProperties;

  return (
    <>
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          loop
          onPlay={() => setMusicOn(true)}
          onPause={() => setMusicOn(false)}
        />
      ) : null}

      {pageSlot}

      {showOverlay ? (
        <motion.div
          className={isDissolving ? styles.dissolveOverlay : styles.stage}
          style={overlayStyle}
          initial={false}
          animate={isDissolving ? { opacity: 0, filter: "blur(24px)" } : { opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: timing.dissolveDuration, ease: "easeInOut" }}
          onAnimationComplete={() => {
            if (isDissolving) setStage("entered");
          }}
        >
          <button
            type="button"
            className={styles.videoButton}
            onClick={handleClick}
            aria-label={t.openLabel}
            disabled={stage !== "closed"}
          >
            <div className={styles.videoWrap}>
              <video
                className={styles.video}
                src={videoSrc}
                playsInline
                // The dissolve starts partway through (dissolveAt), not once
                // the video finishes: it keeps playing underneath while it
                // fades away. onEnded stays as a fallback in case timeupdate
                // never fires past that point (e.g. a very short video where
                // the granularity of timeupdate events skips over it).
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  if (video.duration && video.currentTime >= video.duration * timing.dissolveAt) {
                    startDissolve();
                  }
                }}
                onEnded={startDissolve}
              />
              {/* Shown until the click: a clean static illustration, not a
                  video frame. The video itself only starts (and becomes
                  visible) once you tap. Opaque, so it fully covers the
                  <video> beneath it (which would otherwise show its own
                  first frame). */}
              {stage === "closed" ? (
                <div className={styles.closedOverlay}>
                  {renderClosedImage({
                    src: closedImageSrc,
                    alt: closedImageAlt,
                    className: styles.closedImage,
                    sizes: "780px",
                    priority: true,
                  })}
                </div>
              ) : null}
            </div>
            {/* Below the image, not overlaid on top of it: a video frame often
                doesn't have enough margin under its subject to fit text
                into legibly. */}
            {stage === "closed" ? (
              <motion.span
                className={styles.tap}
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                {t.tapToOpen}
              </motion.span>
            ) : null}
          </button>
        </motion.div>
      ) : null}

      {audioSrc && stage !== "closed" ? (
        <button
          type="button"
          className={styles.musicToggle}
          onClick={toggleMusic}
          aria-label={musicOn ? t.musicOff : t.musicOn}
          aria-pressed={musicOn}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 9.5v5h3.6L12.5 19V5L7.6 9.5H4z" fill="currentColor" fillOpacity="0.15" />
            {musicOn ? (
              <>
                <path d="M16 9.2a4 4 0 0 1 0 5.6" />
                <path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" />
              </>
            ) : (
              <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
            )}
          </svg>
        </button>
      ) : null}
    </>
  );
}

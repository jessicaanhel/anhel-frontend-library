// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the PHOTO SLIDER in
// the "Our story" section. As you scroll, tilted photos slide up and settle on
// top of each other; each photo is cut to an oval and seen through a floral
// wreath frame (the frame's inside was cut out with tools/cut-frame-interior.mjs).
// ============================================================================

import type { CSSProperties } from "react";
import type { RenderImage } from "../../types";
import styles from "./FramedPhotoStack.module.css";

// Adapted from angela-simon-wedding/components/invitation/PolaroidStack.tsx.
// No "use client" needed: there is no state or effect. The "slide" is
// pure CSS position: sticky, so each photo scrolls up and settles on top of
// the previous one.

export type FramedPhoto = {
  src: string;
  alt: string;
};

export type FramedPhotoStackProps = {
  photos: FramedPhoto[];
  // Decorative frame drawn ON TOP of each photo. Its inside must be
  // transparent so the photo shows through (see tools/cut-frame-interior.mjs).
  frameSrc: string;
  // The frame image's own width / height, so it renders edge to edge with
  // no letterboxing. The default matches assets/framed-photo-stack/floral-frame.png.
  frameAspectRatio?: string;
  // Clips each photo to the frame's opening, as fractions of the frame's
  // canvas. The cut-frame-interior tool prints a suggested value. The
  // default matches floral-frame.png, trimmed in a little further than the
  // measured hole so the photo sits just inside the vine instead of running
  // underneath it.
  photoClipPath?: string;
  // How far from the top of the viewport each photo sticks while scrolling.
  stickyTop?: string;
  // CSS width of one framed photo.
  itemWidth?: string;
  // Scroll distance between photos (how long each one stays on top alone).
  itemGap?: string;
  // Per-photo tilt (degrees) and sideways shift (px). Must be deterministic
  // (no Math.random), so the server and the browser render the same layout
  // and it doesn't reshuffle on every visit.
  rotationFor?: (index: number) => number;
  offsetFor?: (index: number) => number;
  className?: string;
  // Swap the default <img> for your own image component (e.g. next/image).
  renderImage?: RenderImage;
};

// Spread out "randomly" between -12 and +12 degrees.
function defaultRotationFor(index: number) {
  return ((index * 41) % 25) - 12;
}

// Spread out "randomly" between -30 and +30 px.
function defaultOffsetFor(index: number) {
  return ((index * 67) % 61) - 30;
}

function defaultRenderImage({ src, alt, className }: Parameters<RenderImage>[0]) {
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

// Each photo sits behind the frame image, clipped to an oval that matches
// the frame's own interior opening (photoClipPath). The frame's solid fill
// has to be removed from the source image for exactly this, see
// tools/cut-frame-interior.mjs if the frame is ever replaced.
export default function FramedPhotoStack({
  photos,
  frameSrc,
  frameAspectRatio = "1421 / 2000",
  photoClipPath = "ellipse(43% 33% at 50% 49%)",
  stickyTop = "110px",
  itemWidth = "min(280px, 72vw)",
  itemGap = "190px",
  rotationFor = defaultRotationFor,
  offsetFor = defaultOffsetFor,
  className,
  renderImage = defaultRenderImage,
}: FramedPhotoStackProps) {
  const stackStyle = {
    "--photo-stack-frame-ratio": frameAspectRatio,
    "--photo-stack-clip-path": photoClipPath,
    "--photo-stack-sticky-top": stickyTop,
    "--photo-stack-item-width": itemWidth,
    "--photo-stack-gap": itemGap,
  } as CSSProperties;

  const stackClassName = className ? `${styles.stack} ${className}` : styles.stack;

  return (
    <div className={stackClassName} style={stackStyle}>
      {photos.map((photo, index) => (
        <div
          key={photo.src}
          className={styles.item}
          style={{
            transform: `translateX(${offsetFor(index)}px) rotate(${rotationFor(index)}deg)`,
          }}
        >
          <div className={styles.frameWrap}>
            <div className={styles.photo}>
              {renderImage({
                src: photo.src,
                alt: photo.alt,
                className: styles.photoImage,
                sizes: "320px",
                priority: false,
              })}
            </div>
            {renderImage({
              src: frameSrc,
              alt: "",
              className: styles.frameImage,
              sizes: "320px",
              priority: false,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

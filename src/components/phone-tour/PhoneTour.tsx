"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE'S PORTFOLIO PAGE (wedding-panel-portfolio) AS:
// "A look inside the panel": a row of phone screenshots with captions that you
// swipe through (arrows on a computer).
// ============================================================================

import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "../../icons";
import type { RenderImage } from "../../types";
import PhoneFrame from "./PhoneFrame";
import styles from "./PhoneTour.module.css";

// Adapted from the tour in wedding-panel-portfolio/index.html, styles.css and script.js.
//
// A horizontal row of phone screenshots that snap into place as you swipe or
// scroll. On a computer with a mouse, two round arrows scroll two screens at
// a time (they stay hidden on touch screens, where swiping is natural).
// The row can be reached with the keyboard (Tab, then the arrow keys).

export type PhoneTourScreen = {
  src: string;
  alt: string;
  // Shown under the phone.
  caption?: ReactNode;
};

export type PhoneTourProps = {
  screens: PhoneTourScreen[];
  // CSS width of each phone. Default "250px".
  screenWidth?: string;
  // Width / height of the screens. Default "390 / 844".
  aspectRatio?: string;
  // Space between the phones. Default "22px".
  gap?: string;
  // Padding at both ends of the row, e.g. to line it up with the page's text column.
  // Default "20px".
  edge?: string;
  // The accessible name of the row. Default "Screenshots".
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  renderImage?: RenderImage;
  className?: string;
};

export default function PhoneTour({
  screens,
  screenWidth = "250px",
  aspectRatio = "390 / 844",
  gap = "22px",
  edge = "20px",
  label = "Screenshots",
  previousLabel = "Previous screen",
  nextLabel = "Next screen",
  renderImage,
  className,
}: PhoneTourProps) {
  const track = useRef<HTMLDivElement>(null);

  // Scroll two screens in a direction (-1 = back, 1 = forward).
  function scroll(direction: -1 | 1) {
    const element = track.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>(`.${styles.card}`);
    const gapPixels = parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gapPixels : 280;
    element.scrollBy({ left: direction * step * 2, behavior: "smooth" });
  }

  const tourStyle = { "--tour-card-width": screenWidth, "--tour-gap": gap, "--tour-edge": edge } as CSSProperties;

  return (
    <div className={className ? `${styles.tour} ${className}` : styles.tour} style={tourStyle}>
      <div className={styles.arrows}>
        <button type="button" className={styles.arrow} aria-label={previousLabel} onClick={() => scroll(-1)}>
          <ArrowLeft size={18} />
        </button>
        <button type="button" className={styles.arrow} aria-label={nextLabel} onClick={() => scroll(1)}>
          <ArrowRight size={18} />
        </button>
      </div>
      <div className={styles.track} ref={track} tabIndex={0} role="list" aria-label={label}>
        {screens.map((screen) => (
          <figure className={styles.card} role="listitem" key={screen.src}>
            <PhoneFrame src={screen.src} alt={screen.alt} width={screenWidth} aspectRatio={aspectRatio} renderImage={renderImage} />
            {screen.caption ? <figcaption>{screen.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </div>
  );
}

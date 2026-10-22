// ============================================================================
// USED ON THE WEDDING WEBSITE'S PORTFOLIO PAGE (wedding-panel-portfolio) AS:
// the dark phone outline around every screenshot of the site and the panel.
// ============================================================================

import type { CSSProperties, ReactNode } from "react";
import type { RenderImage } from "../../types";
import styles from "./PhoneTour.module.css";

// Adapted from the .phone rules in wedding-panel-portfolio/styles.css.
// No "use client" needed: there is no state or effect.
//
// A phone-shaped frame (dark bezel, rounded corners) around a screenshot
// (`src` and `alt`) or around anything else (`children`, e.g. a live
// component). The screen has a fixed shape (`aspectRatio`), so every frame in
// a row is equally tall; the screenshot is cropped to fill it.

export type PhoneFrameProps = {
  src?: string;
  alt?: string;
  // Shown instead of the screenshot.
  children?: ReactNode;
  // CSS width of the whole phone. Default "260px".
  width?: string;
  // Width / height of the screen. Default "390 / 844" (a modern phone).
  aspectRatio?: string;
  // Swap the default <img> for your own image component (e.g. next/image).
  renderImage?: RenderImage;
  className?: string;
};

function defaultRenderImage({ src, alt, className }: Parameters<RenderImage>[0]) {
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export default function PhoneFrame({ src, alt = "", children, width = "260px", aspectRatio = "390 / 844", renderImage = defaultRenderImage, className }: PhoneFrameProps) {
  const frameStyle = { "--phone-width": width, "--phone-ratio": aspectRatio } as CSSProperties;

  return (
    <div className={className ? `${styles.phone} ${className}` : styles.phone} style={frameStyle}>
      <div className={styles.screen}>
        {children ?? (src ? renderImage({ src, alt, className: styles.screenImage, sizes: width, priority: false }) : null)}
      </div>
    </div>
  );
}

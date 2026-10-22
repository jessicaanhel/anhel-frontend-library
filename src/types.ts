import type { ReactNode } from "react";

// Shared by every component that shows an image, so a consuming app can swap
// the default plain <img> for its own image component (e.g. next/image with
// `fill`). The component always places the image inside a positioned box
// that it should fill completely; `className` carries the object-fit styling.
export type ImageRenderProps = {
  src: string;
  alt: string;
  className: string;
  // Width the image is roughly displayed at, for next/image's `sizes`.
  sizes: string;
  // True for the first image the visitor sees (next/image's `priority`).
  priority: boolean;
};

export type RenderImage = (props: ImageRenderProps) => ReactNode;

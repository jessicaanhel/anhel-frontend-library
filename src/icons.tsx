import type { SVGProps } from "react";

// Small line icons shared by the panel components (login card, task list,
// board widgets). Each icon is one SVG path drawn in the current text colour,
// so it follows the surrounding text.
// Adapted from angela-simon-wedding/components/panel/icons.tsx (only the icons
// the library uses).

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function createIcon(path: string) {
  return function Icon({ size = 24, strokeWidth = 2, ...props }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        viewBox="0 0 24 24"
        width={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
}

export const ArrowUpRight = createIcon("M7 17 17 7M7 7h10v10");
export const Check = createIcon("m5 12 4 4L19 6");
export const ChevronDown = createIcon("m6 9 6 6 6-6");
export const Clock = createIcon("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l-4 2");
export const Plus = createIcon("M12 5v14M5 12h14");
export const Star = createIcon(
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
);
export const Trash = createIcon("M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6");
export const X = createIcon("M18 6 6 18M6 6l12 12");
export const ArrowDown = createIcon("M12 5v14M19 12l-7 7-7-7");
export const ArrowLeft = createIcon("M19 12H5M12 19l-7-7 7-7");
export const ArrowRight = createIcon("M5 12h14M12 5l7 7-7 7");
export const ArrowUp = createIcon("M12 19V5M5 12l7-7 7 7");
export const Bell = createIcon("M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4");
export const Copy = createIcon("M8 8h12v12H8zM4 16V4h12");
export const Eraser = createIcon(
  "M7 21h10M5.5 13.5l6-6a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-6 6a2 2 0 0 1-3 0l-3-3a2 2 0 0 1 0-3"
);
export const FileIcon = createIcon("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6");
export const ImageIcon = createIcon("M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01");
export const LinkIcon = createIcon(
  "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
);
export const LogOut = createIcon("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9");
export const Pencil = createIcon("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z");
export const Plane = createIcon(
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
);
export const RefreshCw = createIcon("M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5");
export const Search = createIcon("M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0");
export const Share = createIcon("M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13");
export const Smile = createIcon("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01");
export const TypeIcon = createIcon("M4 7V4h16v3M9 20h6M12 4v16");
export const Undo = createIcon("M3 7v6h6M3 13a9 9 0 1 0 3-7");
export const BookOpen = createIcon("M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z");
export const Play = createIcon("M7 4.5v15l12-7.5z");

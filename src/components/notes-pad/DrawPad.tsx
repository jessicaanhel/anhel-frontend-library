"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the drawing pad inside
// a note of the private boards (pen, colours, eraser, undo).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Pencil, Trash, Undo } from "../../icons";
import { DRAW_HEIGHT, DRAW_WIDTH, type Stroke } from "./notes";
import styles from "./NotesPad.module.css";

// Adapted from angela-simon-wedding/components/panel/DrawPad.tsx.
//
// A drawing pad: pen in a few colours and sizes, an eraser, undo. It works
// with a finger, a pen or a mouse. The drawing is kept as strokes (lists of
// points in a fixed 1000 x 600 space), which is small enough to save as text
// and is redrawn sharply at any size. "Draw" must be switched on to draw, so a
// finger can still scroll the page while the pad is only being looked at.

export type DrawPadTexts = {
  draw: string;
  drawingOn: string;
  penColour: (colour: string) => string;
  penSize: (size: number) => string;
  eraser: string;
  undo: string;
  clear: string;
};

const DEFAULT_TEXTS: DrawPadTexts = {
  draw: "Draw",
  drawingOn: "Drawing on",
  penColour: (colour) => `Pen colour ${colour}`,
  penSize: (size) => `Pen size ${size}`,
  eraser: "Eraser",
  undo: "Undo",
  clear: "Clear the drawing",
};

export const DEFAULT_PEN_COLOURS = ["#2d302b", "#b66a4f", "#c9a45b", "#6f8068", "#4f7bb0", "#9a7590", "#d9758a"];
const DEFAULT_PEN_SIZES = [3, 8, 18];

export type DrawPadProps = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  colours?: string[];
  sizes?: number[];
  texts?: Partial<DrawPadTexts>;
};

function paint(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const scale = canvas.width / DRAW_WIDTH;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of strokes) {
    // An eraser stroke removes what is under it instead of painting.
    context.globalCompositeOperation = stroke.e ? "destination-out" : "source-over";
    context.strokeStyle = stroke.c;
    context.fillStyle = stroke.c;
    context.lineWidth = stroke.w;
    const points = stroke.p;
    if (points.length === 2) {
      // A single tap: a dot.
      context.beginPath();
      context.arc(points[0], points[1], stroke.w / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(points[0], points[1]);
    // Smooth the line through the midpoints of neighbouring points.
    for (let i = 2; i < points.length - 2; i += 2) {
      context.quadraticCurveTo(points[i], points[i + 1], (points[i] + points[i + 2]) / 2, (points[i + 1] + points[i + 3]) / 2);
    }
    context.lineTo(points[points.length - 2], points[points.length - 1]);
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";
}

export default function DrawPad({ strokes, onChange, colours = DEFAULT_PEN_COLOURS, sizes = DEFAULT_PEN_SIZES, texts }: DrawPadProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [colour, setColour] = useState(colours[0]);
  const [size, setSize] = useState(sizes[Math.min(1, sizes.length - 1)]);
  const [erasing, setErasing] = useState(false);

  const redraw = useCallback(
    (extra?: Stroke | null) => {
      if (canvas.current) paint(canvas.current, extra ? [...strokes, extra] : strokes);
    },
    [strokes]
  );
  useEffect(() => redraw(), [redraw]);

  // Pointer position in drawing units.
  function position(event: ReactPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(((event.clientX - box.left) / box.width) * DRAW_WIDTH),
      Math.round(((event.clientY - box.top) / box.height) * DRAW_HEIGHT),
    ];
  }

  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = { c: colour, w: erasing ? size * 2 : size, ...(erasing ? { e: 1 as const } : {}), p: position(event) };
    redraw(current.current);
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = current.current;
    if (!stroke) return;
    const [x, y] = position(event);
    const last = stroke.p.length;
    // Skip points that barely moved: keeps the saved drawing small.
    if (Math.abs(x - stroke.p[last - 2]) + Math.abs(y - stroke.p[last - 1]) < 3) return;
    stroke.p.push(x, y);
    redraw(stroke);
  }

  function end() {
    const stroke = current.current;
    current.current = null;
    if (stroke) onChange([...strokes, stroke]);
  }

  return (
    <div className={styles.drawPad}>
      <div className={styles.drawTools}>
        <button type="button" className={`${styles.drawSwitch} ${drawing ? styles.on : ""}`} onClick={() => setDrawing(!drawing)} aria-pressed={drawing}>
          <Pencil size={14} /> {drawing ? t.drawingOn : t.draw}
        </button>
        {drawing && (
          <>
            {colours.map((value) => (
              <button
                type="button"
                key={value}
                className={`${styles.drawColour} ${!erasing && colour === value ? styles.on : ""}`}
                style={{ background: value }}
                aria-label={t.penColour(value)}
                onClick={() => {
                  setColour(value);
                  setErasing(false);
                }}
              />
            ))}
            {sizes.map((value) => (
              <button type="button" key={value} className={`${styles.drawSize} ${size === value ? styles.on : ""}`} aria-label={t.penSize(value)} onClick={() => setSize(value)}>
                <i style={{ width: Math.min(16, value + 3), height: Math.min(16, value + 3) }} />
              </button>
            ))}
            <button type="button" className={`${styles.drawIcon} ${erasing ? styles.on : ""}`} aria-label={t.eraser} aria-pressed={erasing} onClick={() => setErasing(!erasing)}>
              <Eraser size={15} />
            </button>
            <button type="button" className={styles.drawIcon} aria-label={t.undo} disabled={strokes.length === 0} onClick={() => onChange(strokes.slice(0, -1))}>
              <Undo size={15} />
            </button>
            <button type="button" className={styles.drawIcon} aria-label={t.clear} disabled={strokes.length === 0} onClick={() => onChange([])}>
              <Trash size={15} />
            </button>
          </>
        )}
      </div>
      <canvas
        ref={canvas}
        className={`${styles.drawCanvas} ${drawing ? styles.active : ""}`}
        // Twice the drawing units: sharp on high-density screens.
        width={DRAW_WIDTH * 2}
        height={DRAW_HEIGHT * 2}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </div>
  );
}

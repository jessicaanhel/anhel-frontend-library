import { useId, type ReactNode } from "react";
import { DRAW_HEIGHT, DRAW_WIDTH, NOTE_COLOURS, type NoteDoc, type Stroke } from "./notes";
import styles from "./NotesPad.module.css";

// A note shown read-only: the same paper, text, drawings, pictures and
// stickers as in the editor, with no buttons and no fields. For a note the
// visitor may only look at, e.g. a mentor's note under a lesson. No state and
// no effects, so it also renders on the server.
//
// Drawings are drawn as SVG from the saved strokes, in the pad's own
// 1000 x 600 space, so they keep their shape and stay sharp at any width.

export type NoteViewTexts = {
  // Shown when the note has nothing in it.
  empty: string;
  // The accessible name of a drawing.
  drawing: string;
};

const DEFAULT_TEXTS: NoteViewTexts = {
  empty: "This note is empty.",
  drawing: "Drawing",
};

export type NoteViewProps = {
  value: NoteDoc;
  // Shown above the blocks, like the title field of the editor.
  title?: string;
  // The paper colour. Default the first of NOTE_COLOURS.
  colour?: string;
  texts?: Partial<NoteViewTexts>;
  className?: string;
};

// The same smoothing as the drawing pad's canvas: a curve through the
// midpoints of neighbouring points, then a straight line to the last point.
function strokePath(points: number[]) {
  let path = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    path += ` Q${points[i]} ${points[i + 1]} ${(points[i] + points[i + 2]) / 2} ${(points[i + 1] + points[i + 3]) / 2}`;
  }
  return `${path} L${points[points.length - 2]} ${points[points.length - 1]}`;
}

function strokeShape(stroke: Stroke, colour: string, key: string) {
  const points = stroke.p;
  // A single tap is a dot.
  if (points.length === 2) return <circle key={key} cx={points[0]} cy={points[1]} r={stroke.w / 2} fill={colour} />;
  return <path key={key} d={strokePath(points)} fill="none" stroke={colour} strokeWidth={stroke.w} strokeLinecap="round" strokeLinejoin="round" />;
}

function Drawing({ strokes, label }: { strokes: Stroke[]; label: string }) {
  // useId keeps the mask ids unique on a page with several drawings; the
  // characters it adds (":" and the like) are not safe inside url(#...).
  const baseId = `draw${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // On the canvas an eraser stroke removes only what was drawn before it;
  // later strokes paint over the erased part again. In SVG that is a mask:
  // everything drawn so far goes into a group masked by the eraser stroke
  // (white shows, black hides), and later strokes come after the group.
  const masks: ReactNode[] = [];
  let layer: ReactNode[] = [];
  strokes.forEach((stroke, index) => {
    if (!stroke.e) {
      layer.push(strokeShape(stroke, stroke.c, `s${index}`));
      return;
    }
    const maskId = `${baseId}-${index}`;
    masks.push(
      <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={DRAW_WIDTH} height={DRAW_HEIGHT}>
        <rect width={DRAW_WIDTH} height={DRAW_HEIGHT} fill="white" />
        {strokeShape(stroke, "black", "e")}
      </mask>
    );
    layer = [
      <g key={`g${index}`} mask={`url(#${maskId})`}>
        {layer}
      </g>,
    ];
  });

  return (
    <svg className={styles.drawingView} viewBox={`0 0 ${DRAW_WIDTH} ${DRAW_HEIGHT}`} role="img" aria-label={label}>
      {masks.length > 0 && <defs>{masks}</defs>}
      {layer}
    </svg>
  );
}

export default function NoteView({ value, title, colour = NOTE_COLOURS[0], texts, className }: NoteViewProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  // Empty text blocks and empty drawings are left out: in the editor they
  // are places to write or draw, here they would only be blank space.
  const blocks = value.blocks.filter((block) => {
    if (block.type === "text") return block.text.trim() !== "";
    if (block.type === "draw") return block.strokes.length > 0;
    return true;
  });

  return (
    <article className={className ? `${styles.view} ${className}` : styles.view} style={{ background: colour }}>
      {title ? <h3 className={styles.viewTitle}>{title}</h3> : null}
      {blocks.length === 0 && <p className={styles.viewEmpty}>{t.empty}</p>}
      <div className={styles.blocks}>
        {blocks.map((block) => {
          if (block.type === "text") {
            return (
              <p className={styles.viewText} key={block.id}>
                {block.text}
              </p>
            );
          }
          if (block.type === "draw") return <Drawing key={block.id} strokes={block.strokes} label={t.drawing} />;
          if (block.type === "image") {
            // A plain <img>: the source is a data URL or a link, which an image optimiser can't help with.
            // eslint-disable-next-line @next/next/no-img-element
            return <img className={styles.image} key={block.id} src={block.src} alt="" loading="lazy" />;
          }
          return (
            <div className={styles.sticker} key={block.id}>
              {block.emoji}
            </div>
          );
        })}
      </div>
    </article>
  );
}

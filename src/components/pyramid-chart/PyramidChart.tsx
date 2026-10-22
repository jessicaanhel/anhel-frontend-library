"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the budget pyramid on
// the Budget page: one layer per category, the biggest at the bottom, with a
// "Planned / Actual" switch.
// ============================================================================

import { useMemo, useState } from "react";
import { pyramidLayers, type PyramidItem } from "./pyramid";
import styles from "./PyramidChart.module.css";

// Adapted from angela-simon-wedding/components/panel/BudgetPyramid.tsx.
//
// A pyramid with one layer per label. The area of a layer is its share of the
// total (see pyramidLayers). Pass `items` for a single pyramid, or two or more
// `views` for the same data seen in different ways (the wedding site's
// "Planned" and "Actual" costs): a switch appears above the pyramid.

export type PyramidView = {
  key: string;
  label: string; // the switch button, and the start of the note under the pyramid
  items: PyramidItem[];
  // Shown instead of the pyramid when this view has nothing to add up.
  emptyText?: string;
};

export type PyramidChartTexts = {
  title: string;
  switchLabel: string; // accessible name of the switch
  chartLabel: string; // accessible name of the drawing
  empty: string;
  unlabelled: string; // the layer of items without a label
  // The line under the pyramid. `target` is 0 when none was given.
  note: (viewLabel: string, total: string, target: string, percent: number) => string;
};

const DEFAULT_TEXTS: PyramidChartTexts = {
  title: "Pyramid",
  switchLabel: "What the pyramid shows",
  chartLabel: "Pyramid chart",
  empty: "Nothing to show yet.",
  unlabelled: "Other",
  note: (viewLabel, total, target, percent) => `${viewLabel ? `${viewLabel} total` : "Total"} ${total}${target ? ` of ${target} (${percent}%)` : ""}.`,
};

export type PyramidChartProps = {
  // One pyramid ...
  items?: PyramidItem[];
  // ... or several views of the data, with a switch (the first is shown first).
  views?: PyramidView[];
  // How a value is written, e.g. (value) => `€${value}`. Default: a rounded number.
  formatValue?: (value: number) => string;
  // A number to compare the total with (e.g. a planned budget): the note
  // under the pyramid then says how much of it the total is. 0 or left out: no comparison.
  target?: number;
  colours?: string[];
  texts?: Partial<PyramidChartTexts>;
  className?: string;
};

const DEFAULT_COLOURS = ["#657760", "#b98e75", "#8f86a8", "#c9ab6b", "#7d9aa6", "#c47f7f", "#9aae8c", "#a08a78", "#6f8f86", "#b5a0c2"];
const WIDTH = 460;
const HEIGHT = 300;

const defaultFormat = (value: number) => Math.round(value).toLocaleString("en-GB");

export default function PyramidChart({
  items,
  views,
  formatValue = defaultFormat,
  target = 0,
  colours = DEFAULT_COLOURS,
  texts,
  className,
}: PyramidChartProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const allViews = useMemo<PyramidView[]>(() => (views && views.length > 0 ? views : [{ key: "all", label: "", items: items ?? [] }]), [views, items]);
  const [chosenKey, setChosenKey] = useState(allViews[0].key);
  const [hovered, setHovered] = useState("");

  // A view that no longer exists (the views changed) falls back to the first.
  const view = allViews.find((candidate) => candidate.key === chosenKey) ?? allViews[0];
  const layers = useMemo(() => pyramidLayers(view.items, t.unlabelled), [view.items, t.unlabelled]);

  const total = layers.reduce((acc, layer) => acc + layer.total, 0);
  const centre = WIDTH / 2;
  const halfWidth = (depth: number) => (WIDTH / 2) * depth;
  const colourOf = (colourIndex: number) => colours[colourIndex % colours.length];

  return (
    <div className={className ? `${styles.pyramid} ${className}` : styles.pyramid}>
      <div className={styles.head}>
        <strong>{t.title}</strong>
        {allViews.length > 1 && (
          <div className={styles.segmented} role="group" aria-label={t.switchLabel}>
            {allViews.map((candidate) => (
              <button
                type="button"
                key={candidate.key}
                className={candidate.key === view.key ? styles.on : ""}
                aria-pressed={candidate.key === view.key}
                onClick={() => setChosenKey(candidate.key)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {layers.length === 0 ? (
        <p className={styles.note}>{view.emptyText ?? t.empty}</p>
      ) : (
        <div className={styles.body}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t.chartLabel} className={styles.svg}>
            {layers.map((layer) => {
              const y1 = layer.top * HEIGHT;
              const y2 = layer.bottom * HEIGHT;
              const points = [
                [centre - halfWidth(layer.top), y1],
                [centre + halfWidth(layer.top), y1],
                [centre + halfWidth(layer.bottom), y2],
                [centre - halfWidth(layer.bottom), y2],
              ]
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join(" ");
              return (
                <g key={layer.label} onMouseEnter={() => setHovered(layer.label)} onMouseLeave={() => setHovered("")}>
                  <polygon
                    points={points}
                    fill={colourOf(layer.colourIndex)}
                    opacity={hovered && hovered !== layer.label ? 0.45 : 1}
                    style={{ stroke: "var(--paper, #fbfaf6)", strokeWidth: 2 }}
                  />
                  {/* The percentage only where the layer is big enough to hold it. */}
                  {y2 - y1 >= 20 && layer.share >= 0.06 && (
                    <text x={centre} y={(y1 + y2) / 2 + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                      {Math.round(layer.share * 100)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <ul className={styles.legend}>
            {[...layers].reverse().map((layer) => (
              <li
                key={layer.label}
                className={hovered === layer.label ? styles.on : ""}
                onMouseEnter={() => setHovered(layer.label)}
                onMouseLeave={() => setHovered("")}
              >
                <i style={{ background: colourOf(layer.colourIndex) }} />
                <span>{layer.label}</span>
                <strong>{formatValue(layer.total)}</strong>
                <em>{Math.max(1, Math.round(layer.share * 100))}%</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {layers.length > 0 && (
        <p className={styles.note}>
          {t.note(view.label, formatValue(total), target > 0 ? formatValue(target) : "", target > 0 ? Math.round((total / target) * 100) : 0)}
        </p>
      )}
    </div>
  );
}

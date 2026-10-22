// The layers of a pyramid chart. No React and no Node imports.
// Adapted from the calculation in angela-simon-wedding/components/panel/BudgetPyramid.tsx.

export type PyramidItem = { label: string; value: number };

export type PyramidLayer = {
  label: string; // the first spelling seen of this label
  total: number;
  share: number; // 0-1, this layer's part of all layers
  // Depth of the layer's top and bottom edge, 0 (the tip) to 1 (the base).
  top: number;
  bottom: number;
  // Index into the colours: the biggest layer (the bottom one) is 0.
  colourIndex: number;
};

// Items with the same label (ignoring case) are added up; items with no
// label go under `unlabelled`. Layers with nothing in them are dropped.
// Returned from the TIP down, the way they are drawn: the biggest total ends
// up at the bottom.
//
// The layers are sliced by AREA, so the picture is honest and not just
// decorative: a layer with 30% of the total covers 30% of the triangle.
// Seen from the tip, the width at depth d is proportional to d, so the area
// down to depth d is proportional to d squared, hence the square roots.
export function pyramidLayers(items: PyramidItem[], unlabelled = "Other"): PyramidLayer[] {
  const totals = new Map<string, { label: string; total: number }>();
  for (const item of items) {
    if (!Number.isFinite(item.value)) continue;
    const label = item.label.trim() || unlabelled;
    const key = label.toLowerCase();
    const known = totals.get(key) ?? { label, total: 0 };
    known.total += item.value;
    totals.set(key, known);
  }

  const biggestFirst = [...totals.values()].filter((entry) => entry.total > 0).sort((left, right) => right.total - left.total);
  const sum = biggestFirst.reduce((acc, entry) => acc + entry.total, 0);
  const tipFirst = [...biggestFirst].reverse();

  return tipFirst.map((entry, position) => {
    const above = tipFirst.slice(0, position).reduce((acc, other) => acc + other.total, 0) / sum;
    const share = entry.total / sum;
    return {
      label: entry.label,
      total: entry.total,
      share,
      top: Math.sqrt(above),
      bottom: Math.sqrt(above + share),
      colourIndex: biggestFirst.length - 1 - position,
    };
  });
}

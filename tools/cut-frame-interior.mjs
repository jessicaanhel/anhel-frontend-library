#!/usr/bin/env node
// ============================================================================
// USED FOR THE WEDDING WEBSITE (angela-simon-wedding): this is the "cutting
// part" behind the "Our story" photo slider. It turned the floral wreath's solid
// cream inside into transparency so the photos show through the frame.
// ============================================================================
// Cuts the solid-coloured "inside" of a picture frame (a wreath, an oval, a
// card...) out to transparent, so a photo can be placed BEHIND the frame and
// show through it. Used for the floral wreath in the wedding site's
// "Our story" photo stack (assets/framed-photo-stack/floral-frame.png, for
// the FramedPhotoStack component).
//
//   node cut-frame-interior.mjs <input image> <output.png> [options]
//   node cut-frame-interior.mjs <input image> --sample x,y;x,y
//
// Needs: ffmpeg + ffprobe on the PATH (ffmpeg decodes any image to raw RGBA
// and encodes the PNG back; ffprobe reads the size) and Node 18+. No npm
// packages.
//
// Assumes the area OUTSIDE the frame is already transparent. Every pixel
// matching the colour test is cleared, wherever it is, so a cream background
// around the frame would be cleared too, and the opening-bounds report below
// would then measure the whole image instead of the hole.
//
// How it decides what is "inside": a pixel is cleared when it is
//   - opaque enough (alpha > 0),
//   - bright (r > MIN_BRIGHT)  -> keeps the dark outlines/vines,
//   - roughly neutral-warm cream: r - g small and g - b inside a window
//       -> keeps pink petals (r much larger than g) and green leaves
//          (g - b too large).
// A plain "distance to the sampled colour" test is NOT used on purpose: pale
// pink petals were only ~20 units away from the cream fill and got eaten.
// The defaults were tuned for cream (243,240,228); for another fill colour,
// sample a few pixels (see --sample) and adjust the options.
//
// Options (all optional):
//   --min-bright 150      minimum red value to clear
//   --max-rg 10           clear only if (r - g) is below this
//   --min-gb 6            clear only if (g - b) is above this
//   --max-gb 30           ...and below this
//   --sample x,y;x,y      print the RGBA of these pixels and exit (use this to
//                         look at the fill, petals and outline colours first)
//
// After cutting it prints the bounding box of the opening as a fraction of the
// image, found by keeping only rows whose cleared run is wide (more than 20%
// of the image width). A simpler centre-line scan is not used: decorative
// gaps in a wreath can make it hit the frame's edge.
// Use those fractions for the CSS clip-path ellipse that crops the photo, e.g.
//   clip-path: ellipse(<rx>% <ry>% at <cx>% <cy>%);
// (trim the radii a couple of percent so the photo sits just inside the vine).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every "--name" takes the next argument as its value; everything else is a
// positional argument (input, then output).
const args = process.argv.slice(2);
const options = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    options[args[i].slice(2)] = args[i + 1];
    i++;
  } else {
    positional.push(args[i]);
  }
}
const [input, output] = positional;
const opt = (name, def) => (name in options ? options[name] : def);

const usage =
  "usage: node cut-frame-interior.mjs <input> <output.png> [--min-bright N --max-rg N --min-gb N --max-gb N]\n" +
  "       node cut-frame-interior.mjs <input> --sample 'x,y;x,y'";
if (!input || (!output && !("sample" in options))) {
  console.error(usage);
  process.exit(1);
}

const MIN_BRIGHT = Number(opt("min-bright", 150));
const MAX_RG = Number(opt("max-rg", 10));
const MIN_GB = Number(opt("min-gb", 6));
const MAX_GB = Number(opt("max-gb", 30));

// size of the image
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", input]).toString().trim().split(",");
const W = Number(probe[0]);
const H = Number(probe[1]);

// decode to raw RGBA
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "frame-cut-"));
const rawPath = path.join(tmp, "in.rgba");
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", input, "-f", "rawvideo", "-pix_fmt", "rgba", rawPath]);
const buf = fs.readFileSync(rawPath);

const sample = opt("sample", null);
if (sample) {
  for (const pair of sample.split(";")) {
    const [x, y] = pair.split(",").map(Number);
    const o = (y * W + x) * 4;
    console.log(`(${x},${y}) =`, [buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]);
  }
  process.exit(0);
}

const isInterior = (o) => {
  const r = buf[o];
  const g = buf[o + 1];
  const b = buf[o + 2];
  const a = buf[o + 3];
  return a > 0 && r > MIN_BRIGHT && r - g < MAX_RG && g - b > MIN_GB && g - b < MAX_GB;
};

let cleared = 0;
const hole = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const o = i * 4;
  if (isInterior(o)) {
    buf[o + 3] = 0;
    hole[i] = 1;
    cleared++;
  }
}
console.log(`cleared ${cleared} of ${W * H} pixels (${((cleared / (W * H)) * 100).toFixed(1)}%)`);

// write the PNG back
const outRaw = path.join(tmp, "out.rgba");
fs.writeFileSync(outRaw, buf);
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", outRaw, "-update", "1", "-frames:v", "1", output]);
console.log("wrote", output);

// opening bounds: only count rows whose cleared run is wide (ignores thin gaps)
const wide = Math.round(W * 0.2);
let minX = W;
let maxX = 0;
let minY = H;
let maxY = 0;
for (let y = 0; y < H; y++) {
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const v = x < W ? hole[y * W + x] : 0;
    if (v && start < 0) start = x;
    if (!v && start >= 0) {
      if (x - start > wide) {
        minX = Math.min(minX, start);
        maxX = Math.max(maxX, x - 1);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      start = -1;
    }
  }
}
const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`;
const foundOpening = maxX >= minX && maxY >= minY;
if (foundOpening) {
  console.log(`opening: x ${minX}-${maxX} of ${W}, y ${minY}-${maxY} of ${H}`);
  console.log(
    `suggested clip-path: ellipse(${pct((maxX - minX) / 2, W)} ${pct((maxY - minY) / 2, H)} at ${pct((minX + maxX) / 2, W)} ${pct((minY + maxY) / 2, H)})  (trim the radii ~2-3% for breathing room)`
  );
} else {
  console.log("no wide opening found: nothing (or only thin gaps) matched the colour test. Check the fill colour with --sample.");
}

// Check the result: composite over a solid colour, because many image
// viewers draw transparency as white and make a successful cut look like a
// failed one.
console.log(`tip: ffmpeg -f lavfi -i color=c=red:s=${W}x${H} -i "${output}" -filter_complex overlay -frames:v 1 check.png`);
fs.rmSync(tmp, { recursive: true, force: true });

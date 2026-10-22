// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the shrinking of
// photos before they are saved in the planning panel's notes and board items.
// ============================================================================

// Adapted from angela-simon-wedding/components/panel/shrinkPicture.ts.
//
// Browser only (canvas). A photo from a phone or computer is scaled down and
// saved as a small JPEG data URL, so it fits where a big file can't go: a
// Google Sheet cell, a database record, a JSON note. It tries again with a
// smaller size and lower quality until the result is short enough.

export type ShrinkPictureOptions = {
  // The longest side of the result, in pixels. Default 640.
  longestSide?: number;
  // JPEG quality of the first attempt, 0-1. Default 0.7.
  quality?: number;
  // Stop as soon as the data URL is shorter than this many characters.
  // Default 110,000 (what fits in a few Google Sheet cells).
  maxChars?: number;
  // How many times to try, each time smaller. Default 4.
  attempts?: number;
};

// The size a picture gets when its longest side is cut down to `longestSide`.
// A picture that is already small enough keeps its size (never enlarged).
export function scaledSize(width: number, height: number, longestSide: number) {
  const scale = Math.min(1, longestSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// The settings of the attempt after this one: a fifth smaller, and a little
// less quality (but never below 0.3, where JPEGs turn blocky).
export function nextAttempt(attempt: { longestSide: number; quality: number }) {
  return {
    longestSide: Math.round(attempt.longestSide * 0.8),
    quality: Math.max(0.3, Math.round((attempt.quality - 0.1) * 100) / 100),
  };
}

// Returns the data URL ("data:image/jpeg;base64,..."). When even the last
// attempt is longer than `maxChars` it is returned anyway: the server's own
// size check (e.g. cleanBoardItem or cleanNoteDoc) then refuses it with a message.
export async function shrinkPicture(file: Blob, options: ShrinkPictureOptions = {}): Promise<string> {
  const maxChars = options.maxChars ?? 110_000;
  const attempts = options.attempts ?? 4;
  let attempt = { longestSide: options.longestSide ?? 640, quality: options.quality ?? 0.7 };

  const bitmap = await createImageBitmap(file);
  let result = "";
  for (let count = 0; count < attempts; count += 1) {
    const size = scaledSize(bitmap.width, bitmap.height, attempt.longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    result = canvas.toDataURL("image/jpeg", attempt.quality);
    if (result.length < maxChars) break; // small enough
    attempt = nextAttempt(attempt);
  }
  return result;
}

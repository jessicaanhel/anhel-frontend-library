// Pure helpers for Figma / FigJam links. No React imports, so the server can
// use them too (e.g. to check a link before saving it).
// Adapted from angela-simon-wedding/components/panel/FigmaBoard.tsx.

// An https link on figma.com (a design, a FigJam board, a prototype...).
export function isFigmaLink(link: string) {
  return /^https:\/\/(www\.)?figma\.com\//i.test(link.trim());
}

// Figma's own embed page for a shared link. The file must be shared in Figma
// as "Anyone with the link can view", otherwise the embed asks for a login.
export function figmaEmbedUrl(link: string) {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(link.trim())}`;
}

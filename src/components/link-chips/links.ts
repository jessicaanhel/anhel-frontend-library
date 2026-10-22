// Small helpers for links typed or pasted by people. No React and no Node
// imports, so the server can use them too.
// Adapted from angela-simon-wedding/components/panel/BudgetPanel.tsx
// (hostOf, asWebAddress).

// A link shown by the site's name: "https://www.shop.com/a/b" -> "shop.com".
// Text that is not a link is returned as it is.
export function hostOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

// What a person typed as a proper web address, or "" when it is not one.
// "www.shop.com" typed without https gets "https://" added. Text with spaces,
// or without a dot in the host name ("hello"), is not an address.
export function asWebAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/[^/.\s]+\.[^\s]+$/i.test(withScheme) ? withScheme : "";
}

// The links with `typed` added: unchanged when it is not an address, already
// in the list, or the list is full. `added` says whether it was added, and
// `invalid` whether the text was not an address.
export function addLink(links: string[], typed: string, max = 8) {
  const trimmed = typed.trim();
  if (!trimmed) return { links, added: false, invalid: false };
  const address = asWebAddress(trimmed);
  if (!address) return { links, added: false, invalid: true };
  if (links.includes(address) || links.length >= max) return { links, added: false, invalid: false };
  return { links: [...links, address], added: true, invalid: false };
}

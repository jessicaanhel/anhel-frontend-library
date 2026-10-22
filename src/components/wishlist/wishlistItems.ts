// The items of a wishlist and the pure helpers its component uses. No React
// and no Node imports, so the server can share the type and the limits.
// Adapted from angela-simon-wedding/lib/panel/types.ts (Favor) and
// components/panel/FavorsPanel.tsx.

import { asWebAddress } from "../link-chips/links";

// One list the items are grouped in (the tabs of the component).
export type WishlistCategory = { key: string; label: string };

export type WishlistItem = {
  id: string; // "" for an item that has not been saved yet
  category: string; // the `key` of one of the categories
  title: string;
  description: string;
  link: string; // a web address, or ""
  price: string; // free text, for example "€24.90"
  image: string; // the address of a picture on the web (https), or ""
};

// What `fetchPreview` returns for a pasted link. Any of the texts can be "".
export type WishlistPreview = {
  title: string;
  description: string;
  image: string;
  price: string;
};

// The longest texts that are kept. The form and the server's `clean` both use
// them, so the form never offers more than the server saves.
export const WISHLIST_LIMITS = { title: 100, description: 400, link: 800, price: 30, image: 800 };

// A new item with every field filled in.
export function emptyWishlistItem(fields: Partial<WishlistItem> = {}): WishlistItem {
  return { id: "", category: "", title: "", description: "", link: "", price: "", image: "", ...fields };
}

// The items of one category, in the order they were given.
export function itemsOfCategory(items: WishlistItem[], category: string) {
  return items.filter((item) => item.category === category);
}

// What a pasted link's preview adds to an item: only the fields that are still
// empty are filled, so nothing a person typed is replaced.
export function fillFromPreview(draft: WishlistItem, preview: Partial<WishlistPreview>): WishlistItem {
  return {
    ...draft,
    title: draft.title || preview.title || "",
    description: draft.description || preview.description || "",
    price: draft.price || preview.price || "",
    image: draft.image || preview.image || "",
  };
}

export type PreparedWishlistItem = { item: WishlistItem } | { problem: "link" | "picture" };

// The item as it is sent to the server: texts trimmed, the link and the
// picture checked and turned into proper web addresses. A picture on plain
// http becomes https (a page served over https would not show it otherwise).
// A link or picture that is filled in but is not a web address is a problem.
export function prepareWishlistItem(draft: WishlistItem): PreparedWishlistItem {
  const linkText = draft.link.trim();
  const link = linkText ? asWebAddress(linkText) : "";
  if (linkText && !link) return { problem: "link" };

  const pictureText = draft.image.trim();
  const image = pictureText ? asWebAddress(pictureText).replace(/^http:/i, "https:") : "";
  if (pictureText && !image) return { problem: "picture" };

  return { item: { ...draft, title: draft.title.trim(), description: draft.description.trim(), link, price: draft.price.trim(), image } };
}

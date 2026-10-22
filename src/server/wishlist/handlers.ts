// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the endpoint of the
// "Wedding favors" wishlists (presents for the guests, the bridesmaids, the
// groomsmen, the family and the groom, each list with its own permission).
// ============================================================================

import { WISHLIST_LIMITS, type WishlistCategory, type WishlistItem } from "../../components/wishlist/wishlistItems";
import { listChanges, text } from "../lists/clean";
import { createListHandlers, type ListConfig, type ListSession } from "../lists/handlers";

// Adapted from angela-simon-wedding/app/api/panel/favors/route.ts.
//
// The endpoint behind Wishlist: a list endpoint (GET / PUT / DELETE, see
// createListHandlers) in which every item belongs to a category, and a person
// only sees, adds, moves, changes and removes the items of the categories
// they may see (`canSee`). An item on any other category does not exist for
// that person: it is not listed, changing or removing it answers "not found",
// and creating one, or moving one there, is refused.

const WEB_ADDRESS = /^https?:\/\/\S+$/i;
const HTTPS_ADDRESS = /^https:\/\/\S+$/i;

// The item fields from what the browser sent, or null when something is
// wrong: a category that is not one of `categoryKeys`, or no title. A link
// that is not a web address (http or https) and a picture that is not an
// https address are dropped, not refused, so a bad address typed by hand in
// a spreadsheet does not stop the rest of the item from being saved. Texts
// are cut to WISHLIST_LIMITS.
export function cleanWishlistItem(input: unknown, categoryKeys: string[]): Omit<WishlistItem, "id"> | null {
  const raw = (input ?? {}) as Partial<Record<keyof WishlistItem, unknown>>;
  const category = typeof raw.category === "string" ? raw.category : "";
  const title = text(raw.title, WISHLIST_LIMITS.title);
  if (!categoryKeys.includes(category) || !title) return null;

  const link = text(raw.link, WISHLIST_LIMITS.link);
  const image = text(raw.image, WISHLIST_LIMITS.image);
  return {
    category,
    title,
    description: text(raw.description, WISHLIST_LIMITS.description),
    link: WEB_ADDRESS.test(link) ? link : "",
    price: text(raw.price, WISHLIST_LIMITS.price),
    image: HTTPS_ADDRESS.test(image) ? image : "",
  };
}

export type WishlistHandlerOptions<S extends ListSession> = Omit<ListConfig<WishlistItem, S>, "clean" | "maxItems" | "authorize" | "visible"> & {
  // The categories that exist. An item with any other category is refused.
  // The labels are used in the history lines.
  categories: WishlistCategory[];
  // Who may see (and so use) one category. Asked for every item of every
  // request, with the session of the person asking. A person who may see no
  // category at all gets 403 on every call.
  canSee: (category: string, session: S) => boolean;
  // Default 300.
  maxItems?: number;
  // How the lists are called in history lines ("Added “Candle” to the Guests
  // wishlist"). Default "wishlist".
  wishlistName?: string;
};

// GET / PUT / DELETE for a wishlist's items. The storage, session, history,
// trash and the other options are the same as for any list.
export function createWishlistHandlers<S extends ListSession = ListSession>(options: WishlistHandlerOptions<S>) {
  const { categories, canSee, maxItems, wishlistName = "wishlist", ...rest } = options;
  const categoryKeys = categories.map((category) => category.key);
  // A category that is not known (an old row) is shown by its key.
  const labelOf = (key: string) => categories.find((category) => category.key === key)?.label ?? key;

  return createListHandlers<WishlistItem, S>({
    describeCreate: (item) => `Added “${item.title}” to the ${labelOf(item.category)} ${wishlistName}`,
    describeUpdate(before, after) {
      const changes = listChanges([
        ["title", before.title, after.title],
        ["list", labelOf(before.category), labelOf(after.category)],
        ["description", before.description, after.description],
        ["link", before.link, after.link],
        ["price", before.price, after.price],
      ]);
      return changes ? `Edited “${after.title}”: ${changes}` : null;
    },
    describeRemove: (item) => `Removed “${item.title}” from the ${labelOf(item.category)} ${wishlistName}`,
    ...rest,
    maxItems: maxItems ?? 300,
    authorize: (session) => categoryKeys.some((key) => canSee(key, session)),
    visible: (item, session) => canSee(item.category, session),
    clean: (input) => cleanWishlistItem(input, categoryKeys),
  });
}

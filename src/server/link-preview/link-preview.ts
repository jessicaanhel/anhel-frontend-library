// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: "paste a link" on the
// wedding favors wishlist: the page's title, description, picture and price
// are read on the server and filled into the form.
// ============================================================================

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Adapted from angela-simon-wedding/lib/panel/linkPreview.ts.
//
// A preview of a web page for a link someone pastes (a shop page, say): its title, a short description,
// a picture and, when the page says it, the price. It reads the page's Open Graph and product tags and
// its schema.org (JSON-LD) data, the same things link previews in chat apps use.
//
// The server fetches the page, so it only goes to public web addresses: https or http on the standard
// ports, never to a private, local or reserved address (also after a redirect), with a time limit and
// a size limit. Nothing here depends on a framework.

export type LinkPreview = {
  title: string;
  description: string;
  image: string; // the address of a picture, https only, or ""
  price: string; // for example "€24.90", or ""
  siteName: string;
};

const MAX_BYTES = 900_000;
const TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 4;

// ---- keeping the fetch on the public internet --------------------------------------------------

function isPrivateIPv4(parts: number[]) {
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // shared address space
    (a === 169 && b === 254) || // link local, also the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip.split(".").map(Number));
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower); // an IPv4 address written as IPv6
  if (mapped) return isPrivateIPv4(mapped[1].split(".").map(Number));
  // The same, in the form Node's URL parser gives back: "http://[::ffff:127.0.0.1]/" has the host
  // "[::ffff:7f00:1]", so the two 16-bit groups have to be turned back into the four IPv4 numbers.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isPrivateIPv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
  }
  return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower);
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web addresses are allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("That port is not allowed.");
  if (url.username || url.password) throw new Error("Addresses with a login are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That address is not public.");
    return;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address is not public.");
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("That address is not public.");
}

async function readPage(address: string): Promise<{ html: string; url: URL }> {
  let url = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some shops answer a plain script with an error page; this is what chat apps send too.
        "User-Agent": "Mozilla/5.0 (compatible; WishlistPreview/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en,nl;q=0.8",
      },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location") as string, url);
      continue;
    }
    if (!response.ok) throw new Error(`The page answered ${response.status}.`);
    if (!/html/i.test(response.headers.get("content-type") ?? "")) throw new Error("That link is not a web page.");

    // Read at most MAX_BYTES: the tags are in the head, near the top.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The page is empty.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
    return { html: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"), url };
  }
  throw new Error("Too many redirects.");
}

// ---- reading the page ------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(parseInt(number, 10)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

const clean = (value: string | undefined, max: number) => decodeEntities(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// All <meta> tags as name -> content (the name is the property or the name attribute, lower case).
function metaTags(html: string) {
  const tags = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (name && value !== undefined && !tags.has(name)) tags.set(name, value);
  }
  return tags;
}

function formatPrice(amount: string, currency: string) {
  const number = parseFloat(amount.replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return "";
  if (/^[A-Za-z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(number);
    } catch {
      // not a currency code Intl knows: fall through
    }
  }
  return currency ? `${currency} ${number}` : String(number);
}

// The price from schema.org data: a Product (or a list of them) with an offer (or a list of offers).
function priceFromJsonLd(html: string) {
  for (const block of html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const body = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    let data: unknown;
    try {
      data = JSON.parse(decodeEntities(body));
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        const offers = record.offers ?? record.offer;
        for (const offer of Array.isArray(offers) ? offers : offers ? [offers] : []) {
          const o = offer as Record<string, unknown>;
          const spec = (o.priceSpecification ?? {}) as Record<string, unknown>;
          const amount = o.price ?? o.lowPrice ?? spec.price;
          const currency = o.priceCurrency ?? spec.priceCurrency ?? "";
          if (amount !== undefined && String(amount).trim()) return formatPrice(String(amount), String(currency));
        }
        if (record["@graph"]) stack.push(record["@graph"]);
      }
    }
  }
  return "";
}

// Exported for tests: the preview of a page given its HTML and its final address.
export function parsePreview(html: string, pageUrl: URL): LinkPreview {
  const tags = metaTags(html);
  const first = (...names: string[]) => names.map((name) => tags.get(name)).find((value) => value && value.trim());

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let image = clean(first("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src", "image"), 800);
  if (image) {
    try {
      const resolved = new URL(image, pageUrl);
      image = resolved.protocol === "https:" ? resolved.toString() : ""; // a plain http picture would be blocked in the page
    } catch {
      image = "";
    }
  }

  const amount = first("product:price:amount", "og:price:amount", "product:sale_price:amount", "price");
  const currency = first("product:price:currency", "og:price:currency", "product:sale_price:currency", "pricecurrency") ?? "";

  return {
    title: clean(first("og:title", "twitter:title") ?? titleTag, 120),
    description: clean(first("og:description", "twitter:description", "description"), 300),
    image,
    price: amount ? formatPrice(clean(amount, 30), clean(currency, 5)) : priceFromJsonLd(html),
    siteName: clean(first("og:site_name"), 60) || pageUrl.hostname.replace(/^www\./, ""),
  };
}

export async function fetchLinkPreview(address: string): Promise<LinkPreview> {
  const { html, url } = await readPage(address);
  return parsePreview(html, url);
}

import { createHmac } from "node:crypto";
import { safeEqual } from "../auth/passwords";
import { buildCalendar, type CalendarEvent } from "./ics";

// Adapted from angela-simon-wedding/lib/panel/auth.ts (calendarToken,
// usernameFromCalendarToken) and app/api/calendar/[token]/route.ts.
//
// A phone's calendar app can't send the login cookie, so each person gets a
// link with a signed token in it (their username and a signature). Anyone who
// holds the link can read that person's calendar, and nothing else. The link
// stops working when `eventsFor` says the person no longer exists.

export type CalendarFeedConfig = {
  // The HMAC key. A function, so a missing setting fails on the first request
  // instead of when the module is imported. The session secret can be used:
  // the signed text starts with "calendar:", so a calendar token is never
  // valid as a session token.
  secret: string | (() => string | undefined);
  // The calendar's name for this person.
  name: (username: string) => string;
  prodId: string;
  // The events of this person's calendar, or null when there is no such
  // person (for example the account was removed): the feed then answers 404.
  eventsFor: (username: string) => Promise<CalendarEvent[] | null>;
  refreshHours?: number;
  // The file name offered when the feed is downloaded. Default "calendar.ics".
  fileName?: string;
  logError?: (message: string, error: unknown) => void;
};

export function createCalendarFeed(config: CalendarFeedConfig) {
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  function sign(username: string) {
    const secret = typeof config.secret === "function" ? config.secret() : config.secret;
    if (!secret) throw new Error("The calendar secret is not configured.");
    return createHmac("sha256", secret).update(`calendar:${username}`).digest("base64url");
  }

  // The token for a person's link: "<name>.<signature>", both URL-safe.
  function tokenFor(username: string) {
    return `${Buffer.from(username).toString("base64url")}.${sign(username)}`;
  }

  // The username a token belongs to, or null if it was not signed by us.
  function usernameFromToken(token: string): string | null {
    const [name, signature] = token.split(".");
    if (!name || !signature) return null;
    const username = Buffer.from(name, "base64url").toString("utf8");
    return safeEqual(sign(username), signature) ? username : null;
  }

  // The response for GET /calendar/<token>.ics (the ".ics" is optional).
  async function respond(token: string): Promise<Response> {
    const notFound = () => new Response("Not found", { status: 404 });
    const username = usernameFromToken(token.replace(/\.ics$/, ""));
    if (!username) return notFound();

    try {
      const events = await config.eventsFor(username);
      if (!events) return notFound();
      const body = buildCalendar({ name: config.name(username), prodId: config.prodId, events, refreshHours: config.refreshHours });
      return new Response(body, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `inline; filename="${config.fileName ?? "calendar.ics"}"`,
          // The calendar app does its own refreshing: no cached copy in between.
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      logError("Calendar feed failed", error);
      return new Response("Could not build the calendar", { status: 502 });
    }
  }

  return { tokenFor, usernameFromToken, respond };
}

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Adapted from angela-simon-wedding/lib/panel/auth.ts (the password part).
// Server only (node:crypto).

// Compares two strings in constant time, so the time a comparison takes does
// not reveal how many leading characters matched.
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// "salt:hash", both hex. The salt is random per password, so two accounts with
// the same password still get different hashes.
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return safeEqual(scryptSync(password, salt, 32).toString("hex"), hash);
}

// Readable random password without look-alike characters (no 0/O, 1/l/I).
export function generatePassword(length = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  // byte % 55 is very slightly biased towards the first characters; fine for
  // a first password that the person is given, not for keys.
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

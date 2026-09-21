import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type StoredPassword = { password_hash: string; password_salt: string };

export const MINIMUM_PASSWORD_LENGTH = 12;

export function validatePassword(password: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) return `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "The password is too long.";
  return "";
}

export function createPasswordRecord(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, passwordHash: scryptSync(password, salt, 64).toString("hex") };
}

export function passwordMatches(password: string, account: StoredPassword) {
  const supplied = Buffer.from(scryptSync(password, account.password_salt, 64).toString("hex"), "hex");
  const stored = Buffer.from(account.password_hash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}

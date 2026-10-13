import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mita_admin_session";
const SESSION_DURATION = 8 * 60 * 60 * 1000;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.MITA_ADMIN_PASSWORD && process.env.MITA_ADMIN_SESSION_SECRET);
}

function signature(expiresAt: string, secret: string): string {
  return createHmac("sha256", secret).update(expiresAt).digest("hex");
}

export function isAdminRequest(request: Request): boolean {
  const password = process.env.MITA_ADMIN_PASSWORD;
  const secret = process.env.MITA_ADMIN_SESSION_SECRET;
  if (!password || !secret) return false;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!cookieValue) return false;

  const [expiresAt, suppliedSignature] = cookieValue.split(".");
  if (!expiresAt || !suppliedSignature || Number(expiresAt) <= Date.now()) return false;

  const expectedSignature = signature(expiresAt, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyAdminPassword(input: unknown): boolean {
  const password = process.env.MITA_ADMIN_PASSWORD;
  if (!password || typeof input !== "string") return false;

  const suppliedHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(password).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}

export function createAdminCookie(): string {
  const secret = process.env.MITA_ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("MITA_ADMIN_SESSION_SECRET belum dikonfigurasi.");

  const expiresAt = String(Date.now() + SESSION_DURATION);
  const value = `${expiresAt}.${signature(expiresAt, secret)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION / 1000}${secure}`;
}

export function clearAdminCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

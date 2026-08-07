import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "wechat_publisher_session";
const sessionDurationSeconds = 60 * 60 * 12;

function getSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || "";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim() && getSessionSecret().length >= 32);
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD?.trim() || "";
  return Boolean(expected && safeEqual(password, expected));
}

export async function createAdminSession() {
  if (!isAuthConfigured()) {
    throw new Error("管理后台登录参数尚未配置");
  }
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", expiresAt: Date.now() + sessionDurationSeconds * 1000 }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationSeconds,
    priority: "high",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function hasAdminSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !getSessionSecret()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
      expiresAt?: number;
    };
    return parsed.role === "admin" && Number(parsed.expiresAt || 0) > Date.now();
  } catch {
    return false;
  }
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) redirect("/login");
}

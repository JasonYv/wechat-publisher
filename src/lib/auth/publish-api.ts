import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const maxClockSkewMs = 5 * 60 * 1000;

function secureTextEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function verifyPublishApiRequest(request: Request) {
  const expected = process.env.PUBLISH_API_KEY?.trim();
  if (!expected || expected.length < 32) {
    return { ok: false as const, status: 503, error: "发布 API 尚未配置" };
  }

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !secureTextEqual(match[1], expected)) {
    return { ok: false as const, status: 401, error: "发布 API 凭据无效" };
  }

  const timestampText = request.headers.get("x-request-timestamp") || "";
  const rawTimestamp = Number(timestampText);
  const timestamp = rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > maxClockSkewMs) {
    return { ok: false as const, status: 401, error: "请求时间戳无效或已过期" };
  }

  return { ok: true as const };
}


import "server-only";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const maxImageBytes = 5 * 1024 * 1024;

function uploadRoot() {
  const configured = process.env.UPLOAD_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), "uploads"));
}

function detectImageExtension(buffer: Buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function storeImage(file: File, articleId: string, kind: "cover" | "inline") {
  if (!file.size) throw new Error("请选择图片文件");
  if (file.size > maxImageBytes) throw new Error("图片不能超过 5 MB");

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const sourceExtension = detectImageExtension(sourceBuffer);
  if (!sourceExtension) throw new Error("仅支持 JPG、PNG 或 WebP 图片");

  let buffer = sourceBuffer;
  let extension = sourceExtension;
  if (kind === "cover") {
    const image = sharp(sourceBuffer)
      .rotate()
      .resize({ width: 900, height: 383, fit: "cover", position: "centre" });
    for (const quality of [82, 76, 70, 64, 58, 52, 46, 40]) {
      buffer = await image.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (buffer.length <= 64 * 1024) break;
    }
    if (buffer.length > 64 * 1024) throw new Error("封面压缩后仍超过 64 KB，请换一张更简洁的图片");
    extension = "jpg";
  } else {
    if (sourceExtension === "webp") throw new Error("微信正文图片仅支持 JPG 或 PNG");
    if (sourceBuffer.length >= 1024 * 1024) throw new Error("微信正文图片需小于 1 MB");
  }

  const relativePath = path.join(articleId, `${kind}-${randomUUID()}.${extension}`);
  const absolutePath = path.join(uploadRoot(), relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer, { flag: "wx", mode: 0o600 });

  return {
    relativePath,
    absolutePath,
    hash: createHash("sha256").update(buffer).digest("hex"),
    size: buffer.length,
    mimeType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
  };
}

export function resolveStoredFile(relativePath: string) {
  const root = uploadRoot();
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("素材路径不合法");
  return resolved;
}

export async function readStoredFile(relativePath: string) {
  return fs.readFile(resolveStoredFile(relativePath));
}

export function contentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

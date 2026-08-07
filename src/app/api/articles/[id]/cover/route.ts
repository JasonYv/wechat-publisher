import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/session";
import { getArticle } from "@/lib/db";
import { contentTypeForPath, readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasAdminSession())) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const article = getArticle(id);
  if (!article?.coverPath) return new NextResponse(null, { status: 404 });

  try {
    const file = await readStoredFile(article.coverPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": contentTypeForPath(article.coverPath),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

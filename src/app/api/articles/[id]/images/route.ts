import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/session";
import {
  createArticleAsset,
  getArticle,
  recordOperation,
  updateAssetWechatUrl,
} from "@/lib/db";
import { storeImage } from "@/lib/storage";
import { isWechatConfigured, uploadInlineImage } from "@/lib/wechat/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "请求来源不合法" }, { status: 403 });
  }

  const { id } = await params;
  if (!getArticle(id)) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  if (!isWechatConfigured()) {
    return NextResponse.json({ error: "请先配置公众号接口" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) throw new Error("请选择正文图片");
    const stored = await storeImage(file, id, "inline");
    const assetId = createArticleAsset({
      articleId: id,
      kind: "inline",
      localPath: stored.relativePath,
      fileHash: stored.hash,
    });
    const url = await uploadInlineImage(stored.absolutePath);
    updateAssetWechatUrl(assetId, url);
    recordOperation({
      action: "wechat.image.upload",
      targetType: "article",
      targetId: id,
      status: "success",
      resultSummary: "正文图片已上传到微信素材域名",
    });
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传正文图片失败";
    recordOperation({
      action: "wechat.image.upload",
      targetType: "article",
      targetId: id,
      status: "failed",
      resultSummary: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

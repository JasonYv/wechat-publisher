import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPublishApiRequest } from "@/lib/auth/publish-api";
import {
  completePublishJob,
  failPublishJob,
  getArticle,
  getExternalPublishRequest,
  recordOperation,
  updateExternalPublishRequest,
} from "@/lib/db";
import type { Article } from "@/lib/db/types";
import { getWechatPublishStatus } from "@/lib/wechat/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failedPublishMessages: Record<number, string> = {
  2: "原创校验失败",
  3: "微信平台发表失败",
  4: "平台审核未通过",
  5: "发布内容已被用户删除",
  6: "发布内容已被平台封禁",
};

function payload(article: Article) {
  return {
    requestId: article.id,
    articleId: article.id,
    status: article.status,
    publishId: article.publishId,
    wechatArticleId: article.articleId,
    articleUrl: article.articleUrl,
    publishedAt: article.publishedAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = verifyPublishApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "文章 ID 不合法" }, { status: 400 });
  }
  const externalRequest = getExternalPublishRequest(id);
  if (!externalRequest) {
    return NextResponse.json({ error: "发布请求不存在" }, { status: 404 });
  }
  const article = getArticle(id);
  if (article?.status === "published") {
    updateExternalPublishRequest(id, "published");
    return NextResponse.json(payload(article));
  }
  if (externalRequest.status === "unknown") {
    return NextResponse.json(
      {
        requestId: id,
        status: "unknown",
        error: externalRequest.error || "微信提交结果不确定，请到公众号后台核对",
      },
      { status: 409 },
    );
  }
  if (externalRequest.status === "failed") {
    return NextResponse.json(
      {
        requestId: id,
        status: "failed",
        error: externalRequest.error || "微信发表任务失败",
      },
      { status: 409 },
    );
  }

  if (!article) {
    return NextResponse.json({ requestId: id, status: "processing" }, { status: 202 });
  }
  if (article.status !== "publishing" || !article.publishId) {
    const responsePayload =
      externalRequest.status === "processing" && article.status !== "failed"
        ? { ...payload(article), status: "processing" }
        : payload(article);
    return NextResponse.json(responsePayload, {
      status: article.status === "failed" ? 409 : 202,
    });
  }

  try {
    const result = await getWechatPublishStatus(article.publishId);
    if (result.status === 1) {
      return NextResponse.json(payload(article), { status: 202 });
    }
    if (result.status === 0) {
      completePublishJob({
        articleId: id,
        publishId: article.publishId,
        articleIdFromWechat: result.articleId,
        articleUrl: result.articleUrl,
      });
      updateExternalPublishRequest(id, "published");
      recordOperation({
        action: "external.wechat.publish.complete",
        targetType: "article",
        targetId: id,
        status: "success",
        resultSummary: "微信回执确认外部 API 文章已发表",
      });
      return NextResponse.json(payload(getArticle(id) || article));
    }

    const message = failedPublishMessages[result.status] || `发表失败，状态码 ${result.status}`;
    failPublishJob(id, article.publishId, message);
    updateExternalPublishRequest(id, "failed", message);
    recordOperation({
      action: "external.wechat.publish.failed",
      targetType: "article",
      targetId: id,
      status: "failed",
      resultSummary: message,
    });
    return NextResponse.json(
      { ...payload(getArticle(id) || article), error: message },
      { status: 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ...payload(article),
        error: error instanceof Error ? error.message : "查询微信发表状态失败",
      },
      { status: 502 },
    );
  }
}

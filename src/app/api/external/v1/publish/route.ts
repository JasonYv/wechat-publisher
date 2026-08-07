import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPublishApiRequest } from "@/lib/auth/publish-api";
import {
  attachPublishId,
  claimExternalPublishRequest,
  claimPublishSubmission,
  createArticleAsset,
  failPublishSubmissionIntent,
  getArticle,
  getArticleCoverAsset,
  getExternalPublishRequest,
  markArticleAsDraft,
  recordOperation,
  saveArticle,
  updateArticleCover,
  updateAssetWechatMedia,
  updateAssetWechatUrl,
  updateExternalPublishRequest,
} from "@/lib/db";
import type { Article } from "@/lib/db/types";
import { resolveStoredFile, storeImage } from "@/lib/storage";
import {
  isWechatConfigured,
  markdownToWechatHtml,
  sanitizeWechatHtmlContent,
  submitWechatPublish,
  uploadInlineImage,
  uploadPermanentThumb,
  upsertWechatDraft,
  upsertWechatDraftHtml,
  WechatApiError,
} from "@/lib/wechat/client";
import { isWechatTitleLengthValid } from "@/lib/wechat/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRequestBytes = 15 * 1024 * 1024;

const inputSchema = z.object({
  title: z.string().trim().min(1, "文章标题不能为空"),
  digest: z.string().trim().min(1, "文章摘要不能为空").max(120, "文章摘要不能超过 120 字"),
  content: z.string().min(1, "文章正文不能为空").max(200_000, "文章正文过长"),
  contentFormat: z.enum(["markdown", "html"]).default("markdown"),
});

const manifestSchema = z
  .array(
    z.object({
      field: z.string().regex(/^image_[0-9]+$/, "正文图片字段名不合法"),
      placeholder: z.string().regex(/^\{\{[A-Z0-9_]+\}\}$/, "正文图片占位符不合法"),
    }),
  )
  .max(10, "正文图片最多 10 张")
  .refine((items) => new Set(items.map((item) => item.field)).size === items.length, {
    message: "正文图片字段名不能重复",
  })
  .refine((items) => new Set(items.map((item) => item.placeholder)).size === items.length, {
    message: "正文图片占位符不能重复",
  });

function articlePayload(article: Article, status: string = article.status) {
  return {
    requestId: article.id,
    articleId: article.id,
    status,
    publishId: article.publishId,
    wechatArticleId: article.articleId,
    articleUrl: article.articleUrl,
  };
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function fileHash(file: File) {
  return createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
}

async function buildRequestHash(input: {
  title: string;
  digest: string;
  content: string;
  contentFormat: "markdown" | "html";
  cover: File;
  images: { field: string; placeholder: string; file: File }[];
}) {
  const imageHashes = await Promise.all(
    [...input.images]
      .sort((left, right) => left.field.localeCompare(right.field))
      .map(async (image) => ({
        field: image.field,
        placeholder: image.placeholder,
        hash: await fileHash(image.file),
      })),
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: input.title,
        digest: input.digest,
        content: input.content,
        contentFormat: input.contentFormat,
        coverHash: await fileHash(input.cover),
        images: imageHashes,
      }),
    )
    .digest("hex");
}

async function submitDraft(article: Article) {
  if (!article.wechatDraftMediaId) throw new Error("微信草稿 media_id 不存在");
  const publishJobId = claimPublishSubmission(article.id);
  if (!publishJobId) {
    const current = getArticle(article.id);
    if (current?.status === "publishing" || current?.status === "published") {
      if (current.status === "publishing" && !current.publishId) {
        const message = "发表提交结果不确定，请到公众号后台核对后再处理";
        updateExternalPublishRequest(article.id, "unknown", message);
        return NextResponse.json(
          { ...articlePayload(current, "unknown"), error: message },
          { status: 409 },
        );
      }
      return NextResponse.json(articlePayload(current), {
        status: current.status === "published" ? 200 : 202,
      });
    }
    throw new Error("发表状态已变化，请查询当前任务状态");
  }

  try {
    const publishId = await submitWechatPublish(article.wechatDraftMediaId);
    attachPublishId(publishJobId, article.id, publishId);
    updateExternalPublishRequest(article.id, "submitted");
    recordOperation({
      action: "external.wechat.publish.submit",
      targetType: "article",
      targetId: article.id,
      status: "success",
      resultSummary: "外部发布 API 已提交微信发表任务",
    });
    return NextResponse.json(
      {
        ...articlePayload(getArticle(article.id) || article),
        status: "publishing",
        publishId,
      },
      { status: 202 },
    );
  } catch (error) {
    const uncertain = error instanceof WechatApiError && error.uncertain;
    const message = uncertain
      ? "微信提交结果不确定，请先查询发表状态或到微信后台核对"
      : error instanceof Error
        ? error.message
        : "提交微信发表失败";
    failPublishSubmissionIntent({
      jobId: publishJobId,
      articleId: article.id,
      error: message,
      uncertain,
    });
    updateExternalPublishRequest(article.id, uncertain ? "unknown" : "failed", message);
    throw new Error(message);
  }
}

export async function POST(request: Request) {
  const auth = verifyPublishApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isWechatConfigured()) {
    return NextResponse.json({ error: "服务器尚未配置微信公众号凭据" }, { status: 503 });
  }

  const requestIdText = request.headers.get("x-idempotency-key") || "";
  const requestIdResult = z.string().uuid().safeParse(requestIdText);
  if (!requestIdResult.success) {
    return NextResponse.json({ error: "X-Idempotency-Key 必须是 UUID" }, { status: 400 });
  }
  const requestId = requestIdResult.data;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxRequestBytes) {
    return NextResponse.json({ error: "发布请求不能超过 15 MB" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const input = inputSchema.parse({
      title: readText(formData, "title"),
      digest: readText(formData, "digest"),
      content: readText(formData, "content"),
      contentFormat: readText(formData, "contentFormat") || "markdown",
    });
    if (!isWechatTitleLengthValid(input.title)) {
      throw new Error("微信标题不能超过 32 字（ASCII 字符按半字计）");
    }

    const cover = formData.get("cover");
    if (!(cover instanceof File)) throw new Error("缺少封面图片 cover");

    let rawManifest: unknown = [];
    const manifestText = readText(formData, "imagesManifest");
    if (manifestText) {
      try {
        rawManifest = JSON.parse(manifestText);
      } catch {
        throw new Error("imagesManifest 不是有效 JSON");
      }
    }
    const manifest = manifestSchema.parse(rawManifest);
    const images = manifest.map((item) => {
      const file = formData.get(item.field);
      if (!(file instanceof File)) throw new Error(`缺少正文图片 ${item.field}`);
      if (!input.content.includes(item.placeholder)) {
        throw new Error(`正文中不存在占位符 ${item.placeholder}`);
      }
      return { ...item, file };
    });

    const requestHash = await buildRequestHash({ ...input, cover, images });
    const claim = claimExternalPublishRequest({ requestId, requestHash });
    if (claim === "conflict") {
      return NextResponse.json(
        { error: "该幂等键已用于另一份内容，请更换 X-Idempotency-Key" },
        { status: 409 },
      );
    }

    const existing = getArticle(requestId);
    if (claim === "existing") {
      const externalRequest = getExternalPublishRequest(requestId);
      if (externalRequest?.status === "unknown") {
        return NextResponse.json(
          {
            requestId,
            status: "unknown",
            error: externalRequest.error || "微信提交结果不确定，请到公众号后台核对",
          },
          { status: 409 },
        );
      }
      if (!existing) {
        return NextResponse.json(
          { requestId, status: externalRequest?.status || "processing" },
          { status: 202 },
        );
      }
      const responseStatus =
        externalRequest?.status === "processing" ? "processing" : existing.status;
      return NextResponse.json(articlePayload(existing, responseStatus), {
        status: existing.status === "published" ? 200 : 202,
      });
    }

    if (existing?.status === "published") {
      updateExternalPublishRequest(requestId, "published");
      return NextResponse.json(articlePayload(existing));
    }
    if (existing?.status === "publishing") {
      if (!existing.publishId) {
        const message = "发表提交结果不确定，请到公众号后台核对后再处理";
        updateExternalPublishRequest(requestId, "unknown", message);
        return NextResponse.json(
          { ...articlePayload(existing, "unknown"), error: message },
          { status: 409 },
        );
      }
      updateExternalPublishRequest(requestId, "submitted");
      return NextResponse.json(articlePayload(existing), { status: 202 });
    }
    if (existing?.status === "failed") {
      updateExternalPublishRequest(requestId, "failed", "此前微信发表任务已经失败");
      return NextResponse.json(
        { ...articlePayload(existing), error: "此前微信发表任务已经失败，请使用新的幂等键重试" },
        { status: 409 },
      );
    }
    if (existing?.status === "draft") return submitDraft(existing);

    saveArticle({
      id: requestId,
      title: input.title,
      digest: input.digest,
      content: input.content,
      status: "local",
    });

    let content = input.content;
    for (const image of images) {
      const stored = await storeImage(image.file, requestId, "inline");
      const assetId = createArticleAsset({
        articleId: requestId,
        kind: "inline",
        localPath: stored.relativePath,
        fileHash: stored.hash,
      });
      const url = await uploadInlineImage(stored.absolutePath);
      updateAssetWechatUrl(assetId, url);
      content = content.replaceAll(image.placeholder, url);
    }
    if (/\{\{[A-Z0-9_]+\}\}/.test(content)) {
      throw new Error("正文仍包含未替换的图片占位符");
    }

    saveArticle({
      id: requestId,
      title: input.title,
      digest: input.digest,
      content,
      status: "local",
    });

    const storedCover = await storeImage(cover, requestId, "cover");
    updateArticleCover(requestId, storedCover.relativePath, storedCover.hash);
    const coverAsset = getArticleCoverAsset(requestId);
    if (!coverAsset) throw new Error("封面素材保存失败");
    const thumbMediaId = await uploadPermanentThumb(resolveStoredFile(coverAsset.localPath));
    updateAssetWechatMedia(coverAsset.id, thumbMediaId);

    const article = getArticle(requestId);
    if (!article) throw new Error("文章保存失败");
    const html =
      input.contentFormat === "html"
        ? sanitizeWechatHtmlContent(article.content)
        : markdownToWechatHtml(article.content, article.title);
    if (html.length > 20_000 || Buffer.byteLength(html, "utf8") > 1024 * 1024) {
      throw new Error("转换后的正文超过微信限制，请精简内容");
    }

    const draft =
      input.contentFormat === "html"
        ? await upsertWechatDraftHtml(article, article.content, thumbMediaId)
        : await upsertWechatDraft(article, thumbMediaId);
    const draftUpdate = markArticleAsDraft(requestId, draft.mediaId);
    if (draftUpdate.changes !== 1) {
      throw new Error("文章状态已变化，系统已阻止重复提交");
    }
    recordOperation({
      action: "external.wechat.draft.sync",
      targetType: "article",
      targetId: requestId,
      status: "success",
      resultSummary: "外部发布 API 已创建微信草稿并完成回读校验",
    });

    const draftArticle = getArticle(requestId);
    if (!draftArticle) throw new Error("草稿状态保存失败");
    return submitDraft(draftArticle);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "请求参数不合法"
        : error instanceof Error
          ? error.message
          : "发布请求处理失败";
    const current = getExternalPublishRequest(requestId);
    if (current?.status === "unknown") {
      return NextResponse.json(
        { requestId, status: "unknown", error: current.error || message },
        { status: 409 },
      );
    }
    if (current?.status === "submitted" || current?.status === "published") {
      const article = getArticle(requestId);
      return NextResponse.json(
        article
          ? articlePayload(article)
          : { requestId, status: current.status },
        { status: current.status === "published" ? 200 : 202 },
      );
    }
    if (current && !["submitted", "published", "unknown"].includes(current.status)) {
      updateExternalPublishRequest(requestId, "failed", message);
    }
    recordOperation({
      action: "external.wechat.publish",
      targetType: "article",
      targetId: requestId,
      status: "failed",
      resultSummary: message,
    });
    return NextResponse.json({ requestId, status: "failed", error: message }, { status: 400 });
  }
}

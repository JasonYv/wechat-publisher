"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import {
  completePublishJob,
  attachPublishId,
  claimPublishSubmission,
  failPublishJob,
  failPublishSubmissionIntent,
  getArticle,
  getArticleCoverAsset,
  markArticleAsDraft,
  recordOperation,
  resolveUnknownPublishSubmission,
  updateExternalPublishRequest,
  updateArticleCover,
  updateAssetWechatMedia,
} from "@/lib/db";
import { resolveStoredFile, storeImage } from "@/lib/storage";
import {
  getWechatPublishStatus,
  isWechatConfigured,
  markdownToWechatHtml,
  submitWechatPublish,
  uploadPermanentThumb,
  upsertWechatDraft,
  WechatApiError,
} from "@/lib/wechat/client";
import { isWechatTitleLengthValid } from "@/lib/wechat/limits";

export type DeliveryActionState = {
  error: string;
  success: string;
};

const articleIdSchema = z.string().uuid("文章 ID 不合法");

function readArticleId(formData: FormData) {
  return articleIdSchema.parse(String(formData.get("articleId") || ""));
}

function refreshArticlePaths(articleId: string) {
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/drafts");
  revalidatePath("/history");
  revalidatePath(`/articles/${articleId}`);
}

function actionError(error: unknown) {
  return {
    error: error instanceof Error ? error.message : "操作失败，请稍后重试",
    success: "",
  };
}

export async function uploadCoverAction(
  _state: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  await requireAdminSession();
  try {
    const articleId = readArticleId(formData);
    if (!getArticle(articleId)) throw new Error("文章不存在");
    const file = formData.get("cover");
    if (!(file instanceof File)) throw new Error("请选择封面图片");
    const stored = await storeImage(file, articleId, "cover");
    updateArticleCover(articleId, stored.relativePath, stored.hash);
    refreshArticlePaths(articleId);
    return { error: "", success: "封面已保存，下次同步草稿时会上传到微信" };
  } catch (error) {
    return actionError(error);
  }
}

export async function syncWechatDraftAction(
  _state: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  await requireAdminSession();
  let articleId = "";
  try {
    articleId = readArticleId(formData);
    if (!isWechatConfigured()) throw new Error("请先在服务器配置公众号 AppID 和 AppSecret");
    const article = getArticle(articleId);
    if (!article) throw new Error("文章不存在");
    if (!article.digest.trim()) throw new Error("同步前请补充文章摘要");
    if (!isWechatTitleLengthValid(article.title)) {
      throw new Error("微信标题不能超过 32 字（ASCII 字符按半字计）");
    }
    if (article.digest.length > 120) throw new Error("微信摘要不能超过 120 个字符");
    const html = markdownToWechatHtml(article.content, article.title);
    if (html.length > 20_000 || Buffer.byteLength(html, "utf8") > 1024 * 1024) {
      throw new Error("转换后的正文超过微信限制，请精简内容");
    }

    const coverAsset = getArticleCoverAsset(articleId);
    if (!coverAsset || !article.coverPath) throw new Error("同步前请先上传文章封面");
    let thumbMediaId = coverAsset.wechatMediaId;
    if (!thumbMediaId) {
      thumbMediaId = await uploadPermanentThumb(resolveStoredFile(coverAsset.localPath));
      updateAssetWechatMedia(coverAsset.id, thumbMediaId);
    }

    const result = await upsertWechatDraft(article, thumbMediaId);
    const draftUpdate = markArticleAsDraft(articleId, result.mediaId);
    if (draftUpdate.changes !== 1) {
      throw new Error("文章状态已变化，系统已阻止覆盖当前发表任务");
    }
    recordOperation({
      action: result.action === "created" ? "wechat.draft.create" : "wechat.draft.update",
      targetType: "article",
      targetId: articleId,
      status: "success",
      resultSummary: result.action === "created" ? "已创建微信草稿" : "已更新微信草稿",
    });
    refreshArticlePaths(articleId);
    return { error: "", success: "草稿已同步到微信，请预览后再确认发表" };
  } catch (error) {
    if (articleId) {
      recordOperation({
        action: "wechat.draft.sync",
        targetType: "article",
        targetId: articleId,
        status: "failed",
        resultSummary: error instanceof Error ? error.message : "同步草稿失败",
      });
    }
    return actionError(error);
  }
}

export async function publishArticleAction(
  _state: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  await requireAdminSession();
  let articleId = "";
  let publishJobId = "";
  try {
    articleId = readArticleId(formData);
    const article = getArticle(articleId);
    if (!article) throw new Error("文章不存在");
    if (article.status === "publishing") throw new Error("这篇文章已在发表中，请勿重复提交");
    if (article.status !== "draft" || !article.wechatDraftMediaId) {
      throw new Error("请先把最新内容同步到微信草稿");
    }

    publishJobId = claimPublishSubmission(articleId) || "";
    if (!publishJobId) throw new Error("发表状态已变化，请刷新页面后再试");

    let publishId: string;
    try {
      publishId = await submitWechatPublish(article.wechatDraftMediaId);
    } catch (error) {
      const uncertain = error instanceof WechatApiError && error.uncertain;
      const message = uncertain
        ? "提交结果不确定，系统已阻止重复发表；请先到微信后台核对"
        : error instanceof Error
          ? error.message
          : "提交发表失败";
      failPublishSubmissionIntent({
        jobId: publishJobId,
        articleId,
        error: message,
        uncertain,
      });
      recordOperation({
        action: "wechat.publish.submit",
        targetType: "article",
        targetId: articleId,
        status: "failed",
        resultSummary: message,
      });
      refreshArticlePaths(articleId);
      throw new Error(message);
    }
    attachPublishId(publishJobId, articleId, publishId);
    recordOperation({
      action: "wechat.publish.submit",
      targetType: "article",
      targetId: articleId,
      status: "success",
      resultSummary: "已提交微信发表任务，等待平台回执",
    });
    refreshArticlePaths(articleId);
    return { error: "", success: "已提交发表，请稍后回查结果" };
  } catch (error) {
    if (articleId && !publishJobId) {
      recordOperation({
        action: "wechat.publish.submit",
        targetType: "article",
        targetId: articleId,
        status: "failed",
        resultSummary: error instanceof Error ? error.message : "提交发表失败",
      });
    }
    return actionError(error);
  }
}

const failedPublishMessages: Record<number, string> = {
  2: "原创校验失败",
  3: "微信平台发表失败",
  4: "平台审核未通过",
  5: "发布内容已被用户删除",
  6: "发布内容已被平台封禁",
};

export async function refreshPublishStatusAction(
  _state: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  await requireAdminSession();
  try {
    const articleId = readArticleId(formData);
    const article = getArticle(articleId);
    if (!article?.publishId) throw new Error("没有可回查的发表任务");
    const result = await getWechatPublishStatus(article.publishId);
    if (result.status === 0) {
      completePublishJob({
        articleId,
        publishId: article.publishId,
        articleIdFromWechat: result.articleId,
        articleUrl: result.articleUrl,
      });
      recordOperation({
        action: "wechat.publish.complete",
        targetType: "article",
        targetId: articleId,
        status: "success",
        resultSummary: "微信回执确认文章已发表",
      });
      refreshArticlePaths(articleId);
      return { error: "", success: "文章已发表成功" };
    }
    if (result.status === 1) return { error: "", success: "微信仍在处理，请稍后再回查" };

    const message = failedPublishMessages[result.status] || `发表失败，状态码 ${result.status}`;
    failPublishJob(articleId, article.publishId, message);
    recordOperation({
      action: "wechat.publish.failed",
      targetType: "article",
      targetId: articleId,
      status: "failed",
      resultSummary: message,
    });
    refreshArticlePaths(articleId);
    return { error: message, success: "" };
  } catch (error) {
    return actionError(error);
  }
}

export async function resolveUnknownPublishAction(
  _state: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  await requireAdminSession();
  try {
    const articleId = readArticleId(formData);
    resolveUnknownPublishSubmission(articleId);
    updateExternalPublishRequest(articleId, "failed", "管理员确认微信后台不存在发表任务");
    recordOperation({
      action: "wechat.publish.unknown.resolve",
      targetType: "article",
      targetId: articleId,
      status: "info",
      resultSummary: "管理员确认微信后台无发表任务，恢复为草稿状态",
    });
    refreshArticlePaths(articleId);
    return { error: "", success: "已恢复为草稿，可重新提交" };
  } catch (error) {
    return actionError(error);
  }
}

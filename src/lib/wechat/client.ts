import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { Article } from "@/lib/db/types";

const apiOrigin = "https://api.weixin.qq.com";
type WechatResult = Record<string, unknown> & {
  errcode?: number;
  errmsg?: string;
};

type CachedToken = {
  value: string;
  expiresAt: number;
  refreshAt: number;
};

let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

export class WechatApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly uncertain = false,
  ) {
    super(message);
    this.name = "WechatApiError";
  }
}

export function isWechatConfigured() {
  return Boolean(process.env.WECHAT_APP_ID?.trim() && process.env.WECHAT_APP_SECRET?.trim());
}

function getWechatConfig() {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new WechatApiError("尚未配置公众号 AppID / AppSecret");
  return {
    appId,
    appSecret,
  };
}

function buildApiUrl(apiPath: string, params: Record<string, string> = {}) {
  const url = new URL(apiPath, apiOrigin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function requestJson(url: URL, options: RequestInit, action: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new WechatApiError(
      `${action}失败：${error instanceof Error ? error.message : "网络连接异常"}`,
      undefined,
      true,
    );
  }

  const text = await response.text();
  let result: WechatResult;
  try {
    result = JSON.parse(text) as WechatResult;
  } catch {
    throw new WechatApiError(`${action}失败：微信返回了无法解析的结果`, undefined, response.ok);
  }

  if (!response.ok) {
    throw new WechatApiError(`${action}失败：HTTP ${response.status}`, undefined, response.status >= 500);
  }
  if (result.errcode && result.errcode !== 0) {
    throw new WechatApiError(
      `${action}失败：${result.errmsg || "微信接口返回错误"} (${result.errcode})`,
      result.errcode,
    );
  }
  return result;
}

async function fetchAccessToken() {
  const config = getWechatConfig();
  const result = await requestJson(
    buildApiUrl("/cgi-bin/stable_token"),
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.appSecret,
        force_refresh: false,
      }),
    },
    "获取 access_token",
  );

  const accessToken = typeof result.access_token === "string" ? result.access_token : "";
  if (!accessToken) throw new WechatApiError("微信未返回 access_token");
  const expiresIn = Math.max(1, Number(result.expires_in || 7200));
  const expiresInMs = expiresIn * 1000;
  const refreshMarginMs = Math.min(5 * 60 * 1000, Math.max(5_000, expiresInMs * 0.1));
  const now = Date.now();
  cachedToken = {
    value: accessToken,
    expiresAt: now + expiresInMs,
    refreshAt: now + expiresInMs - refreshMarginMs,
  };
  return accessToken;
}

export async function getAccessToken() {
  if (cachedToken && cachedToken.refreshAt > Date.now() && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  if (!tokenRequest) {
    tokenRequest = fetchAccessToken().finally(() => {
      tokenRequest = null;
    });
  }
  return tokenRequest;
}

async function withAccessToken<T>(request: (accessToken: string) => Promise<T>) {
  try {
    return await request(await getAccessToken());
  } catch (error) {
    if (error instanceof WechatApiError && [40001, 40014, 42001].includes(error.code || 0)) {
      cachedToken = null;
      return request(await getAccessToken());
    }
    throw error;
  }
}

async function postWechat(apiPath: string, body: unknown, action: string) {
  return withAccessToken((accessToken) =>
    requestJson(
      buildApiUrl(apiPath, { access_token: accessToken }),
      {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      },
      action,
    ),
  );
}

async function getWechat(apiPath: string, action: string) {
  return withAccessToken((accessToken) =>
    requestJson(
      buildApiUrl(apiPath, { access_token: accessToken }),
      { method: "GET" },
      action,
    ),
  );
}

async function uploadWechatImage(input: {
  apiPath: string;
  absolutePath: string;
  action: string;
  params?: Record<string, string>;
}) {
  return withAccessToken(async (accessToken) => {
    const fileBuffer = await fs.readFile(input.absolutePath);
    const extension = path.extname(input.absolutePath).toLowerCase();
    const mimeType =
      extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    const formData = new FormData();
    formData.append(
      "media",
      new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
      path.basename(input.absolutePath),
    );
    return requestJson(
      buildApiUrl(input.apiPath, {
        access_token: accessToken,
        ...(input.params || {}),
      }),
      { method: "POST", body: formData },
      input.action,
    );
  });
}

export async function checkWechatConnection() {
  const token = await getAccessToken();
  return Boolean(token);
}

export async function uploadPermanentThumb(absolutePath: string) {
  const result = await uploadWechatImage({
    apiPath: "/cgi-bin/material/add_material",
    absolutePath,
    action: "上传文章封面",
    params: { type: "thumb" },
  });
  const mediaId = typeof result.media_id === "string" ? result.media_id : "";
  if (!mediaId) throw new WechatApiError("微信未返回封面 media_id");
  return mediaId;
}

export async function uploadInlineImage(absolutePath: string) {
  const result = await uploadWechatImage({
    apiPath: "/cgi-bin/media/uploadimg",
    absolutePath,
    action: "上传正文图片",
  });
  let url = typeof result.url === "string" ? result.url : "";
  if (!url) throw new WechatApiError("微信未返回正文图片 URL");
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" && parsed.hostname.endsWith("qpic.cn")) {
      parsed.protocol = "https:";
      url = parsed.toString();
    }
  } catch {
    throw new WechatApiError("微信返回了不合法的正文图片 URL");
  }
  return url;
}

function addInlineWechatStyles(html: string) {
  const replacements: [RegExp, string][] = [
    [/<h1>/g, '<h1 style="margin:0 0 24px;color:#153b5b;font-size:26px;line-height:1.45;font-weight:700;">'],
    [/<h2>/g, '<h2 style="margin:32px 0 14px;border-left:4px solid #1f7a65;padding-left:12px;color:#153b5b;font-size:20px;line-height:1.5;font-weight:700;">'],
    [/<h3>/g, '<h3 style="margin:24px 0 12px;color:#153b5b;font-size:17px;line-height:1.5;font-weight:700;">'],
    [/<p>/g, '<p style="margin:0 0 16px;color:#27313d;font-size:15px;line-height:1.9;letter-spacing:0.2px;">'],
    [/<blockquote>/g, '<blockquote style="margin:20px 0;border-left:3px solid #5aa68f;background:#eef7f3;padding:14px 16px;color:#36574d;">'],
    [/<ul>/g, '<ul style="margin:0 0 18px;padding-left:22px;color:#27313d;font-size:15px;line-height:1.9;">'],
    [/<ol>/g, '<ol style="margin:0 0 18px;padding-left:22px;color:#27313d;font-size:15px;line-height:1.9;">'],
    [/<img /g, '<img style="display:block;max-width:100%;height:auto;margin:22px auto;" '],
    [/<a /g, '<a style="color:#1f7a65;text-decoration:underline;" '],
    [/<hr>/g, '<hr style="margin:28px 0;border:0;border-top:1px solid #dce7e2;">'],
  ];
  return replacements.reduce((content, [pattern, replacement]) => content.replace(pattern, replacement), html);
}

export function markdownToWechatHtml(markdown: string, title: string) {
  const lines = markdown.trim().split(/\r?\n/);
  if (lines[0]?.replace(/^#\s+/, "").trim() === title.trim()) lines.shift();
  const rendered = marked.parse(lines.join("\n"), {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;
  const clean = sanitizeHtml(rendered, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "p",
      "strong",
      "em",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "code",
      "pre",
      "hr",
      "img",
      "br",
    ],
    allowedAttributes: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["https"],
  });
  return `<section style="max-width:100%;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">${addInlineWechatStyles(clean)}</section>`;
}

export function sanitizeWechatHtmlContent(html: string) {
  const clean = sanitizeHtml(html, {
    allowedTags: [
      "section",
      "h1",
      "h2",
      "h3",
      "p",
      "span",
      "strong",
      "em",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "code",
      "pre",
      "hr",
      "img",
      "br",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title", "target", "style"],
      img: ["src", "alt", "title", "style"],
    },
    allowedSchemes: ["https"],
  });
  if (!clean.trim()) throw new WechatApiError("文章正文为空");
  return clean;
}

function buildDraftArticle(article: Article, content: string, thumbMediaId: string) {
  return {
    title: article.title,
    author:
      process.env.WECHAT_AUTHOR?.trim() || process.env.WECHAT_ACCOUNT_NAME?.trim() || "",
    digest: article.digest,
    content,
    content_source_url: process.env.WECHAT_CONTENT_SOURCE_URL?.trim() || "",
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
}

async function verifyWechatDraft(mediaId: string, article: Article) {
  const result = await postWechat(
    "/cgi-bin/draft/get",
    { media_id: mediaId },
    "回读微信草稿",
  );
  const first = (result.news_item as Record<string, unknown>[] | undefined)?.[0];
  if (!first || first.title !== article.title) {
    throw new WechatApiError("草稿回读校验失败：标题不一致");
  }
  if (article.digest && first.digest !== article.digest) {
    throw new WechatApiError("草稿回读校验失败：摘要不一致");
  }
  if (typeof first.content !== "string" || !first.content.trim()) {
    throw new WechatApiError("草稿回读校验失败：正文为空");
  }
}

export async function upsertWechatDraftHtml(
  article: Article,
  html: string,
  thumbMediaId: string,
) {
  const content = sanitizeWechatHtmlContent(html);
  const draftArticle = buildDraftArticle(article, content, thumbMediaId);

  if (article.wechatDraftMediaId) {
    try {
      await postWechat(
        "/cgi-bin/draft/update",
        {
          media_id: article.wechatDraftMediaId,
          index: 0,
          articles: draftArticle,
        },
        "更新微信草稿",
      );
      await verifyWechatDraft(article.wechatDraftMediaId, article);
      return { mediaId: article.wechatDraftMediaId, action: "updated" as const };
    } catch (error) {
      if (!(error instanceof WechatApiError) || ![40007, 40008].includes(error.code || 0)) throw error;
    }
  }

  const result = await postWechat(
    "/cgi-bin/draft/add",
    { articles: [draftArticle] },
    "创建微信草稿",
  );
  const mediaId = typeof result.media_id === "string" ? result.media_id : "";
  if (!mediaId) throw new WechatApiError("微信未返回草稿 media_id");
  await verifyWechatDraft(mediaId, article);
  return { mediaId, action: "created" as const };
}

export async function upsertWechatDraft(article: Article, thumbMediaId: string) {
  return upsertWechatDraftHtml(
    article,
    markdownToWechatHtml(article.content, article.title),
    thumbMediaId,
  );
}

export async function listWechatDrafts(count = 20) {
  return postWechat(
    "/cgi-bin/draft/batchget",
    { offset: 0, count: Math.min(Math.max(count, 1), 20), no_content: 0 },
    "读取微信草稿箱",
  );
}

export async function submitWechatPublish(mediaId: string) {
  const result = await postWechat(
    "/cgi-bin/freepublish/submit",
    { media_id: mediaId },
    "提交文章发表",
  );
  const publishId = typeof result.publish_id === "string" ? result.publish_id : "";
  if (!publishId) throw new WechatApiError("微信未返回 publish_id", undefined, true);
  return publishId;
}

export async function getWechatPublishStatus(publishId: string) {
  const result = await postWechat(
    "/cgi-bin/freepublish/get",
    { publish_id: publishId },
    "查询发表状态",
  );
  const status = Number(result.publish_status);
  const articleDetail = result.article_detail as
    | { item?: { article_url?: string }[] }
    | undefined;
  return {
    status,
    articleId: typeof result.article_id === "string" ? result.article_id : null,
    articleUrl: articleDetail?.item?.[0]?.article_url || null,
    failIndex: result.fail_idx,
  };
}

export async function getCurrentWechatMenu() {
  return getWechat("/cgi-bin/get_current_selfmenu_info", "读取当前菜单");
}

export async function publishWechatMenu(menu: unknown) {
  return postWechat("/cgi-bin/menu/create", menu, "同步自定义菜单");
}

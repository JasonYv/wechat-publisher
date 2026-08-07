import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  Article,
  ArticleAsset,
  ArticleStatus,
  DashboardStats,
  OperationLog,
  PublishJob,
} from "@/lib/db/types";

const seedArticle = `# 欢迎使用微信公众号内容台

这是一篇本地示例稿，用来帮助你熟悉文章编辑、微信预览、封面处理与发表流程。

## 建议的发布流程

1. 在本地编辑并保存文章。
2. 上传封面，在预览中检查排版。
3. 同步到微信草稿箱，再在微信后台做最终预览。
4. 人工确认后提交发表，并回查发表结果。

## 开始之前

请先在服务器环境变量中配置管理员密码、会话密钥与微信公众号凭据。不要把 AppSecret 、Token 或真实数据库提交到 Git。`;

function databasePath() {
  const configuredPath = process.env.DATABASE_PATH?.trim();
  return path.resolve(configuredPath || path.join(process.cwd(), "data", "wechat-publisher.db"));
}

function initializeDatabase() {
  const filePath = databasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      digest TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'local',
      cover_path TEXT,
      wechat_draft_media_id TEXT,
      publish_id TEXT,
      article_id TEXT,
      article_url TEXT,
      last_synced_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      local_path TEXT NOT NULL,
      file_hash TEXT,
      wechat_media_id TEXT,
      wechat_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publish_jobs (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      publish_id TEXT,
      status TEXT NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      status TEXT NOT NULL,
      result_summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_publish_requests (
      request_id TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      article_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const articleColumns = database.prepare("PRAGMA table_info(articles)").all() as {
    name: string;
  }[];
  const columnNames = new Set(articleColumns.map((column) => column.name));
  if (!columnNames.has("last_synced_at")) {
    database.exec("ALTER TABLE articles ADD COLUMN last_synced_at TEXT");
  }
  if (!columnNames.has("published_at")) {
    database.exec("ALTER TABLE articles ADD COLUMN published_at TEXT");
  }

  const articleCount = database.prepare("SELECT COUNT(*) AS count FROM articles").get() as {
    count: number;
  };
  if (articleCount.count === 0) {
    const now = new Date().toISOString();
    const insert = database.prepare(`
      INSERT INTO articles (
        id, title, digest, content, status, cover_path,
        wechat_draft_media_id, publish_id, article_id, article_url,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedRows = [
      {
        title: "欢迎使用微信公众号内容台",
        digest: "通过一篇本地示例稿，熟悉编辑、预览、同步草稿和人工发表流程。",
        content: seedArticle,
        status: "local",
      },
    ] as const;

    for (const row of seedRows) {
      insert.run(
        randomUUID(),
        row.title,
        row.digest,
        row.content,
        row.status,
        null,
        null,
        null,
        null,
        null,
        now,
        now,
      );
    }

    database
      .prepare(`
        INSERT INTO operation_logs (
          action, target_type, target_id, status, result_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run("system.bootstrap", "system", null, "info", "初始化本地内容库与示例文章", now);
  }

  return database;
}

declare global {
  var __wechatPublisherDatabase: Database.Database | undefined;
}

export function getDatabase() {
  if (!globalThis.__wechatPublisherDatabase) {
    globalThis.__wechatPublisherDatabase = initializeDatabase();
  }
  return globalThis.__wechatPublisherDatabase;
}

function mapArticle(row: Record<string, unknown>): Article {
  return {
    id: String(row.id),
    title: String(row.title),
    digest: String(row.digest ?? ""),
    content: String(row.content ?? ""),
    status: String(row.status) as ArticleStatus,
    coverPath: row.cover_path ? String(row.cover_path) : null,
    wechatDraftMediaId: row.wechat_draft_media_id ? String(row.wechat_draft_media_id) : null,
    publishId: row.publish_id ? String(row.publish_id) : null,
    articleId: row.article_id ? String(row.article_id) : null,
    articleUrl: row.article_url ? String(row.article_url) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

export function listArticles(limit = 100): Article[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM articles ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapArticle);
}

export function getArticle(id: string): Article | null {
  const row = getDatabase().prepare("SELECT * FROM articles WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapArticle(row) : null;
}

export type ExternalPublishRequestStatus =
  | "processing"
  | "submitted"
  | "published"
  | "failed"
  | "unknown";

export type ExternalPublishRequest = {
  requestId: string;
  requestHash: string;
  articleId: string;
  status: ExternalPublishRequestStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapExternalPublishRequest(row: Record<string, unknown>): ExternalPublishRequest {
  return {
    requestId: String(row.request_id),
    requestHash: String(row.request_hash),
    articleId: String(row.article_id),
    status: String(row.status) as ExternalPublishRequestStatus,
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function getExternalPublishRequest(requestId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM external_publish_requests WHERE request_id = ?")
    .get(requestId) as Record<string, unknown> | undefined;
  return row ? mapExternalPublishRequest(row) : null;
}

export function claimExternalPublishRequest(input: {
  requestId: string;
  requestHash: string;
}) {
  const database = getDatabase();
  return database.transaction(() => {
    const existing = getExternalPublishRequest(input.requestId);
    if (existing) {
      if (existing.requestHash !== input.requestHash) return "conflict" as const;
      if (existing.status !== "failed") {
        return "existing" as const;
      }
      database
        .prepare(`
          UPDATE external_publish_requests
          SET status = 'processing', error = NULL, updated_at = ?
          WHERE request_id = ?
        `)
        .run(new Date().toISOString(), input.requestId);
      return "claimed" as const;
    }

    const now = new Date().toISOString();
    database
      .prepare(`
        INSERT INTO external_publish_requests (
          request_id, request_hash, article_id, status, error, created_at, updated_at
        ) VALUES (?, ?, ?, 'processing', NULL, ?, ?)
      `)
      .run(input.requestId, input.requestHash, input.requestId, now, now);
    return "claimed" as const;
  })();
}

export function updateExternalPublishRequest(
  requestId: string,
  status: ExternalPublishRequestStatus,
  error?: string | null,
) {
  getDatabase()
    .prepare(`
      UPDATE external_publish_requests
      SET status = ?, error = ?, updated_at = ?
      WHERE request_id = ?
    `)
    .run(status, error || null, new Date().toISOString(), requestId);
}

export function saveArticle(input: {
  id?: string;
  title: string;
  digest: string;
  content: string;
  status?: ArticleStatus;
}) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = input.id ? getArticle(input.id) : null;

  if (existing) {
    database
      .prepare(`
        UPDATE articles
        SET title = ?, digest = ?, content = ?, status = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title,
        input.digest,
        input.content,
        input.status || (existing.status === "local" ? "local" : "modified"),
        now,
        id,
      );
  } else {
    database
      .prepare(`
        INSERT INTO articles (
          id, title, digest, content, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, input.title, input.digest, input.content, input.status || "local", now, now);
  }

  recordOperation({
    action: existing ? "article.update" : "article.create",
    targetType: "article",
    targetId: id,
    status: "success",
    resultSummary: existing ? "保存文章修改" : "创建本地文章",
  });

  return id;
}

export function getDashboardStats(): DashboardStats {
  const rows = getDatabase()
    .prepare("SELECT status, COUNT(*) AS count FROM articles GROUP BY status")
    .all() as { status: ArticleStatus; count: number }[];
  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count])) as Partial<
    Record<ArticleStatus, number>
  >;
  return {
    local: (counts.local || 0) + (counts.modified || 0),
    draft: counts.draft || 0,
    pending: (counts.publishing || 0) + (counts.failed || 0),
    published: counts.published || 0,
  };
}

export function updateArticleCover(articleId: string, localPath: string, fileHash: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const assetId = randomUUID();
  const article = getArticle(articleId);
  if (!article) throw new Error("文章不存在");
  const nextStatus = article.status === "local" ? "local" : "modified";

  database.transaction(() => {
    database
      .prepare("UPDATE articles SET cover_path = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(localPath, nextStatus, now, articleId);
    database
      .prepare(`
        INSERT INTO assets (
          id, article_id, kind, local_path, file_hash, wechat_media_id, wechat_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(assetId, articleId, "cover", localPath, fileHash, null, null, now);
  })();

  recordOperation({
    action: "article.cover.update",
    targetType: "article",
    targetId: articleId,
    status: "success",
    resultSummary: "更新文章封面",
  });
}

export function getArticleCoverAsset(articleId: string): ArticleAsset | null {
  const row = getDatabase()
    .prepare(`
      SELECT * FROM assets
      WHERE article_id = ? AND kind = 'cover'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(articleId) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    kind: "cover",
    localPath: String(row.local_path),
    fileHash: row.file_hash ? String(row.file_hash) : null,
    wechatMediaId: row.wechat_media_id ? String(row.wechat_media_id) : null,
    wechatUrl: row.wechat_url ? String(row.wechat_url) : null,
    createdAt: String(row.created_at),
  };
}

export function updateAssetWechatMedia(assetId: string, mediaId: string) {
  getDatabase()
    .prepare("UPDATE assets SET wechat_media_id = ? WHERE id = ?")
    .run(mediaId, assetId);
}

export function createArticleAsset(input: {
  articleId: string;
  kind: "cover" | "inline";
  localPath: string;
  fileHash: string;
  wechatUrl?: string | null;
}) {
  const id = randomUUID();
  getDatabase()
    .prepare(`
      INSERT INTO assets (
        id, article_id, kind, local_path, file_hash, wechat_media_id, wechat_url, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `)
    .run(
      id,
      input.articleId,
      input.kind,
      input.localPath,
      input.fileHash,
      input.wechatUrl || null,
      new Date().toISOString(),
    );
  return id;
}

export function updateAssetWechatUrl(assetId: string, wechatUrl: string) {
  getDatabase().prepare("UPDATE assets SET wechat_url = ? WHERE id = ?").run(wechatUrl, assetId);
}

export function markArticleAsDraft(articleId: string, mediaId: string) {
  const now = new Date().toISOString();
  return getDatabase()
    .prepare(`
      UPDATE articles
      SET status = 'draft', wechat_draft_media_id = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('local', 'modified', 'draft')
    `)
    .run(mediaId, now, now, articleId);
}

export function claimPublishSubmission(articleId: string) {
  const database = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const claimed = database.transaction(() => {
    const update = database
      .prepare(`
        UPDATE articles
        SET status = 'publishing', updated_at = ?
        WHERE id = ? AND status = 'draft'
      `)
      .run(now, articleId);
    if (update.changes !== 1) return false;
    database
      .prepare(`
        INSERT INTO publish_jobs (
          id, article_id, publish_id, status, error, started_at, finished_at
        ) VALUES (?, ?, NULL, 'queued', NULL, ?, NULL)
      `)
      .run(id, articleId, now);
    return true;
  })();
  return claimed ? id : null;
}

export function attachPublishId(jobId: string, articleId: string, publishId: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare("UPDATE publish_jobs SET publish_id = ?, status = 'processing' WHERE id = ?")
      .run(publishId, jobId);
    database
      .prepare("UPDATE articles SET publish_id = ?, updated_at = ? WHERE id = ?")
      .run(publishId, now, articleId);
  })();
}

export function failPublishSubmissionIntent(input: {
  jobId: string;
  articleId: string;
  error: string;
  uncertain: boolean;
}) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare("UPDATE publish_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?")
      .run(input.uncertain ? "unknown" : "failed", input.error, now, input.jobId);
    if (!input.uncertain) {
      database
        .prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?")
        .run(now, input.articleId);
    }
  })();
}

export function resolveUnknownPublishSubmission(articleId: string) {
  const database = getDatabase();
  const latest = database
    .prepare(`
      SELECT status, publish_id
      FROM publish_jobs
      WHERE article_id = ?
      ORDER BY started_at DESC
      LIMIT 1
    `)
    .get(articleId) as { status?: string; publish_id?: string | null } | undefined;
  if (!latest || latest.publish_id || !["queued", "unknown"].includes(latest.status || "")) {
    throw new Error("当前任务不属于可人工解除的不确定状态");
  }
  getDatabase()
    .prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ? AND status = 'publishing'")
    .run(new Date().toISOString(), articleId);
}

export function completePublishJob(input: {
  articleId: string;
  publishId: string;
  articleIdFromWechat?: string | null;
  articleUrl?: string | null;
}) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare(`
        UPDATE publish_jobs
        SET status = 'published', finished_at = ?, error = NULL
        WHERE article_id = ? AND publish_id = ?
      `)
      .run(now, input.articleId, input.publishId);
    database
      .prepare(`
        UPDATE articles
        SET status = 'published', article_id = ?, article_url = ?, published_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(input.articleIdFromWechat || null, input.articleUrl || null, now, now, input.articleId);
  })();
}

export function failPublishJob(articleId: string, publishId: string, error: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare(`
        UPDATE publish_jobs
        SET status = 'failed', error = ?, finished_at = ?
        WHERE article_id = ? AND publish_id = ?
      `)
      .run(error, now, articleId, publishId);
    database
      .prepare("UPDATE articles SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(now, articleId);
  })();
}

export function listPublishJobs(limit = 50): PublishJob[] {
  return getDatabase()
    .prepare(`
      SELECT
        publish_jobs.id,
        publish_jobs.article_id,
        articles.title AS article_title,
        publish_jobs.publish_id,
        publish_jobs.status,
        publish_jobs.error,
        publish_jobs.started_at,
        publish_jobs.finished_at
      FROM publish_jobs
      JOIN articles ON articles.id = publish_jobs.article_id
      ORDER BY publish_jobs.started_at DESC
      LIMIT ?
    `)
    .all(limit)
    .map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: String(value.id),
        articleId: String(value.article_id),
        articleTitle: String(value.article_title),
        publishId: value.publish_id ? String(value.publish_id) : null,
        status: String(value.status) as PublishJob["status"],
        error: value.error ? String(value.error) : null,
        startedAt: String(value.started_at),
        finishedAt: value.finished_at ? String(value.finished_at) : null,
      };
    });
}

export function listOperationLogs(limit = 100): OperationLog[] {
  return getDatabase()
    .prepare("SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: Number(value.id),
        action: String(value.action),
        targetType: String(value.target_type),
        targetId: value.target_id ? String(value.target_id) : null,
        status: String(value.status) as OperationLog["status"],
        resultSummary: String(value.result_summary),
        createdAt: String(value.created_at),
      };
    });
}

export function recordOperation(input: Omit<OperationLog, "id" | "createdAt">) {
  getDatabase()
    .prepare(`
      INSERT INTO operation_logs (
        action, target_type, target_id, status, result_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.action,
      input.targetType,
      input.targetId,
      input.status,
      input.resultSummary,
      new Date().toISOString(),
    );
}

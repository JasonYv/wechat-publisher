import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { wechatTextUnits } from "@/lib/wechat/limits";

const defaultMenu = {
  button: [
    {
      name: "内容服务",
      sub_button: [
        {
          type: "view",
          name: "最新内容",
          url: "https://example.com/articles",
        },
        {
          type: "view",
          name: "服务介绍",
          url: "https://example.com/services",
        },
      ],
    },
    {
      name: "关于我们",
      sub_button: [
        {
          type: "view",
          name: "公司介绍",
          url: "https://example.com/about",
        },
        {
          type: "view",
          name: "联系我们",
          url: "https://example.com/contact",
        },
      ],
    },
    {
      type: "view",
      name: "官方网站",
      url: "https://example.com/",
    },
  ],
};

const leafSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(["view", "click", "miniprogram", "article_view_limited"]),
    url: z.string().optional(),
    key: z.string().optional(),
    appid: z.string().optional(),
    pagepath: z.string().optional(),
    article_id: z.string().optional(),
  })
  .passthrough()
  .superRefine((item, context) => {
    if (item.type === "view" && !item.url) context.addIssue({ code: "custom", message: `${item.name} 缺少 url` });
    if (item.type === "click" && !item.key) context.addIssue({ code: "custom", message: `${item.name} 缺少 key` });
    if (item.type === "miniprogram" && (!item.appid || !item.pagepath || !item.url)) {
      context.addIssue({ code: "custom", message: `${item.name} 缺少 appid、pagepath 或兼容 url` });
    }
    if (item.type === "article_view_limited" && !item.article_id) {
      context.addIssue({ code: "custom", message: `${item.name} 缺少 article_id` });
    }
  });

const topLevelSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(["view", "click", "miniprogram", "article_view_limited"]).optional(),
    url: z.string().optional(),
    key: z.string().optional(),
    appid: z.string().optional(),
    pagepath: z.string().optional(),
    article_id: z.string().optional(),
    sub_button: z.array(leafSchema).max(5, "每个一级菜单最多 5 个二级菜单").optional(),
  })
  .passthrough();

export const menuSchema = z
  .object({
    button: z.array(topLevelSchema).min(1).max(3, "最多只能设置 3 个一级菜单"),
  })
  .superRefine((menu, context) => {
    menu.button.forEach((item, index) => {
      if (wechatTextUnits(item.name) > 4) {
        context.addIssue({ code: "custom", path: ["button", index, "name"], message: `一级菜单“${item.name}”超过 4 字` });
      }
      const children = item.sub_button || [];
      if (children.length && item.type) {
        context.addIssue({ code: "custom", path: ["button", index], message: `${item.name} 不能同时设置 type 和 sub_button` });
      }
      if (!children.length && !item.type) {
        context.addIssue({ code: "custom", path: ["button", index], message: `${item.name} 需要 type 或 sub_button` });
      }
      children.forEach((child, childIndex) => {
        if (wechatTextUnits(child.name) > 8) {
          context.addIssue({ code: "custom", path: ["button", index, "sub_button", childIndex, "name"], message: `二级菜单“${child.name}”超过 8 字` });
        }
      });
      if (!children.length) {
        const result = leafSchema.safeParse(item);
        if (!result.success) {
          context.addIssue({ code: "custom", path: ["button", index], message: result.error.issues[0]?.message || `${item.name} 配置不完整` });
        }
      }
    });
  });

export type MenuConfig = z.infer<typeof menuSchema>;

function dataRoot() {
  const configuredDatabasePath = process.env.DATABASE_PATH?.trim();
  return configuredDatabasePath
    ? path.dirname(path.resolve(configuredDatabasePath))
    : path.resolve(process.cwd(), "data");
}

function menuFile() {
  return path.join(dataRoot(), "menu.json");
}

export async function getMenuConfig(): Promise<MenuConfig> {
  try {
    return menuSchema.parse(JSON.parse(await fs.readFile(menuFile(), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return menuSchema.parse(defaultMenu);
    throw error;
  }
}

export async function saveMenuConfig(menu: unknown) {
  const parsed = menuSchema.parse(menu);
  await fs.mkdir(dataRoot(), { recursive: true });
  const target = menuFile();
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, target);
  return parsed;
}

export async function saveMenuBackup(menu: unknown) {
  const backupDirectory = path.join(dataRoot(), "menu-backups");
  await fs.mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupDirectory, `menu-${timestamp}.json`);
  await fs.writeFile(target, `${JSON.stringify(menu, null, 2)}\n`, { mode: 0o600 });
  return target;
}

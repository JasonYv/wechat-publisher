# 微信公众号内容台

Wechat Publisher 是一套可自托管的单公众号内容发布系统。它把文章、封面、微信草稿、发表回执与自定义菜单放在一个清晰的管理界面中。

`Markdown 本地稿 → 微信草稿 → 人工确认发表 → 回查并保存结果`

项目使用 Next.js App Router、React、shadcn/ui、Tailwind CSS 和 SQLite，适合在拥有固定出口 IP 的单台服务器上部署。

## 功能

- 单管理员密码登录，使用签名 HttpOnly Cookie 维持会话。
- Markdown 编辑、微信样式预览与本地保存。
- 封面自动裁剪为 900×383 JPG，并压缩到微信素材限制内。
- 正文图片上传到微信素材域名，自动插入 Markdown。
- 新建或更新微信草稿，并通过 `draft/get` 回读校验。
- 二次确认后提交发表，通过 `freepublish/get` 回查异步状态。
- 发表请求原子抢占与结果不确定锁定，降低重复发表风险。
- 自定义菜单 JSON 校验、手机预览、本地保存，覆盖前自动备份微信现有菜单。
- SQLite 保存文章、素材、发布任务与操作日志。
- Docker 单机部署与健康检查。

## 运行要求

- Node.js 22 或更高版本
- pnpm 11
- 具有相关 API 权限的微信公众号
- 可加入微信 IP 白名单的固定服务器出口 IP

微信接口权限会因公众号类型、认证状态和平台政策而不同。如遇 `48001` 等错误，请先到微信公众平台检查当前账号的接口权限。

## 本地启动

```bash
git clone https://github.com/jasonyv/wechat-publisher.git
cd wechat-publisher
cp .env.example .env.local
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。至少需要配置：

- `ADMIN_PASSWORD`：管理员登录密码。
- `SESSION_SECRET`：不少于 32 个字符的随机会话密钥。
- `WECHAT_APP_ID` / `WECHAT_APP_SECRET`：微信公众号服务器端凭据。
- `WECHAT_ACCOUNT_NAME`：管理界面中显示的公众号名称。

生成会话密钥：

```bash
openssl rand -base64 48
```

默认菜单使用 `example.com` 作为占位地址。在点击“同步到微信”之前，务必改成你自己的链接并检查手机预览。

## Docker 部署

```bash
cp .env.example .env
docker compose up -d --build
```

`data/` 保存 SQLite、菜单配置和备份，`uploads/` 保存本地素材。两个目录均已挂载为持久化卷，请定期备份。

## 上线前检查

1. 将服务器固定出口 IP 加入微信公众平台白名单。
2. 确认账号具有素材、草稿、发表和自定义菜单接口权限。
3. 使用 Nginx 或 Caddy 启用 HTTPS，不对外暴露 SQLite、上传目录和管理端口。
4. 使用强管理员密码，并为每个环境生成独立的 `SESSION_SECRET`。
5. AppSecret 、Token 与真实 `.env` 只保存在服务器。如果凭据曾出现在代码、日志或聊天中，应先在微信后台重置。

## 当前边界

- 面向单管理员、单公众号的自托管场景，暂不提供多租户和角色权限。
- 发表前仍建议在微信草稿箱内做最终预览。
- 应用不会自动撤回已提交的发表任务。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 许可证

[MIT](./LICENSE)

本项目与腾讯、微信或微信公众平台无隶属或授权关系。使用者需自行遵守微信开放平台的服务协议与运营规则。

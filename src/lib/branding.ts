import "server-only";

export function getBranding() {
  return {
    appName: process.env.APP_NAME?.trim() || "公众号内容台",
    appSubtitle: process.env.APP_SUBTITLE?.trim() || "WeChat Publisher",
    accountName: process.env.WECHAT_ACCOUNT_NAME?.trim() || "未命名公众号",
  };
}

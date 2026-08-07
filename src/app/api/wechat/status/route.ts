import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/session";
import {
  checkWechatConnection,
  isWechatConfigured,
  WechatApiError,
} from "@/lib/wechat/client";
import { getBranding } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function connectionMessage(error: unknown) {
  if (error instanceof WechatApiError) {
    if (error.code === 40164) return "服务器出口 IP 不在微信白名单";
    if (error.code === 40013) return "AppID 无效，请检查配置";
    if (error.code === 40125) return "AppSecret 无效或已重置";
    if (error.code === 48001) return "当前公众号没有该接口权限";
    return error.message;
  }
  return "连接微信接口失败";
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const configured = isWechatConfigured();
  const { accountName } = getBranding();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      accountName,
      message: "尚未配置 AppID / AppSecret",
    });
  }

  try {
    await checkWechatConnection();
    return NextResponse.json({
      configured: true,
      connected: true,
      accountName,
      message: "已连接，可调用微信接口",
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      accountName,
      message: connectionMessage(error),
    });
  }
}

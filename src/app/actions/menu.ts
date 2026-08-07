"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import { recordOperation } from "@/lib/db";
import { saveMenuBackup, saveMenuConfig } from "@/lib/menu-store";
import { getCurrentWechatMenu, publishWechatMenu } from "@/lib/wechat/client";

export type MenuActionState = { error: string; success: string };

function parseMenu(formData: FormData) {
  const raw = String(formData.get("menuJson") || "");
  if (!raw.trim()) throw new Error("菜单 JSON 不能为空");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("菜单 JSON 格式不正确");
  }
}

function resultError(error: unknown): MenuActionState {
  return { error: error instanceof Error ? error.message : "菜单操作失败", success: "" };
}

export async function saveMenuAction(
  _state: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  await requireAdminSession();
  try {
    await saveMenuConfig(parseMenu(formData));
    recordOperation({ action: "menu.save", targetType: "menu", targetId: null, status: "success", resultSummary: "保存本地菜单配置" });
    revalidatePath("/menu");
    return { error: "", success: "本地菜单已保存，尚未覆盖微信菜单" };
  } catch (error) {
    return resultError(error);
  }
}

export async function syncMenuAction(
  _state: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  await requireAdminSession();
  try {
    const menu = await saveMenuConfig(parseMenu(formData));
    const current = await getCurrentWechatMenu();
    await saveMenuBackup(current);
    await publishWechatMenu(menu);
    recordOperation({ action: "wechat.menu.publish", targetType: "menu", targetId: null, status: "success", resultSummary: "已备份旧菜单并同步新菜单" });
    revalidatePath("/menu");
    return { error: "", success: "菜单已同步，微信客户端可能需要几分钟刷新" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步菜单失败";
    recordOperation({ action: "wechat.menu.publish", targetType: "menu", targetId: null, status: "failed", resultSummary: message });
    return resultError(error);
  }
}

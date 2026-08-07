"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  createAdminSession,
  isAuthConfigured,
  verifyAdminPassword,
} from "@/lib/auth/session";

export type LoginState = {
  error: string;
};

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return { error: "请先在 .env.local 中配置 ADMIN_PASSWORD 和 SESSION_SECRET。" };
  }
  const password = String(formData.get("password") || "");
  if (!verifyAdminPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { error: "密码不正确，请重新输入。" };
  }

  await createAdminSession();
  redirect("/");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

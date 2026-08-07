import { MenuEditor } from "@/components/menu-editor";
import { PageHeader } from "@/components/page-header";
import { getMenuConfig } from "@/lib/menu-store";
import { getBranding } from "@/lib/branding";

export const metadata = { title: "菜单管理" };

export default async function MenuPage() {
  const menu = await getMenuConfig();
  const { accountName } = getBranding();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Menu console"
        title="公众号菜单"
        description="本地保存和覆盖微信是两个独立动作。发布前会校验数量、名称和类型字段。"
      />
      <MenuEditor
        initialMenu={menu}
        accountName={accountName}
        wechatConfigured={Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET)}
      />
    </div>
  );
}

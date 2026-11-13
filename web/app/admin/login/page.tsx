import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理后台 · 魔兽争霸开源版",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="admin-login">
      <div className="ow3-panel admin-login__panel">
        <h1 className="ow3-heading ow3-heading--sm">管理后台</h1>
        <p className="admin-login__hint">请输入管理员密码。密码由服务端环境变量 ADMIN_PASSWORD 配置。</p>
        <LoginForm />
      </div>
    </main>
  );
}

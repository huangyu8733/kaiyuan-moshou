import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/i18n/config";

// 兜底：即使 proxy 没有生效（例如被反向代理直接命中），根路径也落到默认语言。
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}

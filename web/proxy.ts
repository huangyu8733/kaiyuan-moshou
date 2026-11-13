import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

// 所有前台页面都带语言前缀（/zh/…、/en/…）。这里只做两件事：
// 1. 没有前缀的路径补上用户偏好的语言（cookie）或默认语言；
// 2. 前缀不是已注册语言时，同样回落。
// 后台、API、下载跳转与静态资源不参与语言前缀。
const BYPASS = ["/admin", "/api", "/download", "/_next"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BYPASS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const remembered = request.cookies.get("ow3_locale")?.value;
  const locale = isLocale(remembered) ? remembered : DEFAULT_LOCALE;
  const suffix = pathname === "/" ? "" : pathname;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${suffix}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|admin|download|_next|.*\\..*).*)"],
};

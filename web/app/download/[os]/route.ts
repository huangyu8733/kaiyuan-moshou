import { RELEASES_URL, isPlatform, latestRelease } from "@/lib/github";
import { getEnabledDownload } from "@/lib/db/queries/downloads";

export const runtime = "nodejs";

// GET /download/linux → 302 to the link the admin maintains for that platform.
// If no row exists (or it is disabled), fall back to the newest GitHub release, which keeps the
// old behaviour: a platform with no artifact lands on the releases page rather than an error.
export async function GET(_req: Request, ctx: { params: Promise<{ os: string }> }) {
  const { os } = await ctx.params;
  if (!isPlatform(os)) return new Response("Unknown platform", { status: 404 });

  const configured = getEnabledDownload(os);
  if (configured) return Response.redirect(configured.url, 302);

  const release = await latestRelease();
  const asset = release?.assets[os];
  return Response.redirect(asset ? asset.url : RELEASES_URL, 302);
}

import OSS from "ali-oss";

// 服务端独占：密钥绝不能出现在 NEXT_PUBLIC_* 中。浏览器只拿预签名 URL 直传。
let client: OSS | null = null;

export function ossConfigured(): boolean {
  return Boolean(
    process.env.OSS_REGION &&
      process.env.OSS_BUCKET &&
      process.env.OSS_ACCESS_KEY_ID &&
      process.env.OSS_ACCESS_KEY_SECRET &&
      process.env.OSS_PUBLIC_BASE_URL,
  );
}

export function getOssClient(): OSS {
  if (!ossConfigured()) throw new Error("OSS 未配置");
  client ??= new OSS({
    region: process.env.OSS_REGION!,
    bucket: process.env.OSS_BUCKET!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    ...(process.env.OSS_ENDPOINT ? { endpoint: process.env.OSS_ENDPOINT } : {}),
  });
  return client;
}

export function publicUrl(key: string): string {
  const base = process.env.OSS_PUBLIC_BASE_URL;
  if (!base) throw new Error("OSS_PUBLIC_BASE_URL 未配置");
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export function keyPrefix(): string {
  return (process.env.OSS_KEY_PREFIX ?? "openwar3/").replace(/\/+$/, "");
}

/** 预签名 PUT：浏览器在这个地址上直接上传，Content-Type 必须与签名时一致。 */
export function signUpload(key: string, contentType: string): string {
  const options = { method: "PUT", expires: 600, "Content-Type": contentType } as unknown as OSS.SignatureUrlOptions;
  return getOssClient().signatureUrl(key, options);
}

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const result = (await getOssClient().head(key)) as unknown as {
      res?: { headers?: Record<string, string> };
    };
    const headers = result.res?.headers ?? {};
    return {
      size: Number(headers["content-length"] ?? 0),
      contentType: String(headers["content-type"] ?? ""),
    };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key || !ossConfigured()) return;
  try {
    await getOssClient().delete(key);
  } catch {
    // 后台删除不应因为 OSS 故障而失败；数据库记录已经移除。
  }
}

import { getOssClient, ossConfigured } from "./oss";

// 地图的“语言文件”是放在 .w3x 旁边、与地图同名的 sidecar：
//   DotA v6.83d.w3x.zhCN.json
//   DotA v6.83d.w3x.enUS.json
// 一张地图可能同时有多种语言，详情页要把它们全部列出来，因此这里按地图 key 前缀查 OSS，
// 而不是只猜 zhCN / enUS 两个固定值。

/** `<地图文件名>.<locale>.json` 里 locale 的形状（去掉地图 key 前缀后的剩余部分）。 */
const SIDECAR = /^([A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?)\.json$/;

export interface MapLanguageFile {
  /** OSS key 里的语言标记，例如 `zhCN` / `enUS`。 */
  locale: string;
  /** 保存到本地时使用的文件名，例如 `DotA v6.83d.w3x.zhCN.json`。 */
  fileName: string;
  size: number | null;
}

/** 一张地图上传过的全部语言文件；OSS 未配置或查询失败时返回空数组，页面照常显示地图本身。 */
export async function listMapLanguageFiles(fileKey: string | null): Promise<MapLanguageFile[]> {
  if (!fileKey || !ossConfigured()) return [];
  const prefix = `${fileKey}.`;
  try {
    const result = (await getOssClient().list({ prefix, "max-keys": 100 }, {})) as unknown as {
      objects?: Array<{ name: string; size?: number }>;
    };
    const files: MapLanguageFile[] = [];
    for (const object of result.objects ?? []) {
      if (!object.name.startsWith(prefix)) continue;
      const match = SIDECAR.exec(object.name.slice(prefix.length));
      if (!match) continue;
      files.push({
        locale: match[1],
        fileName: object.name.split("/").pop() ?? object.name,
        size: typeof object.size === "number" ? object.size : null,
      });
    }
    return files.sort((a, b) => a.locale.localeCompare(b.locale));
  } catch {
    return [];
  }
}

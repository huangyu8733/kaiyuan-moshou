"use client";

import { useState } from "react";
import { saveDownloadAction } from "@/lib/actions/downloads";
import type { DownloadRow } from "@/lib/db/schema";
import { UploadField } from "./UploadField";

type Mode = "url" | "upload";

/** 游戏下载来源二选一：外链地址，或把安装包直接传到 OSS。
 *  切换模式只影响本表单提交的内容，旧对象由服务端在保存时清理。 */
export function DownloadForm({ editing }: { editing: DownloadRow | null }) {
  const [mode, setMode] = useState<Mode>(editing?.oss_key ? "upload" : "url");

  return (
    <form action={saveDownloadAction} className="admin-form">
      <input type="hidden" name="id" value={editing?.id ?? 0} />
      <input type="hidden" name="mode" value={mode} />

      <div className="form-grid">
        <label className="field">
          <span className="field__label">平台</span>
          <select className="input" name="platform" defaultValue={editing?.platform ?? "windows"}>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="macos">macOS</option>
            <option value="android">Android</option>
            <option value="harmony">HarmonyOS</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">显示名称（留空用平台名）</span>
          <input className="input" name="label" defaultValue={editing?.label ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">版本</span>
          <input className="input" name="version" defaultValue={editing?.version ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">格式</span>
          <input className="input" name="format" defaultValue={editing?.format ?? ""} placeholder="Installer / AppImage / DMG" />
        </label>
        <label className="field">
          <span className="field__label">大小（字节，上传文件时自动填写）</span>
          <input className="input" name="size" type="number" defaultValue={editing?.size ?? 0} />
        </label>
        <label className="field">
          <span className="field__label">排序</span>
          <input className="input" name="sort" type="number" defaultValue={editing?.sort ?? 0} />
        </label>
      </div>

      <div className="field">
        <span className="field__label">下载来源</span>
        <div className="form-sources" role="group" aria-label="下载来源">
          <button
            type="button"
            className={`btn ${mode === "url" ? "btn--primary" : "btn--ghost"}`}
            aria-pressed={mode === "url"}
            onClick={() => setMode("url")}
          >
            填写下载链接
          </button>
          <button
            type="button"
            className={`btn ${mode === "upload" ? "btn--primary" : "btn--ghost"}`}
            aria-pressed={mode === "upload"}
            onClick={() => setMode("upload")}
          >
            上传文件到 OSS
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <label className="field">
          <span className="field__label">下载地址（http/https）</span>
          <input
            className="input"
            name="url"
            defaultValue={editing?.oss_key ? "" : editing?.url ?? ""}
            placeholder="https://…"
            required
          />
        </label>
      ) : (
        <UploadField
          name="file"
          kind="download"
          accept=".exe,.msi,.dmg,.pkg,.zip,.7z,.tar,.gz,.tgz,.xz,.appimage,.deb,.rpm,.apk,.hap"
          label="安装包文件（≤4GB，直接上传到 OSS）"
          initialUrl={editing?.oss_key ? editing.url : null}
          initialKey={editing?.oss_key}
          initialSize={editing?.size}
          maxMB={4096}
        />
      )}

      <label className="field field--check">
        <input type="checkbox" name="enabled" value="1" defaultChecked={(editing?.enabled ?? 1) === 1} />
        <span>启用</span>
      </label>
      <div className="form-actions">
        <button className="btn btn--primary" type="submit">
          保存
        </button>
      </div>
    </form>
  );
}

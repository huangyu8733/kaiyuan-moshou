"use client";

import { useState } from "react";
import type { MapLanguageFile } from "@/lib/mapLanguages";

interface SignResponse {
  key: string;
  url: string;
  uploadUrl: string;
  headers: Record<string, string>;
  error?: string;
}

const LOCALE = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/;
const MAX_MB = 8;

/**
 * 地图语言文件的直传入口：文件不经过 Next，先取预签名地址再 PUT 到 OSS。
 * 目标 key 固定为「地图自身的 key + 语言代码 + .json」，官网与启动器都按这个名字查找，
 * 所以这里只让用户选语言、不让他们改路径。
 */
export function LanguageUploader({
  fileKey,
  initialFiles,
}: {
  fileKey: string;
  initialFiles: MapLanguageFile[];
}) {
  const [locale, setLocale] = useState("zhCN");
  const [files, setFiles] = useState<MapLanguageFile[]>(initialFiles);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function upload(file: File) {
    setError("");
    setDone("");
    const code = locale.trim();
    if (!LOCALE.test(code)) {
      setError("语言代码不合法，例如 zhCN、enUS。");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("语言文件必须是 .json。");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`语言文件不能超过 ${MAX_MB} MB。`);
      return;
    }
    setProgress(0);
    try {
      const response = await fetch("/api/admin/oss-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: "application/json",
          kind: "language",
          size: file.size,
          fileKey,
          locale: code,
        }),
      });
      const sign = (await response.json()) as SignResponse;
      if (!response.ok) throw new Error(sign.error || "无法获取上传地址");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sign.uploadUrl);
        for (const [header, value] of Object.entries(sign.headers)) xhr.setRequestHeader(header, value);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`上传失败（HTTP ${xhr.status}）`));
        xhr.onerror = () => reject(new Error("上传失败，请检查 OSS 跨域配置"));
        xhr.send(file);
      });

      const fileName = sign.key.split("/").pop() ?? sign.key;
      setFiles((current) => [
        ...current.filter((entry) => entry.locale !== code),
        { locale: code, fileName, size: file.size },
      ].sort((a, b) => a.locale.localeCompare(b.locale)));
      setProgress(100);
      setDone(`已上传 ${code} 语言文件，官网和启动器会立即读取。`);
    } catch (cause) {
      setError((cause as Error).message);
      setProgress(null);
    }
  }

  return (
    <div className="upload-field">
      <div className="language-upload">
        <label className="field">
          <span className="field__label">语言代码</span>
          <input
            className="input"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
            placeholder="zhCN"
            list="map-language-codes"
          />
          <datalist id="map-language-codes">
            <option value="zhCN">简体中文</option>
            <option value="enUS">English</option>
          </datalist>
        </label>
        <label className="field">
          <span className="field__label">语言文件（.json，≤{MAX_MB}MB）</span>
          <input
            className="input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-muted">
        上传为 <code>{fileKey}.{locale || "zhCN"}.json</code>，与地图放在同一位置。
      </p>
      {progress !== null ? <progress className="upload-progress" value={progress} max={100} /> : null}
      {done ? <p className="admin-notice--ok">{done}</p> : null}
      {error ? <p className="form-message form-message--error">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="language-file-list">
          {files.map((file) => (
            <li key={file.locale}>
              <span className="badge">{file.locale}</span>
              <span className="language-file-list__name">{file.fileName}</span>
              {file.size ? <span className="text-muted">{formatSize(file.size)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">这个地图还没有语言文件。</p>
      )}
    </div>
  );
}

function formatSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

"use client";

import { useState } from "react";

interface SignResponse {
  key: string;
  url: string;
  uploadUrl: string;
  headers: Record<string, string>;
  error?: string;
}

/** 选择文件后先向服务端要预签名地址，再直接 PUT 到 OSS；大文件不经过 Next 进程。 */
export function UploadField({
  name,
  kind,
  accept,
  label,
  initialUrl,
  initialKey,
  initialSize,
  maxMB,
}: {
  name: "cover" | "file";
  kind: "image" | "map" | "download" | "resource";
  accept: string;
  label: string;
  initialUrl?: string | null;
  initialKey?: string | null;
  initialSize?: number | null;
  maxMB: number;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [key, setKey] = useState(initialKey ?? "");
  const [size, setSize] = useState(initialSize ?? 0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (file.size > maxMB * 1024 * 1024) {
      setError(`文件超过 ${maxMB} MB 上限。`);
      return;
    }
    setProgress(0);

    try {
      const response = await fetch("/api/admin/oss-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          kind,
          size: file.size,
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
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`上传失败（HTTP ${xhr.status}）`)));
        xhr.onerror = () => reject(new Error("上传失败，请检查 OSS 跨域配置"));
        xhr.send(file);
      });

      setKey(sign.key);
      setUrl(sign.url);
      setSize(file.size);
      setProgress(100);
    } catch (cause) {
      setError((cause as Error).message);
      setProgress(null);
    }
  }

  return (
    <div className="upload-field">
      <span className="field__label">{label}</span>
      <input
        className="input"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {progress !== null ? <progress className="upload-progress" value={progress} max={100} /> : null}
      {url ? (
        <p className="upload-field__current">
          已上传：
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        </p>
      ) : (
        <p className="text-muted">未上传</p>
      )}
      {error ? <p className="form-message form-message--error">{error}</p> : null}
      <input type="hidden" name={`${name}_url`} value={url} />
      <input type="hidden" name={`${name}_key`} value={key} />
      {kind !== "image" ? <input type="hidden" name="file_size" value={size || ""} /> : null}
    </div>
  );
}

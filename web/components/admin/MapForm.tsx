"use client";

import { useMemo, useState } from "react";
import { saveMapAction } from "@/lib/actions/maps";
import type { LocaleRow, MapRow, MapTranslation } from "@/lib/db/schema";
import { ADMIN_CATEGORY_LABELS, MAP_CATEGORIES } from "@/lib/mapCategories";
import type { MapLanguageFile } from "@/lib/mapLanguages";
import { LanguageUploader } from "./LanguageUploader";
import { UploadField } from "./UploadField";

type Values = Record<string, { name: string; description: string }>;

interface ImportedEntry {
  name?: unknown;
  description?: unknown;
}

/** 多语言翻译工作台：语言多时用「列表 + 折叠面板」，而不是会挤爆的标签页。
 *  所有语言的输入框始终在 DOM 中，一次保存提交全部语言。 */
export function MapForm({
  map,
  translations,
  locales,
  defaultLocale,
  languageFiles,
}: {
  map: MapRow | null;
  translations: MapTranslation[];
  locales: LocaleRow[];
  defaultLocale: string;
  languageFiles: MapLanguageFile[];
}) {
  const byLocale = useMemo(() => new Map(translations.map((row) => [row.locale, row])), [translations]);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      locales.map((locale) => [
        locale.code,
        {
          name: byLocale.get(locale.code)?.name ?? "",
          description: byLocale.get(locale.code)?.description ?? "",
        },
      ]),
    ),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([defaultLocale]));
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState({ kind: "" as "" | "ok" | "error", text: "" });

  const filledCount = locales.filter((locale) => isFilled(values[locale.code])).length;
  const visible = locales.filter((locale) => {
    if (onlyMissing && isFilled(values[locale.code])) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return locale.label.toLowerCase().includes(needle) || locale.code.toLowerCase().includes(needle);
  });

  function update(code: string, field: "name" | "description", value: string) {
    setValues((current) => ({ ...current, [code]: { ...current[code], [field]: value } }));
  }

  function toggle(code: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function copyFromDefault(code: string) {
    const source = values[defaultLocale];
    if (!source) return;
    setValues((current) => ({ ...current, [code]: { ...current[code], ...source } }));
  }

  function exportJson() {
    const data = Object.fromEntries(locales.map((locale) => [locale.code, values[locale.code]]));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${map?.slug ?? "map"}-translations.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    try {
      const data = JSON.parse(importText) as Record<string, ImportedEntry>;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("顶层必须是对象");
      let applied = 0;
      const next = { ...values };
      for (const locale of locales) {
        const entry = data[locale.code];
        if (!entry || typeof entry !== "object") continue;
        next[locale.code] = {
          name: typeof entry.name === "string" ? entry.name : next[locale.code]?.name ?? "",
          description:
            typeof entry.description === "string" ? entry.description : next[locale.code]?.description ?? "",
        };
        applied += 1;
      }
      if (applied === 0) throw new Error("没有匹配到已注册的语言代码");
      setValues(next);
      setImportMessage({ kind: "ok", text: `已导入 ${applied} 种语言，记得点击「保存地图」。` });
    } catch (cause) {
      setImportMessage({ kind: "error", text: `导入失败：${(cause as Error).message}` });
    }
  }

  return (
    <form action={saveMapAction} className="admin-form">
      <input type="hidden" name="id" value={map?.id ?? 0} />

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Slug（URL 标识）</span>
          <input className="input" name="slug" defaultValue={map?.slug ?? ""} placeholder="dota-683d" required />
        </label>
        <label className="field">
          <span className="field__label">排序（越小越靠前）</span>
          <input className="input" name="sort" type="number" defaultValue={map?.sort ?? 0} />
        </label>
        <label className="field">
          <span className="field__label">版本</span>
          <input className="input" name="version" defaultValue={map?.version ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">作者</span>
          <input className="input" name="author" defaultValue={map?.author ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">推荐人数</span>
          <input className="input" name="players" defaultValue={map?.players ?? ""} placeholder="1-10" />
        </label>
        <label className="field">
          <span className="field__label">分类</span>
          <select className="input" name="category" defaultValue={map?.category ?? "other"}>
            {MAP_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {ADMIN_CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--check">
          <input type="checkbox" name="published" value="1" defaultChecked={map?.status === "published"} />
          <span>已发布（取消勾选则为草稿，前台不可见）</span>
        </label>
      </div>

      <div className="form-grid">
        <UploadField
          name="cover"
          kind="image"
          accept="image/jpeg,image/png,image/webp,image/gif"
          label="封面图片（jpg/png/webp，≤16MB）"
          initialUrl={map?.cover_url}
          initialKey={map?.cover_key}
          maxMB={16}
        />
        <UploadField
          name="file"
          kind="map"
          accept=".w3x,.w3m,.zip"
          label="地图文件（.w3x/.w3m/.zip，≤512MB）"
          initialUrl={map?.file_url}
          initialKey={map?.file_key}
          initialSize={map?.file_size}
          maxMB={512}
        />
      </div>

      <section className="language-files">
        <h2 className="admin-subtitle">地图语言文件</h2>
        {map?.file_key ? (
          <>
            <p className="text-muted">
              一种语言一个 JSON，直接传到 OSS 上地图文件的旁边；官网和启动器会自动发现并列出。
            </p>
            <LanguageUploader fileKey={map.file_key} initialFiles={languageFiles} />
          </>
        ) : (
          <p className="text-muted">先上传地图文件并保存，保存后才能给这张地图添加语言文件。</p>
        )}
      </section>

      <section className="translation-workbench">
        <div className="translation-head">
          <div>
            <h2 className="admin-subtitle">多语言介绍</h2>
            <p className="translation-progress">
              已填写 <strong>{filledCount}</strong> / {locales.length} 种语言
              {filledCount < locales.length ? `，还差 ${locales.length - filledCount} 种` : "，全部完成"}
            </p>
          </div>
          <div className="translation-tools">
            <input
              className="input input--search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索语言 / 代码"
            />
            <label className="check-inline">
              <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />
              只看未填写
            </label>
            <button type="button" className="btn btn--ghost" onClick={() => setExpanded(new Set(visible.map((item) => item.code)))}>
              展开全部
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setExpanded(new Set())}>
              收起全部
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setImportOpen((open) => !open)}>
              批量导入
            </button>
            <button type="button" className="btn btn--ghost" onClick={exportJson}>
              导出 JSON
            </button>
          </div>
        </div>

        {importOpen ? (
          <div className="translation-import">
            <p className="text-muted">
              粘贴 JSON，例如 {"{"}"en": {"{"}"name": "...", "description": "..."{"}"}{"}"}；只导入已注册的语言代码，导入后仍需保存。
            </p>
            <textarea
              className="input textarea"
              rows={6}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={'{\n  "en": { "name": "Map name", "description": "Map description" }\n}'}
            />
            {importMessage.text ? (
              <p className={`form-message ${importMessage.kind === "error" ? "form-message--error" : "admin-notice--ok"}`}>
                {importMessage.text}
              </p>
            ) : null}
            <div className="form-actions">
              <button type="button" className="btn btn--primary" onClick={importJson}>
                导入到表单
              </button>
            </div>
          </div>
        ) : null}

        <div className="lang-workbench">
          {visible.map((locale) => {
            const value = values[locale.code] ?? { name: "", description: "" };
            const filled = isFilled(value);
            const open = expanded.has(locale.code);
            return (
              <section key={locale.code} className={`lang-row${open ? " is-open" : ""}`}>
                <button type="button" className="lang-row__head" aria-expanded={open} onClick={() => toggle(locale.code)}>
                  <span className="lang-row__chevron" aria-hidden>
                    ▸
                  </span>
                  <span className="lang-row__label">{locale.label}</span>
                  <span className="lang-row__code">{locale.code}</span>
                  {locale.code === defaultLocale ? <span className="badge badge--default">默认</span> : null}
                  {locale.enabled !== 1 ? <span className="badge">未启用</span> : null}
                  <span className={`badge ${filled ? "badge--ok" : "badge--missing"}`}>{filled ? "已填写" : "未填写"}</span>
                </button>
                <div className="lang-row__body" hidden={!open}>
                  <label className="field">
                    <span className="field__label">名称（{locale.label}）</span>
                    <input
                      className="input"
                      name={`name_${locale.code}`}
                      value={value.name}
                      onChange={(event) => update(locale.code, "name", event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">地图介绍（{locale.label}）</span>
                    <textarea
                      className="input textarea"
                      name={`description_${locale.code}`}
                      rows={6}
                      value={value.description}
                      onChange={(event) => update(locale.code, "description", event.target.value)}
                    />
                  </label>
                  <div className="lang-row__actions">
                    <button type="button" className="text-link" onClick={() => copyFromDefault(locale.code)}>
                      从默认语言复制
                    </button>
                    <span className="text-muted">{value.description.length} 字</span>
                  </div>
                </div>
              </section>
            );
          })}
          {visible.length === 0 ? <p className="empty-state">没有符合筛选条件的语言。</p> : null}
        </div>
      </section>

      <div className="save-bar">
        <span className="text-muted">
          已填写 {filledCount} / {locales.length} 种语言
        </span>
        <button className="btn btn--primary" type="submit">
          保存地图
        </button>
      </div>
    </form>
  );
}

function isFilled(value: { name: string; description: string } | undefined): boolean {
  return Boolean(value && (value.name.trim() || value.description.trim()));
}

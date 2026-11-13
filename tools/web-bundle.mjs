#!/usr/bin/env node
// Package the page for a hot update: dist/ → release/web-<version>.zip, which the launcher
// unpacks into its data folder and reloads onto (electron/webUpdate.mjs). Only the page is in
// here — the shell (main process, preload, Electron itself) still travels by installer.
//
// Publishing is: run this, upload the zip, and add
//   "web": { "version": "<version>", "url": "<oss url>", "size": <bytes> }
// to launcher/latest.json. The version in that field is the PAGE's, so a UI-only release can be
// newer than the app version the players have installed.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const out = join(root, "release", `web-${version}.zip`);

mkdirSync(join(root, "release"), { recursive: true });
rmSync(out, { force: true });
// `zip` is on every macOS and Linux build machine, and -9 is what makes this a ~5 MB download
// rather than the ~10 MB the uncompressed page takes. Dot-files are store noise, not the page.
execFileSync("zip", ["-qr", "-9", out, ".", "-x", ".*", "-x", "*/.*"], { cwd: dist });
console.log(`${out} ${statSync(out).size} bytes`);

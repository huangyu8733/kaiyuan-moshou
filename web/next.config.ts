import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The UI kit (packages/ui) ships TypeScript source, not a build.
  transpilePackages: ["@warcraft-open/ui"],
  // ali-oss is CommonJS with its own dynamic requires; let Node load it instead of bundling it.
  serverExternalPackages: ["ali-oss"],
  // This folder is its own project with its own lockfile (the repo root holds the game's), and
  // the kit is hard-linked INTO node_modules here, so nothing it builds lives above this folder.
  turbopack: { root: __dirname },
};

export default nextConfig;

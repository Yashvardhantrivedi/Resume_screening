import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "@napi-rs/canvas"],
  // Produces a self-contained server bundle in .next/standalone for the Docker image.
  output: "standalone",
};

export default nextConfig;

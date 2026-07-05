// Assembles the self-contained server bundle that ships inside the desktop app.
// Run AFTER `next build` and AFTER `electron-rebuild` (see package.json "desktop:build").
import { cpSync, existsSync, rmSync } from "fs";
import path from "path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No .next/standalone build found — run `next build` first.");
  process.exit(1);
}

// Static assets + public files are not part of the standalone output by default.
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

// The standalone bundle carries its own copy of better-sqlite3, compiled for
// plain Node. Electron needs the Electron-ABI build (produced by electron-rebuild
// into the root node_modules) — overwrite the standalone copy with it.
const src = path.join(root, "node_modules", "better-sqlite3");
const dest = path.join(standalone, "node_modules", "better-sqlite3");
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });

console.log("Desktop bundle prepared: static assets copied, better-sqlite3 swapped to Electron ABI.");

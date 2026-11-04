const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const frontendDist = path.join(frontend, "dist");
const rootDist = path.join(root, "dist");

const command = process.platform === "win32" ? process.env.ComSpec : "npm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "npm.cmd run build"]
  : ["run", "build"];

execFileSync(command, args, {
  cwd: frontend,
  stdio: "inherit",
});

fs.rmSync(rootDist, { recursive: true, force: true });
fs.cpSync(frontendDist, rootDist, { recursive: true });

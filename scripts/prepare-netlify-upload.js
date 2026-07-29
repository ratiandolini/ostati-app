const fs = require("fs");
const path = require("path");

const root = process.cwd();
const buildDir = path.join(root, "build");
const targetDir = path.join(root, "NETLIFY_UPLOAD_THIS");

const requiredItems = ["index.html", "_redirects", "asset-manifest.json", "static"];

if (!fs.existsSync(buildDir)) {
  throw new Error("Missing build folder. Run npm.cmd run build:local first.");
}

fs.mkdirSync(targetDir, { recursive: true });

for (const item of requiredItems) {
  const source = path.join(buildDir, item);
  const target = path.join(targetDir, item);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing build item: ${item}`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

console.log("Netlify upload folder is ready:");
console.log(targetDir);
console.log("");
console.log("Upload this folder itself, not the static folder inside it.");

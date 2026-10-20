import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize } from "node:path";

const root = join(process.cwd(), "build");
const port = Number(process.env.PORT || 4173);

if (!existsSync(join(root, "index.html"))) {
  throw new Error("Missing build output. Run npm run build before Playwright.");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer((request, response) => {
  const requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = normalize(requestedPath.replace(/^\/+/, ""));
  const candidate = join(root, relativePath);
  const withinBuild = !isAbsolute(relativePath) && !relativePath.startsWith("..");
  const file =
    withinBuild && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, "index.html");
  const type = contentTypes[extname(file)] || "application/octet-stream";

  response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`E2E static server listening on http://127.0.0.1:${port}`);
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);

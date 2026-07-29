const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd(), "build");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const safePath = (requestUrl) => {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const target = path.normalize(path.join(root, decodedPath));
  if (!target.startsWith(root)) return path.join(root, "index.html");
  return target;
};

const server = http.createServer((request, response) => {
  const target = safePath(request.url || "/");
  const file = fs.existsSync(target) && fs.statSync(target).isFile()
    ? target
    : path.join(root, "index.html");
  const ext = path.extname(file);

  response.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
  fs.createReadStream(file)
    .on("error", () => {
      response.statusCode = 500;
      response.end("Unable to read file");
    })
    .pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving build at http://127.0.0.1:${port}`);
});

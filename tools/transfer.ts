import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import QRCode from "qrcode";
import { MAX_BACKUP_BYTES, validateBackupContents, validateBackupName } from "./transferCore";

const localAddress = (): string => {
  for (const entries of Object.values(networkInterfaces()))
    for (const entry of entries ?? [])
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
  throw new Error("No local IPv4 network was found.");
};
const html = (body: string) =>
  `<!doctype html><meta name="viewport" content="width=device-width"><title>Health Quest transfer</title><style>body{font:18px system-ui;max-width:560px;margin:12vh auto;padding:24px;background:#f4f1e8;color:#173329}main{background:white;padding:28px;border-radius:20px}button,input{font:inherit;margin-top:16px}button{padding:12px 18px;background:#d99025;border:0;border-radius:10px;font-weight:bold}</style><main><h1>Health Quest</h1>${body}</main>`;

const prompt = createInterface({ input, output });
const answer = (
  await prompt.question("Transfer direction: [s]end to phone or [r]eceive from phone? ")
)
  .trim()
  .toLowerCase();
const direction = answer.startsWith("s") ? "send" : "receive";
let sendPath = "";
if (direction === "send") {
  sendPath = resolve(
    (await prompt.question("Path to encrypted .healthtracker file: ")).trim().replace(/^"|"$/g, "")
  );
  validateBackupName(sendPath);
  if (!existsSync(sendPath)) throw new Error("Backup file was not found.");
  validateBackupContents(readFileSync(sendPath, "utf8"));
}
prompt.close();

const token = randomBytes(24).toString("base64url");
const expiresAt = Date.now() + 10 * 60_000;
let used = false;
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const reject = (status: number, message: string) => {
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    response.end(html(`<h2>Transfer unavailable</h2><p>${message}</p>`));
  };
  if (url.searchParams.get("token") !== token || used || Date.now() >= expiresAt)
    return reject(403, "This one-time transfer link is invalid, expired, or already used.");
  if (direction === "send" && request.method === "GET") {
    used = true;
    response.writeHead(200, {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${basename(sendPath)}"`,
      "content-length": String(readFileSync(sendPath).byteLength)
    });
    createReadStream(sendPath)
      .pipe(response)
      .on("finish", () => {
        output.write("\nTransfer complete. Server closed.\n");
        server.close();
      });
    return;
  }
  if (direction === "receive" && request.method === "GET") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      html(
        `<h2>Send encrypted backup</h2><p>Select the .healthtracker file exported by the app.</p><form method="post" enctype="application/octet-stream"><input type="file" id="file" accept=".healthtracker" required><button type="button" onclick="send()">Send backup</button></form><p id="status"></p><script>async function send(){const f=document.querySelector('#file').files[0];if(!f)return;const s=document.querySelector('#status');s.textContent='Sending…';const r=await fetch(location.href,{method:'POST',headers:{'x-file-name':encodeURIComponent(f.name)},body:f});s.textContent=await r.text()}</script>`
      )
    );
    return;
  }
  if (direction === "receive" && request.method === "POST") {
    const name = decodeURIComponent(String(request.headers["x-file-name"] ?? ""));
    try {
      validateBackupName(name);
    } catch (error) {
      return reject(400, (error as Error).message);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BACKUP_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return reject(413, "The backup exceeds the 25 MB limit.");
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        validateBackupContents(raw);
        const directory = resolve(".local", "transfers");
        mkdirSync(directory, { recursive: true });
        const target = resolve(directory, `${Date.now()}-${basename(name)}`);
        writeFileSync(target, raw, { flag: "wx" });
        used = true;
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("Transfer complete. You can close this page.");
        output.write(`\nReceived encrypted backup: ${target}\n`);
        setTimeout(() => server.close(), 250);
      } catch (error) {
        reject(400, error instanceof Error ? error.message : "Invalid backup.");
      }
    });
    return;
  }
  reject(405, "The transfer direction does not permit this request.");
});

server.listen(0, "0.0.0.0", async () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start transfer server.");
  const url = `http://${localAddress()}:${address.port}/?token=${token}`;
  output.write(`\n${direction === "send" ? "Download on phone" : "Upload from phone"}: ${url}\n`);
  output.write(await QRCode.toString(url, { type: "terminal", small: true }));
  output.write("\nThis link expires in ten minutes and works once. Keep this window open.\n");
});
setTimeout(() => {
  if (!used) {
    output.write("\nTransfer expired. Server closed.\n");
    server.close();
  }
}, 10 * 60_000).unref();

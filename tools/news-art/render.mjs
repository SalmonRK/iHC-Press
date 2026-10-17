#!/usr/bin/env node
// Render iHC-Press news artwork: a Flow picture (text-free) + real Thai text from template.html, screenshotted by headless Edge/Chrome.
// Usage:
//   node tools/news-art/render.mjs --story <id> [--variant photo|breaking|card] [--formats 16x9,1x1,4x5] [--art <image>] [--out <dir>]
//   node tools/news-art/render.mjs --headline "..." [--beat ai] [--dek "..."] [--source example.com] [--points "a|b|c"] [--id name] ...
// A story comes from <news>/stories.json (tools/paths.mjs). Without --art the beat's illustration in assets/ is used.
// Output: <out>/<variant>-<format>.png, default <news>/art/<id>/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NEWS_DIR } from "../paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, "");
  A[k] = process.argv[i + 1]?.startsWith("--") || process.argv[i + 1] === undefined ? "1" : process.argv[++i];
}

const BEATS = { ai: "AI-โมเดล", gadget: "Gadget-มือถือ", software: "ซอฟต์แวร์-แอป", startup: "สตาร์ทอัพ-ธุรกิจเทค", security: "ความปลอดภัยไซเบอร์",
  gaming: "เกม-สตรีมมิง", cloud: "คลาวด์-ดีเวลอปเปอร์", policy: "นโยบาย-กฎหมายเทค", other: "ฮาร์ดแวร์-คอมพิวเตอร์" };
const ART = { ai: "beat-ai", gadget: "beat-gadget", software: "beat-software", startup: "beat-startup", security: "beat-security",
  gaming: "beat-gaming", cloud: "beat-cloud", policy: "beat-policy", other: "beat-hardware" };
const FORMATS = { "16x9": [1600, 900], "1x1": [1080, 1080], "4x5": [1080, 1350] };
const FRAME = { "16x9": "frame-16x9", "1x1": "frame-1x1", "4x5": "frame-3x4" };
const asset = n => path.join(HERE, "assets", n + ".jpg");
const die = m => { console.error(m); process.exit(1); };

let s = {};
if (A.story) {
  const db = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, "stories.json"), "utf8"));
  s = (db.stories || db).find(x => x.id === A.story) || die(`story ${A.story} not in ${NEWS_DIR}\\stories.json`);
}
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const firstPara = t => (t || "").split(/\n\s*\n/).map(x => x.trim()).find(x => x && !x.startsWith("#")) || "";
const clip = (t, n) => t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n) > n * .6 ? t.lastIndexOf(" ", n) : n) + "…";
const beat = A.beat || s.beat || "other";
const when = new Date(s.updatedAt || Date.now());

const data = {
  headline: A.headline || s.headline || s.title || die("need --story or --headline"),
  beat: BEATS[beat] || beat,
  dek: A.dek ?? clip(firstPara(s.body), 150),
  source: A.source || (s.sources?.[0] ? host(typeof s.sources[0] === "string" ? s.sources[0] : s.sources[0].url) : ""),
  points: A.points ? A.points.split("|").map(x => x.trim()).filter(Boolean) : [],
  date: A.date || when.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
  variant: A.variant || "photo",
  art: path.resolve(A.art || asset(ART[beat] || "beat-hardware")),
};
if (!fs.existsSync(data.art)) die(`art not found: ${data.art}`);

const browser = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(p => p && fs.existsSync(p)) || die("no Edge/Chrome found (set BROWSER)");
const out = path.resolve(A.out || path.join(NEWS_DIR, "art", A.story || A.id || "custom"));
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ihc-art-"));
const tpl = fs.readFileSync(path.join(HERE, "template.html"), "utf8")
  .replace("<head>", `<head><base href="${pathToFileURL(HERE + path.sep).href}">`);

// One headless browser driven over the DevTools protocol: set the exact viewport, load the page, wait until the template
// says "ready" (fonts loaded, headline fitted) and capture. (The --screenshot flag captured before every tile was painted
// and left white strips along the bottom.)
const prof = path.join(tmp, "profile");
const proc = spawn(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run",
  `--user-data-dir=${prof}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let port;
for (let i = 0; i < 100 && !port; i++) { try { port = fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]; } catch { await sleep(100); } }
if (!port) { proc.kill(); die("browser did not open a DevTools port"); }
let target;
for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {} if (!target) await sleep(100); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waits = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const i = ++seq; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const title = async () => (await send("Runtime.evaluate", { expression: "document.title", returnByValue: true })).result?.result?.value;

try {
  for (const f of (A.formats || "16x9,1x1,4x5").split(",")) {
    const [w, h] = FORMATS[f] || die(`unknown format ${f} (16x9, 1x1, 4x5)`);
    const d = { ...data, format: f, assets: { frame: asset(FRAME[f]), panel: asset("tex-panel"), breaking: asset("tex-breaking") } };
    for (const k of ["art", "frame", "panel", "breaking"]) { const o = k === "art" ? d : d.assets; o[k] = pathToFileURL(o[k]).href; }
    const html = path.join(tmp, `${f}.html`);
    fs.writeFileSync(html, tpl.replace('<script id="data" type="application/json">{}</script>',
      `<script id="data" type="application/json">${JSON.stringify(d).replace(/</g, () => String.fromCharCode(92) + "u003c")}</script>`));
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: pathToFileURL(html).href });
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) { await sleep(100); ok = (await title()) === "ready"; }
    if (!ok) die(`render timed out for ${f}`);
    await send("Runtime.evaluate", { expression: "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", awaitPromise: true });
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    const png = path.join(out, `${data.variant}-${f}.png`);
    fs.writeFileSync(png, Buffer.from(shot.result.data, "base64"));
    console.log(png);
  }
} finally {
  ws.close(); proc.kill();
  await sleep(300);
  if (!process.env.KEEP_TMP) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

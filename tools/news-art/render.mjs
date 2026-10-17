#!/usr/bin/env node
// Render iHC-Press news artwork: a Flow picture (text-free) + real Thai text from template.html, screenshotted by headless Edge/Chrome.
// Usage:
//   node tools/news-art/render.mjs --story <id> [--variant photo|breaking|card] [--formats 16x9,1x1,4x5] [--art <image>] [--out <dir>]
//   node tools/news-art/render.mjs --pending          (what the app runs: every ready/published story whose artwork is missing or stale)
//   node tools/news-art/render.mjs --headline "..." [--beat ai] [--dek "..."] [--source example.com] [--points "a|b|c"] [--id name] ...
// A story comes from <news>/stories.json (tools/paths.mjs). Its image brief (ฝ่ายภาพ) may choose the variant ("แบบภาพ:"), the card's
// bullets ("ประเด็น:") and a picture inside the news folder ("ภาพจากข่าว:"); command-line flags win over the brief. Without a picture
// the beat's illustration in assets/ is used. Output: <out>/<variant>-<format>.png + meta.json, default <news>/art/<id>/.
// The last stdout line is always one JSON object (the app reads it).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NEWS_DIR } from "../paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSET_VERSION = "2026-10-17"; // bump when assets/ is regenerated, so meta.json tells which set an image was made from
const BEATS = { ai: "AI-โมเดล", gadget: "Gadget-มือถือ", software: "ซอฟต์แวร์-แอป", startup: "สตาร์ทอัพ-ธุรกิจเทค", security: "ความปลอดภัยไซเบอร์",
  gaming: "เกม-สตรีมมิง", cloud: "คลาวด์-ดีเวลอปเปอร์", policy: "นโยบาย-กฎหมายเทค", other: "ฮาร์ดแวร์-คอมพิวเตอร์" };
const ART = { ai: "beat-ai", gadget: "beat-gadget", software: "beat-software", startup: "beat-startup", security: "beat-security",
  gaming: "beat-gaming", cloud: "beat-cloud", policy: "beat-policy", other: "beat-hardware" };
const FORMATS = { "16x9": [1600, 900], "1x1": [1080, 1080], "4x5": [1080, 1350] };
const FRAME = { "16x9": "frame-16x9", "1x1": "frame-1x1", "4x5": "frame-3x4" };
const VARIANTS = ["photo", "breaking", "card"];
const asset = n => path.join(HERE, "assets", n + ".jpg");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = t => crypto.createHash("sha1").update(t || "").digest("hex").slice(0, 12);

// ---------- the image brief ----------
// ฝ่ายภาพ writes labelled lines (seed-bots.mjs); anything unlabelled is just notes for people
export function parseBrief(text) {
  const lines = (text || "").split(/\r?\n/).map(l => l.trim());
  const get = re => { const l = lines.find(x => re.test(x)); return l ? l.replace(/^[^:：]*[:：]\s*/, "").trim() : ""; };
  const none = v => !v || /^[-–—]$|^(ไม่มี|none)$/i.test(v);
  const v = get(/^(แบบภาพ|variant)\s*[:：]/i).toLowerCase();
  const variant = VARIANTS.find(x => v.startsWith(x)) || (/ด่วน/.test(v) ? "breaking" : /การ์ด|สรุป/.test(v) ? "card" : "");
  const pts = get(/^(ประเด็น|points)\s*[:：]/i), art = get(/^(ภาพจากข่าว|art)\s*[:：]/i);
  return {
    variant, points: none(pts) ? [] : pts.split("|").map(x => x.trim()).filter(Boolean).slice(0, 3),
    art: none(art) ? "" : art.replace(/^["'`]|["'`]$/g, "").replace(/\s*\(.*\)$/, ""),
    alt: get(/^alt(\s*text)?\s*[:：]/i), caption: get(/^คำบรรยายภาพ\s*[:：]/),
  };
}

// a picture named by a bot must be an image file inside the news folder (never an arbitrary path on this PC)
export function newsPicture(rel, newsDir = NEWS_DIR) {
  if (!rel) return "";
  const root = path.resolve(newsDir), full = path.resolve(root, rel.replace(/^\/+/, ""));
  if (!full.startsWith(root + path.sep) || !/\.(jpe?g|png|webp)$/i.test(full) || !fs.existsSync(full)) return "";
  return full;
}

// ---------- story -> template data ----------
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const firstPara = t => (t || "").split(/\n\s*\n/).map(x => x.trim()).find(x => x && !x.startsWith("#")) || "";
const clip = (t, n) => t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n) > n * .6 ? t.lastIndexOf(" ", n) : n) + "…";

function jobFor(s, o = {}) {
  const brief = parseBrief(s.image), beat = o.beat || s.beat || "other", notes = [];
  const picked = o.art ? path.resolve(o.art) : newsPicture(brief.art);
  if (brief.art && !o.art && !picked) notes.push(`ภาพจากข่าว "${brief.art}" ไม่พบหรือไม่ใช่ไฟล์ภาพในโฟลเดอร์ข่าว ใช้ภาพประจำสายแทน`);
  const variant = o.variant || brief.variant || "photo";
  if (!VARIANTS.includes(variant)) throw new Error(`unknown variant ${variant} (${VARIANTS.join(", ")})`);
  const data = {
    headline: o.headline || s.headline || s.title || "",
    beat: BEATS[beat] || beat,
    dek: o.dek ?? clip(firstPara(s.body), 150),
    source: o.source || (s.sources?.[0] ? host(typeof s.sources[0] === "string" ? s.sources[0] : s.sources[0].url) : ""),
    points: o.points ? o.points.split("|").map(x => x.trim()).filter(Boolean) : brief.points,
    date: o.date || new Date(s.updatedAt || Date.now()).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
    variant, art: picked || asset(ART[beat] || "beat-hardware"), lines: o.lines,
  };
  if (!data.headline) throw new Error("ข่าวยังไม่มีพาดหัว");
  if (!fs.existsSync(data.art)) throw new Error(`art not found: ${data.art}`);
  return { id: s.id || o.id || "custom", data, brief, notes, formats: (o.formats || "16x9,1x1,4x5").split(",") };
}

// ---------- browser ----------
// One headless browser driven over the DevTools protocol: set the exact viewport, load the page, wait until the template
// says "ready" (fonts loaded, headline fitted) and capture. (The --screenshot flag captured before every tile was painted
// and left white strips along the bottom.)
async function openBrowser(tmp) {
  const exe = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(p => p && fs.existsSync(p));
  if (!exe) throw new Error("no Edge/Chrome found (set BROWSER)");
  const prof = path.join(tmp, "profile");
  const proc = spawn(exe, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run",
    `--user-data-dir=${prof}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  let port, target;
  for (let i = 0; i < 100 && !port; i++) { try { port = fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]; } catch { await sleep(100); } }
  if (!port) { proc.kill(); throw new Error("browser did not open a DevTools port"); }
  for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {} if (!target) await sleep(100); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const waits = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++seq; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => { ws.close(); proc.kill(); } };
}

async function renderJob(b, tmp, job, outDir, source) {
  const tpl = fs.readFileSync(path.join(HERE, "template.html"), "utf8").replace("<head>", `<head><base href="${pathToFileURL(HERE + path.sep).href}">`);
  fs.mkdirSync(outDir, { recursive: true });
  const files = {};
  for (const f of job.formats) {
    const [w, h] = FORMATS[f] || (() => { throw new Error(`unknown format ${f} (16x9, 1x1, 4x5)`); })();
    const d = { ...job.data, format: f, assets: { frame: asset(FRAME[f]), panel: asset("tex-panel"), breaking: asset("tex-breaking") } };
    for (const k of ["art", "frame", "panel", "breaking"]) { const o = k === "art" ? d : d.assets; o[k] = pathToFileURL(o[k]).href; }
    const html = path.join(tmp, `${job.id}-${f}.html`);
    fs.writeFileSync(html, tpl.replace('<script id="data" type="application/json">{}</script>',
      `<script id="data" type="application/json">${JSON.stringify(d).replace(/</g, () => String.fromCharCode(92) + "u003c")}</script>`));
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await b.send("Page.navigate", { url: pathToFileURL(html).href });
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) { await sleep(100); ok = (await b.send("Runtime.evaluate", { expression: "document.title", returnByValue: true })).result?.result?.value === "ready"; }
    if (!ok) throw new Error(`render timed out for ${f}`);
    await b.send("Runtime.evaluate", { expression: "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", awaitPromise: true });
    const shot = await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    const name = `${job.data.variant}-${f}.png`;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(shot.result.data, "base64"));
    files[f] = name;
  }
  // meta.json = what the app shows and what --pending compares against (headline / brief changed -> render again)
  const meta = { id: job.id, variant: job.data.variant, files, headline: job.data.headline, brief: hash(job.brief && JSON.stringify(job.brief)),
    alt: job.brief?.alt || "", caption: job.brief?.caption || "", art: path.basename(job.data.art), source, notes: job.notes,
    assets: ASSET_VERSION, renderedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 1));
  return meta;
}

const readMeta = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")); } catch { return null; } };

// a ready/published story needs artwork when it has none, or its headline or brief changed since; a variant a person picked
// in the app ("manual") is kept for that re-render
export function pendingJobs(stories, artRoot) {
  const jobs = [];
  for (const s of stories) {
    if (!/^(ready|published)$/.test(s.status) || !s.headline) continue;
    const m = readMeta(path.join(artRoot, s.id)), brief = parseBrief(s.image);
    if (m && m.headline === s.headline && m.brief === hash(JSON.stringify(brief)) && m.assets === ASSET_VERSION) continue;
    jobs.push({ s, variant: m?.source === "manual" ? m.variant : undefined, source: m?.source === "manual" ? "manual" : "auto" });
  }
  return jobs;
}

// ---------- main ----------
const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const A = {};
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i].replace(/^--/, "");
    A[k] = process.argv[i + 1]?.startsWith("--") || process.argv[i + 1] === undefined ? "1" : process.argv[++i];
  }
  const artRoot = path.join(NEWS_DIR, "art");
  const stories = () => { const db = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, "stories.json"), "utf8")); return db.stories || db; };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ihc-art-"));
  let b, result;
  try {
    if (A.pending) {
      let list = [];
      try { list = pendingJobs(stories(), artRoot); } catch (e) { if (e.code !== "ENOENT") throw e; } // no stories.json yet
      const rendered = [], failed = [];
      if (list.length) b = await openBrowser(tmp);
      for (const p of list) {
        try { rendered.push((await renderJob(b, tmp, jobFor(p.s, { variant: p.variant }), path.join(artRoot, p.s.id), p.source)).id); }
        catch (e) { failed.push({ id: p.s.id, error: e.message }); }
      }
      result = { ok: !failed.length, rendered, failed };
    } else {
      const s = A.story ? stories().find(x => x.id === A.story) : {};
      if (!s) throw new Error(`ไม่พบข่าว ${A.story} ใน ${path.join(NEWS_DIR, "stories.json")}`);
      const job = jobFor(s, A);
      b = await openBrowser(tmp);
      const outDir = path.resolve(A.out || path.join(artRoot, job.id));
      const meta = await renderJob(b, tmp, job, outDir, A.story && !A.out ? (A.variant ? "manual" : "auto") : "cli");
      for (const f of Object.values(meta.files)) console.log(path.join(outDir, f));
      result = { ok: true, ...meta, dir: outDir };
    }
  } catch (e) {
    result = { ok: false, error: e.message };
    process.exitCode = 1;
  } finally {
    b?.close();
    await sleep(300);
    if (!process.env.KEEP_TMP) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  console.log(JSON.stringify(result));
}

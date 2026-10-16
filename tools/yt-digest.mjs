#!/usr/bin/env node
// YouTube -> news digest for iHC-Press: metadata + timestamped transcript (yt-dlp), a Thai summary with key moments
// (NotebookLM when its CLI is installed and logged in, otherwise the bots' own LLM from llm.json), and one screen capture
// per key moment (ffmpeg seeks the stream directly: no full download). Writes <out>/<videoId>/digest.json + digest.md + frames/.
// usage: node tools/yt-digest.mjs <youtube-url> [--out <news>\youtube] [--engine auto|llm|notebooklm] [--frames 6]
// progress goes to stderr as "STEP <text>"; the last stdout line is the result JSON ({ok, id, dir, engine, ...} or {ok:false, error}).
// Needs on PATH: yt-dlp, ffmpeg, node (and optionally notebooklm from notebooklm-py). Video frames are the creator's
// work: stories must credit the channel and link the video.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NEWS_DIR } from "./paths.mjs";

const run = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const url = argv[0] && !argv[0].startsWith("--") ? argv[0] : undefined;
const OUT = opt("out", path.join(NEWS_DIR, "youtube"));
const ENGINE = opt("engine", "auto");
const FRAMES = Math.min(10, Math.max(0, Number(opt("frames", 6)) || 0));
const LLM_JSON = opt("llm", path.join(process.env.LOCALAPPDATA || os.homedir(), "BotPress", "llm.json"));
const step = t => process.stderr.write(`STEP ${t}\n`);
const done = o => { process.stdout.write(JSON.stringify(o) + "\n"); process.exit(o.ok ? 0 : 1); };

const sh = async (cmd, args, ms = 120000) => (await run(cmd, args, { timeout: ms, maxBuffer: 64 << 20, windowsHide: true, encoding: "utf8" })).stdout;
const ytdlp = (args, ms) => sh("yt-dlp", ["--js-runtimes", "node", "--no-warnings", ...args], ms);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const secs = t => String(t).split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
// deep search for the first value under any of these keys (notebooklm --json envelopes are not documented in detail)
const deep = (o, keys) => { if (!o || typeof o !== "object") return undefined; for (const k of keys) if (o[k] != null && typeof o[k] !== "object") return o[k];
  for (const v of Object.values(o)) { const r = deep(v, keys); if (r !== undefined) return r; } return undefined; };

// "00:01:05.200 --> ..." cues; auto-subs repeat the previous line in rolling captions, so drop exact repeats
function parseVtt(text) {
  const out = [];
  for (const block of text.replace(/\r/g, "").split("\n\n")) {
    const m = block.match(/(\d+:)?(\d+):(\d+)\.\d+ -->/);
    if (!m) continue;
    const t = (Number(m[1]?.slice(0, -1) || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
    // rolling auto-captions show the previous line again above the new one: the last line is the new text
    const line = (block.split("\n").slice(1).filter(l => l.trim()).at(-1) || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (line && line !== out.at(-1)?.text) out.push({ t, text: line });
  }
  return out;
}

async function transcript(id, lang, dir) {
  const langs = [...new Set([lang && `${lang}-orig`, lang, "th", "en-orig", "en"].filter(Boolean))].join(",");
  try { await ytdlp(["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", langs, "--sub-format", "vtt", "-o", path.join(dir, "sub.%(ext)s"), `https://www.youtube.com/watch?v=${id}`], 180000); }
  catch { /* 429 on one language still leaves the others */ }
  const files = fs.readdirSync(dir).filter(f => f.startsWith("sub.") && f.endsWith(".vtt"));
  const rank = f => langs.split(",").indexOf(f.slice(4, -4)); // the order asked for = preference
  const best = files.sort((a, b) => (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b)))[0];
  return best ? { lang: best.slice(4, -4), lines: parseVtt(fs.readFileSync(path.join(dir, best), "utf8")) } : { lang: "", lines: [] };
}

const ASK = (meta, n) => `สรุปคลิป YouTube "${meta.title}" ของช่อง ${meta.channel} สำหรับกองข่าวเทคโนโลยีและคอมพิวเตอร์ภาษาไทย
ตอบเป็น JSON อย่างเดียว ตามรูปแบบนี้:
{"summary":"สรุป 4-6 ประโยค ภาษาไทย","key_points":[{"t":"นาที:วินาที","point":"ประเด็นสำคัญ ณ ช่วงเวลานั้น ภาษาไทย 1-2 ประโยค"}],"topics":["คำสำคัญ"],"news_angle":"มุมข่าวที่น่าสนใจสำหรับผู้อ่านไทย 1-2 ประโยค","claims_to_verify":["ตัวเลขหรือข้ออ้างที่ต้องตรวจกับแหล่งต้นทาง"]}
key_points ${Math.max(3, n)}-${Math.max(4, n + 2)} ข้อ เรียงตามเวลา และ t ต้องเป็นเวลาที่มีอยู่จริงในคำบรรยาย ห้ามแต่งข้อมูลที่ไม่มีในคลิป ห้ามใช้อักษรจีนหรือภาษาอื่นปน (ชื่อรุ่นสินค้าใช้ภาษาอังกฤษได้)`;

// local models leave trailing commas ("},\n]") now and then
const parseJson = text => { const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error("คำตอบไม่มี JSON"); return JSON.parse(m[0].replace(/,(\s*[\]}])/g, "$1")); };

// key moments as {t:"m:ss", point}: models also name them time/timestamp and text/detail, and answer a range "1:46-2:59" (start kept)
function keyPoints(j) {
  const arr = j.key_points || j.keyPoints || j.points || [];
  return (Array.isArray(arr) ? arr : []).map(p => ({ t: (String(p?.t ?? p?.time ?? p?.timestamp ?? "").match(/\d+:\d\d(:\d\d)?/) || [""])[0],
    point: String(p?.point ?? p?.text ?? p?.detail ?? "").trim() })).filter(p => p.t && p.point);
}

// CJK ideographs/kana and Vietnamese letters with stacked diacritics (none of which belong in a Thai digest)
const FOREIGN = /[぀-ヿ㐀-鿿]|[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

async function viaLlm(meta, lines) {
  const llm = JSON.parse(fs.readFileSync(LLM_JSON, "utf8"));
  const base = (llm.healthUrl ? llm.healthUrl.replace(/\/$/, "") + "/v1" : llm.baseUrl);
  // caption fragments merged into ~12 s chunks: a third of the tokens, still precise enough for a screen capture
  const chunks = [];
  for (const l of lines) { const c = chunks.at(-1); if (c && l.t - c.t < 12) c.text += " " + l.text; else chunks.push({ ...l }); }
  const body = chunks.map(l => `[${mmss(l.t)}] ${l.text}`).join("\n").slice(0, 150000); // ~64K-token context with room for the answer
  const ask = async content => {
    const r = await fetch(base + "/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${llm.apiKey || "none"}` },
      body: JSON.stringify({ model: llm.modelId, max_tokens: 3000, temperature: 0.3, reasoning_effort: "none", response_format: { type: "json_object" },
        messages: [{ role: "system", content: "คุณเป็นบรรณาธิการข่าวไอทีไทย ตอบเป็นภาษาไทยเท่านั้น" }, { role: "user", content }] }),
      signal: AbortSignal.timeout(300000),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return parseJson((await r.json()).choices[0].message.content);
  };
  let j;
  for (let attempt = 1; ; attempt++) {
    try {
      j = await ask(`${ASK(meta, FRAMES)}\n\nคำบรรยายพร้อมเวลา:\n${body}`);
      // a digest without key moments has no screen captures: worth one more try (qwen skips them now and then)
      if (!keyPoints(j).length && attempt < 2) { step("ไม่ได้ประเด็นสำคัญพร้อมเวลา ลองอีกครั้ง"); continue; }
      break;
    }
    catch (e) { if (attempt >= 2) throw e; step("คำตอบ JSON ไม่สมบูรณ์ ลองอีกครั้ง"); }
  }
  // qwen slips Chinese/Japanese/Vietnamese words into Thai text ("ประสิทธิภาพ在游戏中", "tiêu thụ"): one rewrite pass
  if (FOREIGN.test(JSON.stringify(j))) {
    step("พบคำภาษาอื่นปน แก้เป็นภาษาไทย");
    try {
      const fixed = await ask(`JSON นี้มีคำภาษาจีน ญี่ปุ่น หรือเวียดนามปนอยู่ ให้แปลเฉพาะคำเหล่านั้นเป็นภาษาไทย ห้ามเปลี่ยนเนื้อหา ตัวเลข เวลา (t) หรือโครงสร้าง แล้วตอบเป็น JSON เดิมทั้งก้อน:\n${JSON.stringify(j)}`);
      if (keyPoints(fixed).length >= keyPoints(j).length && fixed.summary) j = fixed;
    } catch { /* keep the first answer */ }
  }
  return { ...j, engine: `llm:${llm.modelId}` };
}

async function notebooklmReady() {
  try { await sh("notebooklm", ["auth", "check", "--json"], 30000); return true; } catch { return false; }
}

// one shared notebook for every clip (its id is kept next to the digests); each clip becomes one source in it
async function viaNotebookLm(meta) {
  const nbFile = path.join(OUT, "notebook.json");
  let nb = fs.existsSync(nbFile) ? JSON.parse(fs.readFileSync(nbFile, "utf8")).id : null;
  if (!nb) {
    nb = deep(JSON.parse(await sh("notebooklm", ["create", "iHC-Press · YouTube", "--json"], 60000)), ["notebook_id", "id", "active_notebook_id"]);
    if (!nb) throw new Error("สร้าง notebook ไม่ได้ (อ่าน id จากผลลัพธ์ไม่ได้)");
    fs.writeFileSync(nbFile, JSON.stringify({ id: nb, created: new Date().toISOString() }));
  }
  step("NotebookLM: เพิ่มคลิปเป็นแหล่งข้อมูล");
  const src = deep(JSON.parse(await sh("notebooklm", ["source", "add", meta.url, "-n", nb, "--json"], 120000)), ["source_id", "id"]);
  if (!src) throw new Error("เพิ่มคลิปเข้า NotebookLM ไม่ได้");
  await sh("notebooklm", ["source", "wait", src, "-n", nb, "--timeout", "300", "--json"], 320000);
  step("NotebookLM: สรุปเนื้อหา");
  const env = { ...process.env, NOTEBOOKLM_NOTEBOOK: nb };
  const ans = (await run("notebooklm", ["ask", ASK(meta, FRAMES), "-s", src, "--json"], { timeout: 300000, env, encoding: "utf8", windowsHide: true, maxBuffer: 16 << 20 })).stdout;
  return { ...parseJson(deep(JSON.parse(ans), ["answer", "text", "content"]) ?? ans), engine: "notebooklm", notebook: nb, source: src };
}

async function frames(id, points, dir) {
  if (!points.length || !FRAMES) return [];
  // ffmpeg seeking the googlevideo URL itself stalls (YouTube throttles plain range reads); yt-dlp's chunked download runs
  // at full speed, so fetch the video-only stream (<=720p, ~5 MB a minute), cut the frames locally and delete it
  step("ดาวน์โหลดวิดีโอ (เฉพาะภาพ ≤720p) เพื่อจับภาพหน้าจอ");
  const tmp = path.join(dir, "_video.mp4");
  await ytdlp(["-q", "-f", "bv*[height<=720][ext=mp4]/bv*[height<=720]/b[height<=720]", "-o", tmp, "--force-overwrites", `https://www.youtube.com/watch?v=${id}`], 900000);
  step(`จับภาพหน้าจอ ${Math.min(points.length, FRAMES)} ภาพ`);
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const out = [];
  try {
    for (const p of points.slice(0, FRAMES)) {
      const s = secs(p.t), file = `frames/${String(Math.floor(s / 60)).padStart(3, "0")}m${String(s % 60).padStart(2, "0")}s.jpg`;
      try {
        await sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(s + 1), "-i", tmp, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "3", path.join(dir, file)], 60000);
        out.push({ t: p.t, file });
      } catch { /* one bad seek should not lose the digest */ }
    }
  } finally { fs.rmSync(tmp, { force: true }); }
  return out;
}

const md = d => [
  `# ${d.title}`, `> ช่อง: ${d.channel} · เผยแพร่: ${d.uploaded} · ความยาว: ${mmss(d.duration)} · สรุปโดย: ${d.engine}`, `> ลิงก์: ${d.url}`, "",
  "## สรุป", d.summary, "", "## ประเด็นสำคัญ",
  ...d.key_points.map(p => { const f = d.frames.find(x => x.t === p.t); return `- **[${p.t}](${d.url}&t=${secs(p.t)}s)** ${p.point}${f ? `\n  ![${p.t}](${f.file})` : ""}`; }),
  "", "## มุมข่าว", d.news_angle || "-", "", "## ต้องตรวจกับแหล่งต้นทาง", ...(d.claims_to_verify || []).map(c => `- ${c}`),
  "", `*ภาพหน้าจอเป็นของช่อง ${d.channel} ใช้ประกอบข่าวต้องให้เครดิตและลิงก์คลิป*`,
].join("\n") + "\n";

try {
  if (!url) done({ ok: false, error: "ต้องระบุลิงก์ YouTube" });
  const id = (url.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{11})/) || [])[1];
  if (!id) done({ ok: false, error: "ลิงก์นี้ไม่ใช่คลิป YouTube (ต้องมีรหัสคลิป 11 ตัว)" });
  step("อ่านข้อมูลคลิป");
  const j = JSON.parse(await ytdlp(["--skip-download", "-J", `https://www.youtube.com/watch?v=${id}`], 120000));
  const meta = { id, url: `https://www.youtube.com/watch?v=${id}`, title: j.title, channel: j.channel || j.uploader, channelUrl: j.channel_url,
    uploaded: (j.upload_date || "").replace(/(\d{4})(\d\d)(\d\d)/, "$1-$2-$3"), duration: j.duration || 0, lang: j.language || "" };
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  step("ดึงคำบรรยาย (subtitle)");
  const tr = await transcript(id, meta.lang, dir);
  let engine = ENGINE === "auto" ? ((await notebooklmReady()) ? "notebooklm" : "llm") : ENGINE;
  if (engine === "llm" && !tr.lines.length) done({ ok: false, error: "คลิปนี้ไม่มีคำบรรยาย และ NotebookLM ยังไม่พร้อม จึงสรุปไม่ได้" });
  let r;
  try { step(engine === "notebooklm" ? "NotebookLM: เริ่ม" : "สรุปด้วย LLM"); r = engine === "notebooklm" ? await viaNotebookLm(meta) : await viaLlm(meta, tr.lines); }
  catch (e) {
    if (engine !== "notebooklm" || ENGINE !== "auto" || !tr.lines.length) throw e;
    step(`NotebookLM ล้มเหลว (${e.message.slice(0, 80)}) ใช้ LLM แทน`);
    r = { ...(await viaLlm(meta, tr.lines)), fallbackFrom: "notebooklm" };
  }
  // timestamps outside the clip (a model that guessed) are dropped instead of capturing a black frame
  if (process.env.YT_DEBUG) process.stderr.write(JSON.stringify(r.key_points) + "\n");
  const pts = keyPoints(r).filter(p => secs(p.t) < (meta.duration || 1e9));
  const d = { ...meta, summary: r.summary || "", key_points: pts, topics: r.topics || [], news_angle: r.news_angle || "", claims_to_verify: r.claims_to_verify || [],
    engine: r.engine, notebook: r.notebook, transcriptLang: tr.lang, transcriptLines: tr.lines.length, frames: await frames(id, pts, dir), at: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, "transcript.txt"), tr.lines.map(l => `[${mmss(l.t)}] ${l.text}`).join("\n"));
  fs.writeFileSync(path.join(dir, "digest.json"), JSON.stringify(d, null, 1));
  fs.writeFileSync(path.join(dir, "digest.md"), md(d));
  for (const f of fs.readdirSync(dir)) if (f.startsWith("sub.")) fs.rmSync(path.join(dir, f));
  done({ ok: true, id, dir, engine: d.engine, title: d.title, points: pts.length, frames: d.frames.length });
} catch (e) { done({ ok: false, error: String(e.message || e).slice(0, 300) }); }

// News artwork checks: brief parsing, the news-folder picture guard, which stories --pending picks, and real renders into a temp
// news dir (needs Edge or Chrome). usage: node tests/news-art.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseBrief, newsPicture, pendingJobs } from "../tools/news-art/render.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RENDER = path.join(ROOT, "tools", "news-art", "render.mjs");
let n = 0;
const T = (name, fn) => { fn(); n++; console.log("PASS", name); };

T("brief: labelled lines, Thai or English labels, '-' means none", () => {
  const b = parseBrief("แบบภาพ: card\nประเด็น: ข้อหนึ่ง | ข้อสอง | ข้อสาม | ข้อสี่\nภาพจากข่าว: youtube/abcdefghijk/frames/0001.jpg (02:15)\nภาพหลัก: ชิป\nคำบรรยายภาพ: ภาพชิป\nalt text: ชิปบนเมนบอร์ด");
  assert.deepEqual(b, { variant: "card", points: ["ข้อหนึ่ง", "ข้อสอง", "ข้อสาม"], art: "youtube/abcdefghijk/frames/0001.jpg", alt: "ชิปบนเมนบอร์ด", caption: "ภาพชิป" });
  assert.equal(parseBrief("variant: breaking (ข่าวด่วน)").variant, "breaking");
  assert.equal(parseBrief("แบบภาพ: ข่าวด่วน").variant, "breaking");
  assert.deepEqual(parseBrief("แบบภาพ: -\nประเด็น: -\nภาพจากข่าว: -"), { variant: "", points: [], art: "", alt: "", caption: "" });
  assert.deepEqual(parseBrief("ภาพหลัก: โน้ตบุ๊ก\nalt: โน้ตบุ๊กบนโต๊ะ"), { variant: "", points: [], art: "", alt: "โน้ตบุ๊กบนโต๊ะ", caption: "" }); // old 4-line briefs
  assert.equal(parseBrief(undefined).variant, "");
});

const news = fs.mkdtempSync(path.join(os.tmpdir(), "ihc-art-test-"));
fs.mkdirSync(path.join(news, "youtube", "x"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "tools", "news-art", "assets", "beat-gaming.jpg"), path.join(news, "youtube", "x", "shot.jpg"));
fs.writeFileSync(path.join(news, "youtube", "x", "note.txt"), "x");

T("picture guard: only image files inside the news folder", () => {
  assert.equal(newsPicture("youtube/x/shot.jpg", news), path.join(news, "youtube", "x", "shot.jpg"));
  for (const bad of ["../../Windows/win.ini", "youtube/x/note.txt", "youtube/x/missing.jpg", "C:/Windows/Web/Wallpaper/Windows/img0.jpg", ""])
    assert.equal(newsPicture(bad, news), "", bad);
});

const story = (id, status, o = {}) => ({ id, status, beat: "gaming", title: "t", headline: `พาดหัว ${id}`, body: "เนื้อข่าวย่อหน้าแรก\n\nย่อหน้าสอง",
  sources: [{ url: "https://www.example.com/a" }], image: "", updatedAt: "2026-10-17T03:00:00Z", ...o });
const stories = [story("S1", "ready", { image: "แบบภาพ: breaking\nภาพจากข่าว: youtube/x/shot.jpg" }), story("S2", "published"),
  story("S3", "editing"), story("S4", "killed"), story("S5", "ready", { headline: "", title: "" }), story("S6", "ready", { image: "แบบภาพ: card\nประเด็น: ก | ข" })];
fs.writeFileSync(path.join(news, "stories.json"), JSON.stringify({ seq: {}, stories }));
const env = { ...process.env, BOTPRESS_NEWS_DIR: news };
const run = (...args) => {
  const r = spawnSync(process.execPath, [RENDER, ...args], { env, encoding: "utf8", timeout: 120000 });
  return JSON.parse(r.stdout.trim().split("\n").pop());
};

T("pending: ready/published with a headline, nothing else", () => {
  assert.deepEqual(pendingJobs(stories, path.join(news, "art")).map(j => j.s.id), ["S1", "S2", "S6"]);
});

T("--pending renders them once, with the brief's variant, picture and bullets", () => {
  const r = run("--pending");
  assert.deepEqual(r, { ok: true, rendered: ["S1", "S2", "S6"], failed: [] });
  const m1 = JSON.parse(fs.readFileSync(path.join(news, "art", "S1", "meta.json"), "utf8"));
  assert.equal(m1.variant, "breaking"); assert.equal(m1.art, "shot.jpg"); assert.equal(m1.source, "auto");
  assert.deepEqual(Object.keys(m1.files), ["16x9", "1x1", "4x5"]);
  for (const f of Object.values(m1.files)) assert.ok(fs.statSync(path.join(news, "art", "S1", f)).size > 100000, f);
  assert.equal(JSON.parse(fs.readFileSync(path.join(news, "art", "S6", "meta.json"), "utf8")).variant, "card");
  assert.deepEqual(run("--pending"), { ok: true, rendered: [], failed: [] }); // up to date: nothing to do (and no browser started)
});

T("headline or brief change -> render again; a variant picked by hand survives it", () => {
  const m = run("--story", "S2", "--variant", "card", "--formats", "1x1");
  assert.equal(m.ok, true); assert.equal(m.source, "manual"); assert.deepEqual(Object.keys(m.files), ["1x1"]);
  stories[1].headline = "พาดหัวใหม่"; stories[0].image = "แบบภาพ: photo";
  fs.writeFileSync(path.join(news, "stories.json"), JSON.stringify({ seq: {}, stories }));
  assert.deepEqual(run("--pending").rendered, ["S1", "S2"]);
  const m2 = JSON.parse(fs.readFileSync(path.join(news, "art", "S2", "meta.json"), "utf8"));
  assert.equal(m2.variant, "card"); assert.equal(m2.source, "manual"); assert.equal(m2.headline, "พาดหัวใหม่");
  assert.equal(JSON.parse(fs.readFileSync(path.join(news, "art", "S1", "meta.json"), "utf8")).variant, "photo");
});

T("errors come back as JSON: unknown story, story without headline, unknown variant", () => {
  assert.match(run("--story", "NOPE").error, /ไม่พบข่าว NOPE/);
  assert.match(run("--story", "S5").error, /ยังไม่มีพาดหัว/);
  assert.match(run("--story", "S1", "--variant", "neon").error, /unknown variant/);
});

fs.rmSync(news, { recursive: true, force: true });
console.log(`${n}/${n} PASS`);

// Same lookup as Paths.cs: env BOTPRESS_NEWS_DIR / BOTPRESS_INFRA_DIR, else %LOCALAPPDATA%\BotPress\paths.json
// ({ "news": "...", "infra": "..." }), else the original layout (D:\botpress\news, D:\localai).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const file = path.join(process.env.LOCALAPPDATA || os.homedir(), "BotPress", "paths.json");
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* missing or broken: original layout */ }
const pick = (env, key, fallback) => process.env[env] || cfg[key] || fallback;

export const NEWS_DIR = pick("BOTPRESS_NEWS_DIR", "news", "D:\\botpress\\news");
export const INFRA_DIR = pick("BOTPRESS_INFRA_DIR", "infra", "D:\\localai");

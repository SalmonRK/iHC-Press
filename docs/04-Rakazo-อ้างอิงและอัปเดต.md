# Rakazo: ข้อมูลอ้างอิงและการติดตามอัปเดต

> บันทึกไว้ 2026-10-12 · ใช้ตรวจเมื่อ Rakazo หรือ BotPress มีเวอร์ชันใหม่
> ตรวจอัปเดต: `node tools/check-rakazo-updates.mjs` (เทียบกับเวอร์ชันที่บันทึกไว้ใน `tools/rakazo-baseline.json`)

## 1. ข้อมูลหลัก

| หัวข้อ | ค่า |
|---|---|
| Repo | https://github.com/elie222/rakazo |
| เว็บ | https://rakazo.com · Discord: https://discord.gg/RWwKa2Sn7h |
| ผู้พัฒนาหลัก | **Elie Steinbock** (`elie222`) ผู้สร้าง Inbox Zero (https://getinboxzero.com) · https://elie.tech · YouTube `elie2222` |
| License | Apache-2.0 |
| สร้าง repo | 2026-08-13 (ยังเป็น beta) |
| ความนิยม (2026-10-12) | 3,756 stars · 647 forks |
| คำอธิบาย | "Open-source Grok Bot alternative. Choose your own model and sandbox." |
| แนวคิด (`VISION.md`) | "เพื่อนร่วมทีม AI" ที่มีตัวตน แชท ความจำ routine และคอมพิวเตอร์ของตัวเองอย่างต่อเนื่อง เจ้าของคุมเองได้ทั้งหมด และไม่ต้องพึ่งบริการ cloud |

## 2. เวอร์ชัน

| Tag | วันที่ | Commit | หมายเหตุ |
|---|---|---|---|
| **v0.1.6** | 2026-09-08 | `84c8689f92f2` | **เวอร์ชันที่ BotPress ใช้** (`botpress.sh`: `IMAGE=ghcr.io/elie222/rakazo/app:v0.1.6`) |
| v0.2.0 | 2026-10-10 | `f10b4ffd3e4c` | ห่างจาก v0.1.6 375 commits ดูหัวข้อ 4 |
| (BotPress) | 2026-10-04 | `c3dfeda` | jaturapornchai/botpress commit ที่ใช้อ้างอิง |

Image ที่ใช้: `ghcr.io/elie222/rakazo/app:<tag>`, `ghcr.io/elie222/rakazo/computer:<tag>` (ค่าเริ่มต้นของ installer คือ `edge` ซึ่งเป็น build จาก main **ห้ามใช้กับ BotPress**)

## 3. โครงสร้าง (v0.1.6)

- **Stack**
  - TypeScript monorepo (pnpm + turbo)
  - React 19 / Vite / Tailwind
  - Hono + **oRPC** (`POST /rpc/<path>`)
  - PostgreSQL + Prisma
  - Better Auth
  - Graphile Worker
  - Agent runtime **Pi** (`@earendil-works/pi-ai` 0.85.1)
- **Service ใน compose**: `postgres`, `api`, `worker`, `web` (:5173), `supervisor`, `computer`, `data-init`
  - container ที่ BotPress อ้างชื่อตรงตัว: `rakazo-worker-1` และ `rakazo-postgres-1`
- **คอมพิวเตอร์ของบอท**: Docker (ค่าเริ่มต้น), E2B, Daytona, Box
  - Team Computer มี display และ Chrome profile แยกรายบอท
  - Private Computer แยกเครื่องให้บอทตัวเดียว
- **Integrations**: MCP แบบ remote, OpenAPI, Composio, Pipedream, Treg
- **ข้อจำกัดที่ BotPress ได้รับมาด้วย**: ส่งงานต่อได้ไม่เกิน 6 hop, ห้องละ 2-6 บอท, instructions ไม่เกิน 20,000 ตัวอักษร และ approval rule มีผลทั้งบัญชี

### การต่อโมเดล

| ช่องทาง | v0.1.6 | v0.2.0 |
|---|---|---|
| OpenAI-compatible (`models/connect`, BotPress ใช้แบบนี้) | **context ตายตัว 32,768 / max tokens 4,096** | **ตั้ง `contextWindow` และ `maxTokens` ได้ต่อ connection** และทดสอบการเชื่อมต่อก่อนบันทึก |
| Local provider (env `RAKAZO_LOCAL_MODELS`, `_URL`, `_CONTEXT_WINDOW`, `_MAX_TOKENS`, `_VISION_MODELS`) | ตั้งได้ แต่ส่ง `reasoning_effort` ไม่ได้ | เหมือน v0.1.6 (ไฟล์ไม่เปลี่ยน) |
| การตรวจ URL | IP วง private ผ่านได้ รวม **100.64.0.0/10 (Tailscale)** ส่วน host สาธารณะต้องตั้ง `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1` | ยังรองรับ 100.64/10 |
| Backup model | ไม่มี | **มี: ตั้งลำดับโมเดลสำรองเมื่อ provider ล้ม** |
| โมเดลแยกราย routine | ไม่มี | มี |

## 4. v0.2.0 กับ BotPress (ตรวจเมื่อ 2026-10-12)

ผล `check-rakazo-updates.mjs` พบไฟล์ที่ BotPress พึ่งพาเปลี่ยนไป 5 ไฟล์ จากทั้งหมด 8 ไฟล์ที่ติดตาม

| ไฟล์ | ผลต่อ BotPress |
|---|---|
| `pi-openai-compatible-provider.ts` | ดี: ตั้ง context 128K ได้โดยไม่ต้องใช้ local provider |
| `network-address.ts` | วง 100.64/10 ยังเป็น private |
| `apps/api/src/router.ts` (5,159 → 7,022 บรรทัด) | **เสี่ยงสูงสุด** ชื่อ route ที่ BotPress เรียกยังอยู่ (ตรวจแค่ชื่อ) แต่ input และ output อาจเปลี่ยน |
| `.env.example` (192 → 285 บรรทัด) | มีตัวแปรใหม่ ส่วนตัวแปร `RAKAZO_LOCAL_*` และ `OPENAI_COMPAT*` เดิมยังอยู่ |
| `docker-compose.images.yml` | service `worker` และ `postgres` ยังมี แต่ postgres ถูก pin image ใหม่ ต้องดูวิธี migrate ฐานข้อมูล |

ฟีเจอร์ v0.2.0 ที่เป็นประโยชน์กับ BotPress:

- backup model เมื่อ Spark ล่ม ให้สลับไปใช้ Ollama บนเครื่องนี้แทนได้
- routine ใช้โมเดลแยกของตัวเองได้
- `SANDBOX_IDLE_MS=0` ทำให้คอมพิวเตอร์ของบอทไม่หลับ
- จำกัด network ของคอมพิวเตอร์บอทได้

**คำแนะนำ:** ติดตั้งด้วย **v0.1.6** ก่อน เพราะตรงกับที่ BotPress ทดสอบไว้ จากนั้นค่อยทดลอง v0.2.0 ในสภาพแวดล้อมแยกตามหัวข้อ 5

## 5. ขั้นตอนอัปเกรด (เมื่อมีเวอร์ชันใหม่)

1. รัน `node tools/check-rakazo-updates.mjs` (หรือใส่ tag ที่ต้องการเป็น argument) แล้วอ่านส่วนของไฟล์ที่ขึ้น `* CHANGED`
2. อ่าน release notes และ `docs/self-host.md` หัวข้อ "Upgrade" ของเวอร์ชันนั้น
3. **Backup ก่อน** ด้วย `botpress.sh backup` (ได้ postgres และ appdata) แล้วสำรอง `news\` และ `%LOCALAPPDATA%\BotPress\owner.json` แยกด้วย
4. ทดสอบบนสำเนา: `wsl --export Ubuntu-24.04` แล้ว import เป็น distro ทดลอง จากนั้นเปลี่ยน tag ใน `.env` หรือ compose
5. แก้ `IMAGE=` ใน `botpress.sh` ให้ตรงกับ tag ใหม่ แล้วตรวจตามลำดับ
   - `--selftest`
   - `node seed-bots.mjs --dry`
   - `tests/e2e.mjs`
   - `tests/newsroom-live.mjs`
6. ถ้าผ่าน ให้รัน `node tools/check-rakazo-updates.mjs --save` เพื่อบันทึกเวอร์ชันใหม่เป็นจุดอ้างอิง
7. ถ้าไม่ผ่าน ให้กลับไปใช้ distro และ backup เดิม **ห้ามใช้ `docker compose down -v`**

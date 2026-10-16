# Rakazo v0.1.6: เจาะลึก และการใช้ LLM จาก LocalAI-08

> จัดทำ 2026-10-12 จากการอ่านโค้ด Rakazo ที่ tag `v0.1.6` (github.com/elie222/rakazo) และการทดสอบ API ของ LocalAI-08 จากเครื่องนี้ผ่าน Tailscale
> เอกสารคู่กัน: `02-ภาพรวม-TechStack-และแผนเดิม.md`

---

## 0. คำตอบสั้น

**ใช้ได้** API ที่ `http://100.97.194.95:8001/v1` (`localaipc-008` บน Tailscale) เป็น API แบบ OpenAI-compatible ที่ผ่านการทดสอบทุกอย่างที่ Rakazo ต้องใช้ ได้แก่ chat, **tool calling**, **streaming**, **รับภาพ** และตอบภาษาไทยได้ถูกต้อง นอกจากนี้ Rakazo ยอมให้เชื่อมกับ IP วง `100.64.0.0/10` ของ Tailscale ได้โดยไม่ต้องตั้งค่าพิเศษ

ข้อควรรู้ 3 ข้อก่อนใช้:

1. **ตัวที่ตอบที่ port 8001 รายงานตัวเองว่าเป็น `tensorfold` ไม่ใช่ vLLM** (`/health` ได้ `"backend": "tensorfold"`, `owned_by: "tensorfold"`) อาจเป็นตัวที่รันอยู่หน้า vLLM หรือเป็นคนละตัวกันก็ได้ ส่วน port 8000 ซึ่งเป็น port มาตรฐานของ vLLM ไม่ตอบ **ควรถามเจ้าของเครื่องว่านี่คือตัวที่ตั้งใจให้ใช้หรือไม่**
2. Rakazo v0.1.6 **จำกัด context ของโมเดลแบบ OpenAI-compatible ไว้ที่ 32,768 token และ output ไว้ที่ 4,096 token** แม้ server จะรองรับถึง 262,144 token ก็ตาม **ขยายเป็น 128K ได้ผ่าน local provider** (ดูหัวข้อ 2.2 และ 6)
3. `openthai2.0` เป็น **โมเดลแบบ reasoning** ที่ "คิด" ก่อนตอบเป็นค่าเริ่มต้น ถ้าไม่ปิดการคิด โมเดลอาจใช้ token output ที่จำกัดไว้ 4,096 ไปกับการคิดจนไม่เหลือสำหรับคำตอบ ปิดได้ด้วย `reasoning_effort: "none"` (ทดสอบแล้ว ได้ reasoning token เป็น 0)

---

## 1. Rakazo v0.1.6 คืออะไร

แพลตฟอร์ม open source (สถานะ beta) สำหรับรัน **"เพื่อนร่วมทีม AI" ที่ทำงานต่อเนื่อง** บอทแต่ละตัวมีแชท ความจำ routine และประวัติของตัวเอง เปิดใช้ได้ทั้งผ่านเว็บ, แอปเดสก์ท็อป (Electron) และแอปมือถือ (Expo)

### 1.1 Tech stack

| ชั้น | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript (pnpm monorepo + turbo) |
| Web UI | React 19, Vite, Tailwind |
| API | Hono + **oRPC** (`POST /rpc/<path>`) ซึ่ง BotPress เรียกผ่าน `RakazoClient.cs` |
| ฐานข้อมูล | PostgreSQL + Prisma |
| Auth | Better Auth (`/api/auth/sign-in/email`) |
| Job queue | Graphile Worker (ใช้รัน routine และงานเบื้องหลัง) |
| **Agent runtime** | **Pi** (`@earendil-works/pi-ai` และ `pi-agent-core` 0.85.1) รันอยู่ใน process ของ api/worker ไม่ได้รันในคอมพิวเตอร์ของบอท |
| คอมพิวเตอร์ของบอท | `SandboxProvider`: Docker (ค่าเริ่มต้น), E2B, Daytona, Box |
| Integrations | MCP แบบ remote, OpenAPI, Composio, Pipedream, Treg |

### 1.2 Service ใน Docker Compose (`infra/compose/docker-compose.images.yml`)

| Service | หน้าที่ |
|---|---|
| `postgres` | ฐานข้อมูล (volume `pgdata`) |
| `api` | oRPC + auth + Pi agent session |
| `worker` | Graphile Worker รัน routine และ job (BotPress ให้ container `botpress-newsdesk` ใช้ network namespace ร่วมกับตัวนี้) |
| `web` | UI ที่ `127.0.0.1:5173` ซึ่ง proxy `/api` และ `/rpc` ไปให้ด้วย |
| `supervisor` | คุม container คอมพิวเตอร์ของบอท ใช้ `SANDBOX_SUPERVISOR_TOKEN` |
| `computer` | image ของคอมพิวเตอร์ของบอท (`ghcr.io/elie222/rakazo/computer`) |
| `data-init` | เตรียม volume ของข้อมูล (`appdata`) |

### 1.3 แนวคิดหลัก

- **Bot**: มี instructions (ไม่เกิน 20,000 ตัวอักษร), ความจำ (`MEMORY.md`) และโมเดลของตัวเองหรือใช้ค่า default ของบัญชี
- **Group (ห้อง)**: มีบอทได้ 2-6 ตัว เรียกบอทด้วย `@ชื่อ`
- **Routine**: งานตั้งเวลาแบบ cron + timezone
- **Approval rule**: บังคับให้หยุดรอคนกดอนุมัติก่อนเรียกเครื่องมือที่กำหนด **มีผลทั้งบัญชี**
- **การส่งงานต่อ**: บอทส่งงานให้บอทอื่น (`message_bot`) หรือ subagent ได้ สายหนึ่งส่งต่อได้ไม่เกิน 6 hop
- **Computer**
  - Team Computer: บอทใช้เครื่องเดียวกัน แต่ละตัวมี X display และ Chrome profile ของตัวเอง
  - Private Computer: แยกเครื่องให้บอทตัวเดียว
  - เครื่องมือที่บอทได้: `browser_navigate`, `browser_snapshot`, `browser_act`, `computer_observe`, `computer_act`, `shell` และเครื่องมือไฟล์
  - **การควบคุมหน้าจอต้องใช้โมเดลที่รับภาพได้** ถ้าโมเดลไม่รับภาพ เครื่องมือ screenshot จะถูกปิด
- **Takeover**: คนเข้าไปคุมหน้าจอของบอทแทนชั่วคราว

---

## 2. Rakazo ต่อโมเดลอย่างไร (จากโค้ด v0.1.6)

### 2.1 ช่องทางที่ 1: OpenAI-compatible (เชื่อมผ่าน UI หรือ `models/connect`)

BotPress ใช้ช่องทางนี้ (`RakazoClient.ConnectModel`)

- **การตรวจ URL** (`packages/adapters/src/openai-compatible-url.ts`, `network-address.ts`)
  - IP กลุ่ม private ผ่านได้เลย ได้แก่ loopback, 10/8, 172.16/12, 192.168/16 และ **100.64.0.0/10 (CGNAT ซึ่งเป็นวงของ Tailscale)** ✅
  - hostname ทั่วไปหรือ IP สาธารณะต้องตั้ง `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1` และถ้าส่ง API key ต้องใช้ HTTPS
  - IP metadata ของ cloud และ link-local ถูกบล็อกเสมอ ไม่เกี่ยวกับกรณีนี้
  - ใช้ **IP ตรง** (`100.97.194.95`) ดีกว่า hostname ของ MagicDNS เพราะ hostname จะติดเงื่อนไขของ host สาธารณะ
- **ค่าตายตัวในโค้ด** (`pi-openai-compatible-provider.ts`)
  - `contextWindow = 32_768`
  - `maxTokens = 4_096`
  - `supportsDeveloperRole: false`
  - `thinkingFormat: "openai"` และ `thinkingLevelMap: { off: "none" }`
- **Vision**: ใส่ model id ใน `RAKAZO_OPENAI_COMPATIBLE_VISION_MODELS` เพื่อให้เครื่องมือ screenshot ใช้งานได้
- **ตัวเลือก "Supports thinking"** (หน้า Advanced ตอนเชื่อมโมเดล) ใช้ส่ง `reasoning_effort` ค่านี้เก็บไว้กับ connection ไม่ต้องตั้ง env

> ⚠️ README ของ BotPress พูดถึงตัวแปร `RAKAZO_OPENAI_COMPATIBLE_CONTEXT_WINDOWS` แต่ **ในโค้ด upstream v0.1.6 ไม่มีตัวแปรนี้** (ค้นทั้ง repo แล้วไม่เจอ) จึงน่าจะเป็น hotfix ของผู้เขียน BotPress ถ้าติดตั้ง Rakazo จากต้นฉบับ context จะถูกจำกัดที่ 32K

### 2.2 ช่องทางที่ 2: Local provider (ตั้งด้วย env เท่านั้น)

`packages/adapters/src/pi-local-provider.ts` เปิดด้วยตัวแปรเหล่านี้ใน `.env`

```env
RAKAZO_LOCAL_MODELS=openthai2.0
RAKAZO_LOCAL_MODELS_URL=http://100.97.194.95:8001/v1
RAKAZO_LOCAL_CONTEXT_WINDOW=131072      # ปรับได้ (server รองรับ 262144)
RAKAZO_LOCAL_MAX_TOKENS=16384           # ปรับได้ เผื่อ token ที่ใช้คิด
RAKAZO_LOCAL_VISION_MODELS=openthai2.0
```

**ช่องทางนี้ดีกว่าเพราะปรับ context และ max tokens ได้** แต่ BotPress บังคับใช้ credential แบบ OpenAI-compatible เป็นค่า default ของบัญชีอยู่ ถ้าจะใช้ local provider ต้องแก้ `RakazoClient.cs` (ดูทาง C ในหัวข้อ 4)

---

## 3. ผลทดสอบ LocalAI-08 (2026-10-12 จากเครื่องนี้)

| ทดสอบ | ผล |
|---|---|
| ชื่อเครื่องบน Tailscale | `localaipc-008`, Linux, `100.97.194.95` (ชื่อ `LocalAI-08` resolve ไม่ได้ และ MagicDNS ไม่ตอบ จึงต้องใช้ IP) |
| port ที่เปิด | **8001** = API แบบ OpenAI · 8080 = หน้าเว็บ (คาดว่า Open WebUI) · 8000 / 11434 = ไม่ตอบ |
| `GET /v1/models` | `openthai2.0` (owned_by `tensorfold`) |
| `GET /health` | `ok: true`, `backend: tensorfold`, **รับพร้อมกันได้ 4 stream**, **context_length 262144** |
| `/metrics` | มีแบบ Prometheus (`tensorfold:*`) |
| Chat ภาษาไทย | "เมืองหลวงของประเทศไทยคืออะไร" → `กรุงเทพมหานคร` ✅ (ใช้ reasoning ไป 122 token) |
| **Tool calling** | เรียก `get_weather({"city":"Bangkok"})` ได้ถูกต้อง และได้ `finish_reason: tool_calls` ✅ |
| **Streaming (SSE)** | ✅ (ส่ง `reasoning_content` มาก่อน `content`) |
| **รับภาพ** (data URL) | ตอบสีของภาพทดสอบได้ถูก ("Red") ✅ |
| `reasoning_effort: "none"` | ปิดการคิดได้ (reasoning token = 0) ✅ |
| ส่งชื่อโมเดลอื่น (`gemma4`) | **รับได้** และตอบด้วย `openthai2.0` เสมอ |
| Auth | **ไม่ตรวจ key** (key ผิดก็ได้ 200) ทุกเครื่องใน tailnet จึงเรียกใช้ได้ |
| ความเร็ว (ดูคร่าว ๆ) | prefill ราว 0.1-0.4 วินาที, decode ราว 25-60 token/วินาที และมี speculative decoding |

> หมายเหตุ: ถ้ายิงข้อความภาษาไทยด้วย `curl -d '...'` จาก Git Bash ข้อความจะเพี้ยนเป็น `????` ปัญหาอยู่ที่ encoding ของ shell ไม่ใช่ที่ server แก้ได้โดยเขียน body ลงไฟล์ UTF-8 ก่อนแล้วใช้ `--data-binary @file`

---

## 4. วิธีต่อ BotPress เข้ากับ LocalAI-08

ข้อดีเมื่อเทียบกับ Gemma บนเครื่องนี้:

- **ไม่ใช้ GPU ของเครื่องนี้เลย** จึงไม่ชนกับ ComfyUI หรือ Forge และไม่ต้องดาวน์โหลดโมเดลเข้า D: ที่เหลือพื้นที่น้อย
- รับพร้อมกันได้ 4 stream เทียบกับ 2 slot ของ llama-server จึงวางตาราง routine ให้ถี่ขึ้นได้

### ทาง A: ไม่แก้โค้ด (เร็วที่สุด เหมาะกับการเริ่มต้น)

ให้ `127.0.0.1:8080` บน Windows ส่งต่อไปที่ LocalAI-08 แล้วใช้ socat bridge ใน WSL ตามแบบเดิม (`172.17.0.1:18080 → 127.0.0.1:8080`)

```powershell
# PowerShell (Admin)
netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=8080 connectaddress=100.97.194.95 connectport=8001
```

- `.env` ของ Rakazo: `RAKAZO_OPENAI_COMPATIBLE_VISION_MODELS=gemma4` (BotPress ส่ง model id `gemma4` ซึ่ง server ยอมรับ)
- `D:\localai\llm-api-key.txt`: ใส่บรรทัด `gemma-...` และ `rakazo-...` ค่าอะไรก็ได้ เพราะ server ไม่ตรวจ key
- ผลที่คาด (อนุมานจากโค้ด ยังไม่ได้รันจริง)
  - ✅ Monitor เห็น `/health` มีคำว่า `ok` จึงขึ้นว่า LLM "พร้อม" และ `/metrics` ตอบ 200 ทำให้ watchdog ไม่รีสตาร์ท
  - ⚠️ ไม่มี process `llama-server.exe` บนเครื่อง
    - autostart จะพยายามเรียก `llm.start` (`serve-th.bat`) ทุกครั้งที่เปิดแอป **ให้สร้าง `serve-th.bat` ว่าง ๆ ที่แค่ `exit /b 0`** เพื่อกัน error
    - `--selftest` จะ FAIL ที่ข้อ "live LLM process"
  - ⚠️ ตัวเลข slot และ t/s ใน Monitor จะเป็น 0 เพราะ `/slots` ได้ 404 และชื่อ metrics เป็น `tensorfold:*`
- ⚠️ context ถูกจำกัดที่ 32K และ output ที่ 4,096 token และโมเดลจะคิดก่อนตอบเสมอ เพราะ BotPress ส่ง `reasoning: false` จึงไม่มีการส่ง `reasoning_effort` ไป

### ทาง B: ชี้ bridge ไปที่ LocalAI-08 โดยตรง (ไม่ต้องใช้ portproxy)

แก้ systemd `llama-bridge.service` ใน WSL เป็น `socat TCP-LISTEN:18080,bind=172.17.0.1,fork,reuseaddr TCP:100.97.194.95:8001`

- ข้อเสีย: Monitor จะขึ้นว่า LLM "ปิดอยู่" และ watchdog กับ autostart ใช้ไม่ได้
- ต้องเปิด WSL แบบ mirrored เพื่อให้ WSL มองเห็น Tailscale ของ Windows

### ทาง C: แก้โค้ดให้รองรับ LLM ระยะไกล (แนะนำสำหรับพัฒนาต่อ)

1. แยก `LlmUrl`, model id, base URL และ "โหมดระยะไกล" ใน `Monitor.cs` และ `RakazoClient.cs` ออกเป็นค่าตั้งได้ (ทำพร้อมงานแยก path ในเฟส 3 ของคู่มือหลัก)
2. เมื่อเป็นโหมดระยะไกล ให้ข้ามการตรวจ process `llama-server.exe` ใน autostart, `--selftest` และ watchdog
3. เลือกได้ 2 แบบ
   - เชื่อมแบบ `models/connect` ไปที่ `http://100.97.194.95:8001/v1` ตรง ๆ พร้อม `modelId: "openthai2.0"` และ `reasoning: true` เพื่อให้ปิดการคิดได้ด้วย thinking level `off` → `none` **(ต้องทดสอบว่า Pi ส่งค่าออกไปจริง)**
   - หรือใช้ **local provider** (หัวข้อ 2.2) ซึ่งตั้ง context และ max tokens ได้
4. ถ้าใช้โหมดระยะไกล เพิ่มปุ่ม "🌐 LocalAI-08" ข้างปุ่มโหมด 🖥 Local / 🔀 BCAi ได้

### สิ่งที่ต้องทดสอบจริงเมื่อติดตั้ง

```bash
# 1) container ใน WSL เรียก LocalAI-08 ผ่าน Tailscale ได้ไหม (ต้องตั้ง mirrored networking)
docker run --rm curlimages/curl -s http://100.97.194.95:8001/health
# 2) เรียกผ่าน bridge ได้ไหม (ทาง A หรือ B)
docker run --rm curlimages/curl -s http://172.17.0.1:18080/v1/models
# 3) เดินข่าวจริง 1 เรื่องแล้วดูว่า kick น้อยลงไหม และมีกรณี content ว่างเพราะคิดจนหมด token หรือไม่
node tests/newsroom-live.mjs 90
```

---

## 5. ความเสี่ยงและข้อควรระวัง

| เรื่อง | รายละเอียด | วิธีลด |
|---|---|---|
| ไม่ใช่ vLLM | port 8001 เป็น `tensorfold` และพฤติกรรมอาจต่างจาก vLLM (เช่น ไม่มี `/v1/models/<id>` และไม่มี `/version`) | ยืนยันกับเจ้าของเครื่อง ถ้า vLLM จริงอยู่ port อื่นให้ทดสอบซ้ำ |
| token output หมดไปกับการคิด | ตอนทดสอบด้วย `max_tokens` 50 ได้ `content: null` เพราะใช้ token คิดจนหมด | ปิดการคิด (`reasoning_effort: none`) หรือใช้ local provider แล้วเพิ่ม `RAKAZO_LOCAL_MAX_TOKENS` |
| context 32K | Rakazo จะบีบอัดบทสนทนาเร็วกว่าที่ server รองรับ | ใช้ local provider หรือ patch ค่าใน `pi-openai-compatible-provider.ts` |
| ไม่มี auth | เครื่องไหนใน tailnet ก็เรียกใช้ได้ | ถ้าต้องการจำกัดสิทธิ์ ให้ใช้ ACL ของ Tailscale |
| ใช้เครื่องร่วมกับคนอื่น | ถ้ามีงานอื่นใช้ 4 stream อยู่ บอทจะต้องรอคิว (`requests_waiting`) | ดู `/metrics` และวาง routine ให้เหลื่อมกันเหมือนเดิม |
| เครือข่าย | ถ้า Tailscale หรือ `localaipc-008` ดับ บอททุกตัวจะล้มด้วย "Connection error." | เก็บ Gemma หรือ Ollama บนเครื่องนี้ไว้เป็นโหมดสำรอง |
| การตีความ reasoning | ยังไม่ได้ตรวจว่า Pi แสดง `reasoning_content` อย่างไร | ตรวจในแชทตอนทดสอบ |

---

## 6. ขยาย context เป็น 128K ขึ้นไป (ทดสอบแล้ว)

### 6.1 ฝั่ง server (LocalAI-08 / DGX Spark): **รองรับ**

ทดสอบแบบ needle-in-a-haystack คือซ่อนข้อเท็จจริง 1 บรรทัดไว้ในข้อความยาว แล้วถามหา (ตั้ง `reasoning_effort: none`):

| ขนาด prompt | คำตอบ | prefill (ครั้งแรก) | ถ้าส่ง prefix เดิมซ้ำ |
|---|---|---|---|
| 71,738 token | ✅ ถูกต้อง | 72 วินาที (ราว 1,000 token/วินาที) | **cache 71,731 token, prefill 0.24 วินาที, ใช้เวลารวม 1.9 วินาที** |
| 126,339 token | ✅ ถูกต้อง (ฝังไว้ที่ตำแหน่งราว 86% ของข้อความ) | 146 วินาที (ราว 860 token/วินาที) | (ไม่ได้ทดสอบ) |

- **มี prefix caching** ซึ่งสำคัญมากกับ agent เพราะ agent ส่งบทสนทนาทั้งหมดซ้ำทุกครั้งที่เรียก tool ส่วนที่ต้อง prefill ใหม่มีแค่ข้อความที่เพิ่มเข้ามา
- **ต้นทุน**: ครั้งแรกที่ context เต็ม 128K จะรอราว 2.5 นาที และ cache อาจหลุดถ้ามีคนอื่นใช้เครื่องพร้อมกัน (รับได้ 4 stream ร่วมกันทั้งเครื่อง)

### 6.2 ฝั่ง Rakazo: ต้องใช้ local provider (หรือ patch)

| วิธี | context | ความยาก |
|---|---|---|
| OpenAI-compatible (BotPress ใช้แบบนี้อยู่) | **ตายตัวที่ 32,768** ต้อง patch `pi-openai-compatible-provider.ts` แล้ว build image เอง | สูง |
| **Local provider (แนะนำ)** | ตั้งได้ด้วย env (ไม่มีเพดานในโค้ด แค่ต้องเป็นจำนวนเต็มบวก) | ต่ำ |

```env
RAKAZO_LOCAL_MODELS=openthai2.0
RAKAZO_LOCAL_MODELS_URL=http://100.97.194.95:8001/v1
RAKAZO_LOCAL_CONTEXT_WINDOW=131072   # 128K (แนะนำ) ตั้ง 262144 ได้ แต่ถ้า cache ไม่โดน ต้องรอ prefill ราว 5 นาทีขึ้นไป
RAKAZO_LOCAL_MAX_TOKENS=16384        # เผื่อ token ที่ใช้คิด (local provider ส่ง reasoning_effort ไม่ได้ โมเดลจึงคิดทุกครั้ง)
RAKAZO_LOCAL_VISION_MODELS=openthai2.0
```

ข้อควรรู้จากโค้ด:

- Local provider ตั้ง `supportsReasoningEffort: false` ไว้ **จึงปิดการคิดจากฝั่ง Rakazo ไม่ได้** ทางแก้มี 2 แบบ: เพิ่ม `MAX_TOKENS` หรือขอผู้ดูแล Spark ตั้งค่าเริ่มต้นของ server ให้ไม่คิด
- เมื่อตั้ง local provider แล้ว Rakazo จะใช้โมเดลนี้เป็น **ตัวตรวจ auto-review** ด้วย (`auto-review.ts`) ถ้าไม่ได้ตั้ง `RAKAZO_AUTO_REVIEW_PROVIDER` ไว้
- BotPress ต้องแก้ `RakazoClient.ConnectModel` และ `SetLlmMode` ให้ตั้งโมเดล default เป็น provider `local` / `openthai2.0` แทน `openai-compatible` / `gemma4` **(ต้องทดสอบว่า `models/setDefault` ของ provider `local` ต้องเรียก connect ก่อนหรือไม่ เพราะ handler ต้องหา credential ของ provider นั้นให้เจอ)**
- ตัวเลขด้านล่างนี้ **ไม่เปลี่ยนตาม context**: ส่งงานต่อได้ไม่เกิน 6 hop, ห้องละไม่เกิน 6 บอท, instructions ไม่เกิน 20,000 ตัวอักษร และ approval rule มีผลทั้งบัญชี

---

## 7. ถ้าเชื่อม DGX Spark (LocalAI-08) แล้ว BotPress ทำอะไรได้บ้าง

### 7.1 สิ่งที่ดีขึ้นทันที (ไม่ต้องเพิ่มฟีเจอร์ แค่ตั้งค่าตามหัวข้อ 6)

| ความสามารถ | เดิม (Gemma 4 บนเครื่องนี้) | เมื่อใช้ Spark | ผลต่อสำนักข่าว |
|---|---|---|---|
| Context | 32K (และ VRAM 16 GB เต็มแล้ว) | **128K และมี cache** | นักข่าวและผู้ตรวจ **อ่านหน้าแหล่งข่าวฉบับเต็มหลายลิงก์ในรอบเดียว** ผลตรวจข้อเท็จจริงจึงละเอียดขึ้น บทสนทนาและความจำยาวขึ้นก่อนถูกบีบอัด |
| งานพร้อมกัน | 2 slot | 4 stream | ผู้ตรวจ 2 คน, บก.ต้นฉบับ และนักข่าวทำงานพร้อมกันได้ งานค้างลดลง และวาง routine ให้ถี่ขึ้นได้ |
| ภาษาไทย | Gemma 4 | `openthai2.0` (โมเดลภาษาไทย) | ภาษาข่าวเป็นธรรมชาติขึ้น **(ต้องเทียบคุณภาพกับ Gemma ด้วยข่าวจริง)** |
| Vision | มี | มี (ทดสอบแล้ว) | บอทใช้ `computer_observe`/`computer_act` เพื่อเปิดเว็บข่าวจริง ดูภาพหน้าจอ และอ่านตาราง/อินโฟกราฟิกได้ |
| GPU ของเครื่องนี้ | ใช้ไปราว 15.5 GB | **ว่าง** | รัน ComfyUI, Forge หรือ HyperFrames ใน `D:\AI-ART` ได้พร้อมกับสำนักข่าว |
| ดิสก์ D: | ต้องเก็บโมเดลราว 15 GB | ไม่ต้อง | แก้ปัญหาพื้นที่ D: เหลือ 21 GB ได้ทั้งหมด |

### 7.2 งานใหม่ที่ทำได้เพราะมี context 128K (แก้ prompt หรือ routine เล็กน้อย)

1. **ตรวจข่าวซ้ำ**: ก่อนเสนอข่าว ให้นักข่าวอ่าน `stories.json` ทั้งไฟล์ (หลักร้อยเรื่องยังใส่ใน 128K ได้) ช่วยกันการเสนอข่าวซ้ำกับที่เคยลง
2. **สรุปข่าวรายวัน/รายสัปดาห์**: `บก.บห.` อ่านไฟล์ `.md` ที่เผยแพร่แล้วทั้งสัปดาห์ แล้วเขียน "สรุปข่าวไอทีประจำสัปดาห์" เป็นข่าวอีกเรื่องที่ต้องผ่านด่านอนุมัติเหมือนกัน
3. **ตรวจข้อเท็จจริงข้ามแหล่ง**: ผู้ตรวจวางเนื้อหาจากทุกแหล่งไว้ใน context เดียวแล้วเทียบตัวเลข วันที่ และคำพูดทีละข้อ
4. **แปลและเรียบเรียงข่าวต่างประเทศ**: อ่านเอกสารต้นฉบับยาว ๆ เช่น ประกาศทางการ เอกสารนโยบาย หรือ changelog แล้วเขียนเป็นข่าวไทย (เหมาะกับสาย `policy` และ `security`)
5. **ร่างโพสต์สำหรับเพจ Facebook**: ฝ่ายโซเชียลเขียนหลายแบบโดยอิงข่าวที่เคยได้ผลดี ถ้าจะโพสต์อัตโนมัติ ต้องเพิ่มเครื่องมือ MCP ที่มีด่านอนุมัติแบบเดียวกับ `publish_story`

### 7.3 ใช้หน่วยความจำ 128 GB ของ Spark ให้คุ้มขึ้น (ต้องคุยกับผู้ดูแล Spark)

ยังไม่รู้ว่าตอนนี้ Spark ใช้หน่วยความจำไปเท่าไร เพราะ `/health` ไม่ได้รายงาน

- **ใช้โมเดลต่างกันตามหน้าที่**: Rakazo ตั้งโมเดลแยกรายบอทได้ เช่น ให้ `บก.บห.` และผู้ตรวจใช้โมเดลใหญ่ที่แม่นกว่า ส่วนนักข่าวใช้โมเดลที่เร็ว (`RAKAZO_LOCAL_MODELS` ใส่ได้หลาย id คั่นด้วย `,`)
- **Embedding หรือ RAG** ของคลังข่าว สำหรับค้นข่าวเก่าเมื่อคลังใหญ่เกิน 128K
- **ฝ่ายภาพสร้างภาพจริง** จากบรีฟ (เช่น ใช้ Flux บน Spark) โดย **ต้องมีด่านอนุมัติ** และต้องให้เจ้าของตัดสินใจก่อน เพราะ README ห้ามสร้างภาพไว้
- **STT แม่นขึ้น**: ย้าย whisper จาก CPU รุ่น `medium` ไปใช้รุ่น `large` บน Spark

### 7.4 ข้อจำกัดที่ยังอยู่

- **ความเร็ว**: Spark ใช้หน่วยความจำแบบ unified ความเร็ว decode ที่วัดได้จึงอยู่ราว 25-60 token/วินาที ข่าวยาว 1 เรื่องใช้เวลาเป็นนาที ส่วน prefill ครั้งแรกเมื่อ context เต็มใช้เวลาราว 2.5 นาที
- **ใช้เครื่องร่วมกัน**: 4 stream แบ่งกับผู้ใช้อื่นทั้งเครื่อง ถ้าคนอื่นใช้หนัก cache จะหลุดและต้องรอคิว
- **เครือข่าย**: ถ้า Tailscale หรือ Spark ดับ ทั้งสำนักข่าวจะหยุด ควรเก็บโหมดสำรองไว้ (Ollama `gemma4:26b` บนเครื่องนี้)
- **คุณภาพข่าว**: context ยาวช่วยให้ตรวจละเอียดขึ้น แต่ **ไม่ได้แทนด่านอนุมัติของคน** ยังต้องอ่านข่าวก่อนกดอนุมัติเหมือนเดิม

### 7.5 ลำดับที่แนะนำ

1. ติดตั้ง BotPress และ Rakazo ตามคู่มือหลัก โดยข้ามการติดตั้ง llama-server และ Gemma ทั้งหมด
2. ตั้ง local provider ตามหัวข้อ 6.2 แล้วแก้ `RakazoClient.cs` และ `Monitor.cs` ให้รองรับ LLM ระยะไกล (ทาง C)
3. ทดสอบด้วย `tests/newsroom-live.mjs` เทียบกับ Gemma โดยวัดเวลา, จำนวน kick และคุณภาพภาษา
4. ถ้าผลดี ค่อยเพิ่มงานตามหัวข้อ 7.2 ทีละข้อ

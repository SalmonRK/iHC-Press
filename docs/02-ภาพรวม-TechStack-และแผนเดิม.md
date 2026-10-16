# BotPress (jaturapornchai/botpress): คู่มือ, Tech Stack และแผนติดตั้งที่ `D:\AI-ART`

> จัดทำ 2026-10-12 จาก deep research (ผ่านการตรวจแบบ adversarial 3 เสียง), README ของ repo ที่ commit `c3dfeda` (2026-10-04) และโค้ดใน repo ที่อ่านเอง
> สภาพเครื่องที่ใช้วางแผนคือเครื่องนี้ ณ วันที่ทำเอกสาร (ดูหัวข้อ 5.1)


> ⚠ **อัปเดต 2026-10-14:** หัวข้อ 4–5 (แผนติดตั้งเดิมที่ใช้ llama-server + Gemma บนเครื่องนี้ และ WSL แบบ mirrored) **ถูกแทนด้วยการติดตั้งจริง** ที่ใช้ OpenThai บน DGX Spark กับ WSL แบบ NAT ดู `05-สถานะการติดตั้ง.md` · วิธีใช้งานฉบับล่าสุดดู `01-คู่มือการใช้งาน.md`

---

## 0. สรุปสั้น

- **ไม่ใช่ Botpress (แพลตฟอร์มแชตบอท)** GitHub ระบุ `fork: false` repo นี้คือแอป Windows ชื่อ **BotPress — สำนักข่าวบอท** ซึ่งให้บอท AI 15 ตัวทำงานเป็นกองบรรณาธิการข่าวไอทีและ AI ภาษาไทย
- ทุกครั้งที่ `บก.บห.` จะเผยแพร่ข่าว **ต้องรอเจ้าของกดอนุมัติ** ข่าวที่ผ่านจะถูกบันทึกเป็นไฟล์ Markdown ไม่มีเว็บไซต์ และบอทไม่โพสต์โซเชียลเอง
- **รันเดี่ยวไม่ได้** แอปต้องใช้ infra ที่ไม่อยู่ใน repo ได้แก่ `D:\localai` (llama-server, Gemma 4, rakazo.sh) และ Rakazo ใน WSL
- ในโค้ดมี path เขียนตายตัวไว้ที่ `D:\botpress` และ `D:\localai` **การย้ายมาไว้ที่ `D:\AI-ART` จึงต้องใช้ junction หรือแก้โค้ด**
- **เพจ Facebook** (`profile.php?id=61574743782103`): research ยืนยันอะไรเกี่ยวกับเพจนี้ไม่ได้เลย เพราะ Facebook ต้องล็อกอิน ยังไม่รู้ว่าเพจนี้เกี่ยวกับ repo อย่างไร (ดูหัวข้อ 7)

---

## 1. BotPress ทำงานอย่างไร (พื้นฐาน)

### 1.1 แนวคิด

กองบรรณาธิการข่าวที่บอททำงานเองตามตารางทุกวัน หน้าที่ของคนมีแค่ **อ่านแล้วกดอนุมัติก่อนเผยแพร่** LLM ที่ใช้เป็นค่าเริ่มต้นคือ Gemma 4 ที่รันบนเครื่องเอง จึงไม่มีค่า API

### 1.2 ทีมบอท 15 ตัว (3 ฝ่าย)

| ฝ่าย | บอท | หน้าที่ |
|---|---|---|
| กองบรรณาธิการ (2) | `บก.บห.` | ด่านสุดท้าย เป็นตัวเดียวที่เรียก `publish_story` ได้ |
| | `หัวหน้าข่าว` | ประชุมข่าว คัดเรื่องและมอบหมายงาน หรือ kill เรื่อง ตามงานที่ค้างเกิน 3 ชั่วโมง |
| ฝ่ายข่าว (8) | นักข่าว AI / Gadget / ซอฟต์แวร์ / สตาร์ทอัพ / ไซเบอร์ / เกม / คลาวด์ / นโยบายเทค | หาข่าว เสนอข่าว และเขียนข่าวตามสายของตัวเอง |
| ฝ่ายตรวจและผลิต (5) | `ผู้ตรวจข่าว 1` (ai, gadget, software, startup, other), `ผู้ตรวจข่าว 2` (security, gaming, cloud, policy) | เปิดทุกลิงก์แหล่งข่าวแล้วตรวจข้อเท็จจริง |
| | `บก.ต้นฉบับ` | เกลาภาษาและพาดหัว (ไม่เกิน 90 ตัวอักษร) แล้วย้ายเรื่องเป็น `ready` |
| | `ฝ่ายโซเชียล` / `ฝ่ายภาพ` | เขียนร่างข้อความโซเชียล (สั้นและยาว) กับบรีฟภาพ 4 บรรทัด ไม่โพสต์จริงและไม่สร้างภาพ |

ห้องประชุมมี 3 ห้อง ได้แก่ `ห้องข่าว 1`, `ห้องข่าว 2` และ `ห้องตรวจ-ผลิต` แต่ละห้องมีสมาชิกเต็ม 6 แล้ว ซึ่งเป็นเพดานของ Rakazo

### 1.3 ขั้นตอนข่าว (state machine ที่ server บังคับ บอทข้ามขั้นไม่ได้)

```
pitch_story → pitched → assigned → drafting → factcheck → editing → ready → published
                                     ▲            │           │         │
                                     └────────────┴───────────┘         └─(ส่งกลับ + note)→ editing
ทุกสถานะที่ยังไม่จบ → killed (ต้องมี note)
```

- เข้า `factcheck` ได้เมื่อมี headline, body และ sources อย่างน้อย 1 รายการ
- เข้า `editing` ได้เมื่อมีผลตรวจ (`factcheck`) แล้ว
- เข้า `ready` ได้เมื่อมีครบทั้ง headline, body, social และ image เมื่อถึงสถานะนี้ **เนื้อหาจะถูกล็อก**
- `published` เกิดได้จาก `บก.บห.` เรียก `publish_story` (title ต้องตรงกับ headline) **และเจ้าของกดอนุมัติใน Rakazo**
- ไฟล์ข่าวที่ได้อยู่ที่ `news\<YYYY-MM-DD>\<id>.md` และมีหัวข้อ เนื้อข่าว บรีฟภาพ แหล่งอ้างอิง ข้อความโซเชียล และผลตรวจ

### 1.4 ตารางงานอัตโนมัติ (8 routine, เวลากรุงเทพ)

| เวลา | บอท | งาน |
|---|---|---|
| 07:00 | หัวหน้าข่าว | ประชุมข่าวเช้า ส่งใบงานถึงนักข่าว 8 สาย |
| 09:00 | หัวหน้าข่าว | คัดเรื่อง pitched แล้ว assign หรือ kill |
| 10:30 / 14:30 / 18:30 | ผู้ตรวจข่าว 1 | กวาดเรื่องรอตรวจ |
| 10:45 / 14:45 / 18:45 | ผู้ตรวจข่าว 2 | กวาดเรื่องรอตรวจ |
| 11:30 / 15:30 / 19:30 | บก.ต้นฉบับ | กวาดเรื่องรอเกลา |
| 12:00 | บก.บห. | ตรวจเรื่อง ready แล้วขอเผยแพร่ |
| 13:00 | หัวหน้าข่าว | รอบข่าวบ่าย |
| 17:30 | บก.บห. | เผยแพร่รอบเย็นและสรุปข่าวทั้งวัน |

ระบบออกแบบเป็นแบบ "ดึงงาน" (pull) เพราะ Rakazo มีข้อจำกัด เช่น การส่งงานต่อกันระหว่างบอทหยุดเมื่อครบ 6 hop และห้องหนึ่งมีได้ไม่เกิน 6 บอท เวลาของ routine ถูกวางให้เหลื่อมกันเพราะ LLM มีแค่ 2 slot

---

## 2. คู่มือการใช้งานประจำวัน

1. **เปิด `BotPress.exe` ก่อน 07:00** แอปไม่เปิดเองตอนเปิดเครื่อง เมื่อเปิดแล้วจะเริ่ม LLM และ Rakazo ให้เอง (autostart)
2. **หน้าแรก** มีแถบข่าวด่วน การ์ดสรุปจำนวนเรื่องในแต่ละสถานะ (ช่อง "รอ บก.บห." จะเป็นสีเตือนเมื่อมีเรื่องรอ) และการ์ดบอทแยกตามฝ่าย
3. **โต๊ะข่าว** เป็นบอร์ด 8 คอลัมน์ที่อ่านอย่างเดียว ลากย้ายเรื่องไม่ได้ กดการ์ดเพื่ออ่านข่าวฉบับเต็ม ปุ่ม "เปิดโฟลเดอร์ข่าว" เปิดโฟลเดอร์ข่าวใน Explorer
4. **ศูนย์งาน** มี 6 แท็บ: รอคุณ · กิจกรรม · งานประจำ · ความจำ · ผลงาน · ค่าใช้จ่าย
5. **วิธีอนุมัติข่าว**
   1. แท็บ "รอคุณ" → จำพาดหัวไว้
   2. กด "ดูข่าวที่รอเผยแพร่" แล้วเปิดเรื่องนั้นในคอลัมน์ "รอ บก.บห." อ่านเนื้อข่าว แหล่งอ้างอิง และผลตรวจ
   3. กลับมากด **"อนุญาตครั้งนี้"** หรือ **"ปฏิเสธ"** ถ้าปฏิเสธ ให้พิมพ์บอก `บก.บห.` ว่าต้องแก้อะไร (ปุ่ม "อนุญาตเสมอ" ถูกซ่อนไว้โดยตั้งใจ)
   4. ถ้ามีการ์ดอนุมัติเรื่องเดียวกันซ้ำ 2 ใบ ให้อนุมัติใบแรกและ**ปฏิเสธใบที่สอง** ห้ามปล่อยค้างไว้
6. **Monitor** แสดง VRAM, GPU, CPU และ RAM มีการ์ด LLM (t/s และ slot) การ์ด Rakazo (container) และตัวดู log watchdog จะรีสตาร์ท llama-server ให้เองถ้าค้างเกิน 3 นาที
7. **แชทและห้อง** เรียกบอทในห้องด้วย `@ชื่อ` หรือ `@everyone` ดูจอคอมพิวเตอร์ของบอทได้ (noVNC) แนบไฟล์ได้ และพูดแทนพิมพ์ได้ด้วยปุ่ม 🎤 (faster-whisper)
8. **ปุ่มโหมด LLM** (ซ้ายล่าง): 🖥 Local (Gemma 4) หรือ 🔀 BCAiRouter (ต้องมี `D:\bcproxy` รันอยู่)
9. **การปิดแอป** กดปิดหน้าต่างคือออกจากแอป แต่ LLM และ Rakazo ยังทำงานต่อ สิ่งที่หยุดคือ watchdog, revive และการแจ้งเตือน

---

## 3. Tech Stack (สำหรับนักพัฒนา)

```
Windows
  dist\BotPress.exe  ── .NET 10 WPF + WebView2 (net10.0-windows, self-contained single file)
   ├─ WebView2 → https://botpress.example/ (virtual host → โฟลเดอร์ ui\, HTML/JS/CSS ล้วน ไม่มี framework)
   ├─ RakazoClient.cs → POST http://127.0.0.1:5173/rpc/<path>  (oRPC, allow-list, บัญชี owner@botpress.local)
   ├─ Monitor.cs      → nvidia-smi, wsl -l -v, llama-server :8080 (/health /slots /metrics), Rakazo :3110/health, watchdog
   ├─ Newsdesk.cs     → อ่าน D:\botpress\news\stories.json
   └─ Speech.cs       → python stt.py (faster-whisper medium, CPU int8)
  llama-server.exe :8080  (llama.cpp, Gemma 4 26B-A4B IQ4_XS + mmproj, -np 2)   ← D:\localai\serve-th.bat

WSL2 Ubuntu-24.04 (user rakazo, systemd, mirrored networking)
  docker engine
   ├─ Rakazo v0.1.6 (~/rakazo, docker compose): web :5173 · api :3110 · worker · postgres · supervisor
   ├─ คอมพิวเตอร์ของบอท (container ละตัว, computerMode "dedicated")
   └─ botpress-newsdesk: node /app/server.mjs (MCP Streamable HTTP, ไม่มี dependency)
        อยู่ใน network namespace ของ rakazo-worker-1 → บอทเรียกที่ http://localhost:7790/mcp (Bearer news/.token)
  socat: 172.17.0.1:18080 → Windows :8080 (llama-bridge.service), 172.17.0.1:18399 → :3399 (bcai-bridge.service)
```

| ชั้น | เทคโนโลยี | ไฟล์หลัก |
|---|---|---|
| Desktop host | C# .NET 10, WPF, WebView2 1.0.4258.31, `TreatWarningsAsErrors` | `Program.cs`, `MainWindow.xaml(.cs)`, `RakazoClient.cs`, `Monitor.cs`, `Newsdesk.cs`, `Speech.cs` |
| UI | Vanilla JS/CSS ใน WebView2, เรียก host ผ่าน `App.call(op,args)` | `ui/app.js`, `chat.js`, `work.js`, `monitor.js`, `newsdesk.js`, `theme.js` |
| Agent platform | **Rakazo v0.1.6** (github.com/elie222/rakazo, image `ghcr.io/elie222/rakazo/app:v0.1.6`) | อยู่นอก repo |
| เครื่องมือของบอท | MCP server เขียนด้วย Node (ไม่มี npm dependency) | `newsdesk/server.mjs` (`--selftest` 52 checks) |
| Provisioning | Node script ที่สั่งงานแอปผ่าน CDP (devtools port 9224) | `seed-bots.mjs` (`--dry`, `--rewrite`) |
| LLM | llama.cpp `llama-server` + Gemma 4 (OpenAI-compatible) | อยู่นอก repo (`D:\localai`) |
| STT | Python, faster-whisper | `stt.py` |
| ตัวคุมใน WSL | Bash | `botpress.sh` → เรียก `rakazo.sh` |
| Tests | Node + CDP client ที่เขียนเอง | `tests/e2e.mjs`, `tests/newsroom-live.mjs` |

### 3.1 จุดที่ต้องแก้เมื่อจะต่อยอด

| ต้องการ | แก้ที่ |
|---|---|
| เปลี่ยน prompt หรือ routine | `seed-bots.mjs` (`BOTS`, `TEAM`, `NEWSROOM`, `COMMON`, `ROUTINES`) → `node seed-bots.mjs --dry` → `--rewrite` (instructions ต้องไม่เกิน 20,000 ตัวอักษร) |
| เพิ่มสายข่าวหรือบอท | `newsdesk/server.mjs` (`BEATS` และ selftest), `seed-bots.mjs` (`BEATS`, `CHECK_1/2`, `assert 15`, ห้องใหม่), `ui/newsdesk.js` และ `ui/work.js` (`BEATS`), `ui/app.js` (`PORTRAITS`), `tests/newsroom-live.mjs` |
| เครื่องมือโต๊ะข่าว | `newsdesk/server.mjs` → `--selftest` → `docker restart botpress-newsdesk` → seed ซ้ำ (**ห้ามลดด่านของ `publish_story`**) |
| แก้ UI อย่างเดียว | ตั้ง `BOTPRESS_UI_DIR=<repo>\ui` แล้วเปิดแอปใหม่ ไม่ต้อง publish |
| แก้ C# | ปิดแอป → `dotnet publish ...` → `BotPress.exe --selftest` |

### 3.2 งานที่ README แนะนำให้ทำต่อ (ยังไม่มีใครทำ)

1. ให้โต๊ะข่าวตรวจบทบาทผู้เรียก ตอนนี้ `by` เป็นข้อความอิสระ นักข่าวจึงเขียนผลตรวจของเรื่องตัวเองได้
2. จำกัดรอบตีกลับ `factcheck → drafting` ไม่ให้เกิน 2 รอบ
3. ให้ Monitor แสดงสถานะ `NEWSDESK`
4. กันการ์ดอนุมัติซ้ำ
5. โพสต์โซเชียลจริงหรือสร้างภาพจริง **โดยมีด่านอนุมัติแบบเดียวกับ `publish_story`** (ตรงนี้เป็นจุดที่ต่อกับเพจ Facebook ได้)
6. ทำให้ path ตั้งค่าได้ (ตรงกับความต้องการติดตั้งที่ `D:\AI-ART`)
7. เปิดแอปเองตอน logon

### 3.3 ข้อมูลอ้างอิง: Botpress ตัวจริง (ไม่เกี่ยวกับ repo นี้)

research รวบรวมข้อมูล Botpress ตัวจริงมาด้วย ใช้เป็นทางเลือกได้เท่านั้น เพราะ repo นี้ไม่ได้ใช้ Botpress เลย

- Botpress เลิกขายและเลิกให้ดาวน์โหลด **v12 และทุกเวอร์ชัน self-hosted แล้ว** งานใหม่ให้ใช้ Botpress Cloud (ข้อมูลระดับความเชื่อมั่นสูง, 3-0)
- ถ้าจะต่อแชตบอทเข้า **Facebook Messenger** หรือ LINE แบบสำเร็จรูป ให้ใช้ Botpress Cloud integration ซึ่งต้องมี Meta App, Page ID, Access Token และ Verify Token และ webhook จะอยู่ที่ `webhook.botpress.cloud`

---

## 4. ข้อจำกัดเมื่อติดตั้งที่ `D:\AI-ART`

path ที่เขียนตายตัวในโค้ด:

| path | ไฟล์ |
|---|---|
| `D:\botpress` | `Newsdesk.cs:12`, `Monitor.cs:28` (`/mnt/d/botpress/botpress.sh`), `botpress.sh` (mount ของ newsdesk), `seed-bots.mjs:10`, `tests/newsroom-live.mjs:8,68` |
| `D:\localai` | `Monitor.cs:21-24` (`Root`, `LlmBat`, `LlmLog`), `Monitor.cs:81` (`llama-server.exe` path), `botpress.sh:33` (`rakazo.sh`), `tools/botteam-pause.mjs:8` |
| distro `Ubuntu-24.04` | `Monitor.cs:25` (`DistroName`), `tools/botteam-pause.mjs` |
| model id `gemma4`, bridge `172.17.0.1:18080` | `RakazoClient.cs` (`ConnectModel`, `SetLlmMode`) |

ของที่ต้องสร้างเองเพราะไม่อยู่ใน repo และ README ไม่มีขั้นติดตั้งจากศูนย์:

- `serve-th.bat`
- `llm-api-key.txt` (ต้องมีบรรทัดขึ้นต้นด้วย `gemma-` และ `rakazo-`)
- **`rakazo.sh`** ต้องรับคำสั่ง `status|start|revive|stop|logs|backup` และตอน `status` ต้องพิมพ์บรรทัด `KEEPALIVE 0|1`, `C <json>` (compose), `B <json>` (คอมพิวเตอร์ของบอท, label `rakazo.managed=true`) และ `S <json>` (docker stats) ตามที่ `Monitor.ParseRakazo` อ่าน
- ค่าใน `.env` ของ Rakazo
- hotfix ของ Rakazo (RUNBOOK §4 ไม่เปิดเผย)
- image ภาษาไทย `botteam/computer:v0.1.6-th`
- systemd socat bridge

---

## 5. แผนติดตั้งที่ `D:\AI-ART`

### 5.1 สภาพเครื่องตอนนี้ (ตรวจเมื่อ 2026-10-12)

| รายการ | สถานะ | ผลต่อแผน |
|---|---|---|
| GPU | RTX 5080 Laptop **16 GB**, driver 610.78 | ✅ ใกล้เคียงเครื่องต้นทาง (5060 Ti 16 GB) แต่ Gemma กิน VRAM ราว 15.5 GB **รันพร้อม ComfyUI หรือ Forge ใน `D:\AI-ART` ไม่ได้** |
| CPU / RAM | 24 threads / 63 GB | ✅ |
| `D:` ว่าง | **ประมาณ 21 GB** | ⚠️ ตึงมาก ไฟล์โมเดล GGUF อย่างเดียวก็ใช้ไปมากแล้ว ส่วน C: ว่างประมาณ 64 GB |
| `D:\AI-ART` | มีโปรเจกต์ AI อื่นอยู่แล้ว (ComfyUI, Forge, Ollama, models ฯลฯ) | ติดตั้งใต้โฟลเดอร์ย่อยแยกต่างหาก |
| `D:\botpress`, `D:\localai` | ไม่มี | ✅ สร้าง junction ได้โดยไม่ทับของเดิม |
| WSL | มี distro `Ubuntu` และ `docker-desktop` แต่ **ไม่มี `Ubuntu-24.04`** และไม่มี `.wslconfig` | ต้องติดตั้ง distro ใหม่ชื่อ `Ubuntu-24.04` |
| Docker | Docker Desktop 29.4.3 | ⚠️ ดูขั้น 3 (socat ต้องใช้ docker0 ใน distro) |
| .NET SDK | **ไม่มี** | ต้องติดตั้ง .NET 10 SDK |
| Node | v24.15.0 | ✅ |
| Python | 3.13.12 | ✅ ใช้กับ faster-whisper ได้ (ไม่บังคับ) |
| WebView2 Runtime | 154.0.4258.62 | ✅ |
| Ollama | 0.40.3 มี `gemma4:26b` (18 GB) อยู่แล้ว | ใช้เป็นทางเลือก LLM ได้ (ขั้น 2 ทาง B) |
| Rakazo upstream | github.com/elie222/rakazo มี tag `v0.1.6` (และ `v0.2.0`) | ✅ ทำทาง "ติดตั้งใหม่" ได้ ให้ pin ไว้ที่ v0.1.6 |

### 5.2 โครงสร้างโฟลเดอร์ที่แนะนำ

```
D:\AI-ART\BotPress\
├─ app\        ← git clone jaturapornchai/botpress   (junction: D:\botpress → ที่นี่)
└─ localai\    ← infra ที่สร้างเอง                       (junction: D:\localai  → ที่นี่)
   ├─ serve-th.bat
   ├─ llm-api-key.txt          (ความลับ)
   ├─ llamacpp\bin\llama-server.exe
   ├─ models\                  (Gemma GGUF + mmproj)
   ├─ logs\
   ├─ botadmin\rakazo.sh       (เขียนเองตามสัญญาในหัวข้อ 4)
   └─ backups\
```

**เหตุผลที่เลือก junction:** ไฟล์จริงอยู่ใต้ `D:\AI-ART` แต่โค้ดยังเห็น path เดิม จึงไม่ต้องแก้โค้ดในเฟสแรก เมื่อระบบรันได้แล้วค่อยทำเฟส 3 คือแก้ให้ path ตั้งค่าได้

### 5.3 ขั้นตอน

**ขั้น 0: เตรียมพื้นที่และเครื่องมือ (PowerShell)**

```powershell
winget install Microsoft.DotNet.SDK.10        # แล้วตรวจด้วย dotnet --list-sdks ว่าขึ้น 10.x
New-Item -ItemType Directory D:\AI-ART\BotPress\localai\logs, D:\AI-ART\BotPress\localai\models -Force
git clone https://github.com/jaturapornchai/botpress D:\AI-ART\BotPress\app
cmd /c mklink /J D:\botpress D:\AI-ART\BotPress\app
cmd /c mklink /J D:\localai  D:\AI-ART\BotPress\localai
```

- เคลียร์พื้นที่ `D:` ให้เหลือว่างอย่างน้อยประมาณ 40 GB ก่อนทำขั้น 2 หรือย้ายโฟลเดอร์ `models` ไปไว้ที่ไดรฟ์อื่น

**ขั้น 1: WSL `Ubuntu-24.04`**

```powershell
wsl --install -d Ubuntu-24.04      # ตอนสร้าง user ให้ตั้งชื่อ rakazo
```

- ในไฟล์ `/etc/wsl.conf` ใส่ `[boot] systemd=true` และ `[user] default=rakazo`
- ในไฟล์ `%UserProfile%\.wslconfig` ใส่ `[wsl2]` แล้วตามด้วย `networkingMode=mirrored` และ `vmIdleTimeout=-1`
- ⚠️ **ผลข้างเคียง:** `.wslconfig` มีผลกับ distro WSL ทุกตัว รวมถึง `Ubuntu` เดิมและ Docker Desktop ให้ตรวจว่างานเดิมยังใช้ได้หลังเปิด mirrored
- จากนั้นสั่ง `wsl --shutdown` แล้วตรวจด้วย `wsl -d Ubuntu-24.04 -- sh -c 'whoami; id -nG'`

**ขั้น 2: LLM (เลือก 1 ทาง)**

- **ทาง A (แนะนำ เหมือนต้นฉบับ Monitor และ watchdog ใช้งานได้ครบ)**
  1. ดาวน์โหลด llama.cpp รุ่น Windows CUDA ไปไว้ที่ `localai\llamacpp\bin\`
  2. ดาวน์โหลด `gemma-4-26B-A4B-it-UD-IQ4_XS.gguf` และ `mmproj-gemma-4-26B-A4B-it-F16.gguf` ไปไว้ที่ `localai\models\` ตรวจขนาดไฟล์บน Hugging Face ก่อน เพราะพื้นที่ D: ตึง
  3. เขียน `serve-th.bat` ให้เรียก `llama-server.exe -m ... --mmproj ... --host 127.0.0.1 --port 8080 -np 2 -c <ctx> --api-key-file D:\localai\llm-api-key.txt --metrics --slots` และตั้ง alias ของโมเดลเป็น `gemma4`
  4. flag ในข้อ 3 อนุมานจากโค้ด ต้องตรวจกับ llama.cpp รุ่นที่ดาวน์โหลดมาอีกครั้ง
- **ทาง B (ประหยัดดิสก์ ใช้ Ollama ที่มี `gemma4:26b` อยู่แล้ว)**
  1. สั่ง `ollama cp gemma4:26b gemma4` เพื่อให้ model id ตรงกับในโค้ด
  2. ทำ bridge ไปที่ `:11434` แทน `:8080`
  3. ข้อเสีย:
     - การ์ด LLM ใน Monitor, watchdog และ autostart จะไม่ทำงาน เพราะผูกกับ `llama-server.exe` และ `/slots` `/metrics`
     - ตัวโมเดลมีขนาด 18 GB ใหญ่กว่า VRAM 16 GB จึงช้ากว่าทาง A
     - ต้องแก้ `Monitor.cs` และ `RakazoClient.cs` เพิ่ม
- ไม่ว่าเลือกทางไหน ต้องสร้าง `llm-api-key.txt` ที่มีบรรทัด `gemma-...` และ `rakazo-...` (ตั้งค่าเองได้)

**ขั้น 3: Docker และ socat ใน `Ubuntu-24.04`**

- ติดตั้ง **Docker Engine ใน distro เอง** แล้วเพิ่ม user `rakazo` เข้า group `docker`
- **อย่าเปิด** Docker Desktop WSL integration ให้ distro นี้ เพราะ socat bridge ต้องฟังที่ `docker0` (172.17.0.1) ใน distro นี้เอง
- ติดตั้ง `socat` แล้วสร้าง systemd service `llama-bridge.service` ให้รัน `socat TCP-LISTEN:18080,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:8080` (หรือ `:11434` ถ้าเลือกทาง B)
- ถ้ามี BCAiRouter ให้สร้าง `bcai-bridge.service` ที่ส่งต่อ `:18399 → :3399` ด้วย

**ขั้น 4: Rakazo v0.1.6**

```bash
git clone --branch v0.1.6 https://github.com/elie222/rakazo ~/rakazo
docker pull ghcr.io/elie222/rakazo/app:v0.1.6
```

- ตั้งค่าตามเอกสารของ Rakazo แล้วเพิ่มค่าเหล่านี้ใน `~/rakazo/.env`
  - `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1`
  - `RAKAZO_OPENAI_COMPATIBLE_VISION_MODELS=gemma4,bcai/tools`
  - `RAKAZO_OPENAI_COMPATIBLE_CONTEXT_WINDOWS=gemma4=<ctx เดียวกับ -c>`
- ⚠️ ยังไม่รู้ว่า hotfix ใน RUNBOOK §4 ของผู้เขียนคืออะไร ถ้าเจอปัญหาตอนรัน อาจต้องติดต่อผู้เขียน
- ใช้ image computer ตัวมาตรฐานของ Rakazo แทน `botteam/computer:v0.1.6-th` ไปก่อน

**ขั้น 5: เขียน `localai\botadmin\rakazo.sh`**

- ห่อ `docker compose` ของ `~/rakazo` และรองรับคำสั่ง `start / stop / status / revive / logs <svc> / backup`
- ตอน `status` ต้องพิมพ์บรรทัด `KEEPALIVE`, `C`, `B` และ `S` ตามสัญญาในหัวข้อ 4
- `stop` **ห้ามใช้** `down -v` เพราะจะลบฐานข้อมูล
- `backup` ให้ dump postgres ไปไว้ที่ `D:\localai\backups\`
- บันทึกไฟล์เป็น line ending แบบ LF

**ขั้น 6: Build และ selftest**

```bash
cd /d/botpress
node newsdesk/server.mjs --selftest            # ต้องได้ selftest OK (52 checks)
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o dist
./dist/BotPress.exe --selftest; echo "exit=$?"  # ต้องได้ SELFTEST PASS
```

**ขั้น 7: Seed ทีมและตรวจระบบ**

- เครื่องนี้ไม่มี BotTeam จึง**ข้ามขั้น `botteam-pause`**

```bash
./dist/BotPress.exe --devtools-port 9224 &     # รอจน Monitor ขึ้นว่า LLM และ Rakazo "พร้อม"
node seed-bots.mjs --dry && node seed-bots.mjs # ต้องได้ seededBots 15, 3 ห้อง (6) และ routinesCreated 8
MSYS_NO_PATHCONV=1 wsl -d Ubuntu-24.04 -- bash /mnt/d/botpress/botpress.sh status | tail -1   # NEWSDESK running
```

- ⚠️ ต้องทดสอบด้วยว่า bind mount ของ docker ที่ `/mnt/d/botpress/...` ตาม junction ได้ถูกต้องหรือไม่ ให้ดูว่า `news/.token` ไปโผล่ที่ `D:\AI-ART\BotPress\app\news` จริง
- ถ้า mount ตาม junction ไม่ได้ ให้ข้ามไปทำเฟส 3 ทันที

**ขั้น 8: ใช้งานจริง**

- ปิดตัวที่เปิดด้วย devtools แล้วเปิด `dist\BotPress.exe` แบบไม่ใส่ flag
- ถ้าอยากให้แอปเปิดเองก่อน 07:00 ให้ตั้ง Task Scheduler

**สำรองข้อมูลทุกครั้ง** สิ่งที่ต้องสำรอง:

- `D:\AI-ART\BotPress\app\news\`
- `%LOCALAPPDATA%\BotPress\owner.json` ถ้าไฟล์นี้หาย แอปจะล็อกอิน Rakazo ไม่ได้อีกเลย
- ผลของ `botpress.sh backup`

### 5.4 เฟส 3: แก้ให้ย้าย path ได้ (งานพัฒนาแรกที่แนะนำ)

- เพิ่มการอ่าน env/config เช่น `BOTPRESS_HOME`, `BOTPRESS_INFRA` และ `BOTPRESS_DISTRO` (ค่าเริ่มต้นยังเป็นค่าเดิม) ในไฟล์ต่อไปนี้
  - `Monitor.cs` (`Root`, `RakazoSh`, `DistroName`, `LlmExe`)
  - `Newsdesk.cs` (`NewsDir`)
  - `botpress.sh` (`/mnt/d/botpress`, `/mnt/d/localai`)
  - `seed-bots.mjs` และ `tests/newsroom-live.mjs`
- ถ้าเลือกทาง B ในขั้น 2 ให้แยก `LlmUrl`, model id และ bridge port ออกเป็นค่าตั้งได้ด้วย
- ข้อควรระวัง: `Monitor.cs` ประกาศค่าเหล่านี้เป็น `const` ซึ่งต้องเปลี่ยนเป็น `static readonly` และ `RakazoClient.cs` อ้างถึง `Monitor.Root`
- เมื่อแก้เสร็จแล้วถอด junction ออกได้

### 5.5 ความเสี่ยงหลัก

| ความเสี่ยง | ผลกระทบ | วิธีลด |
|---|---|---|
| hotfix และ RUNBOOK ของผู้เขียนไม่เปิดเผย | Rakazo อาจทำงานไม่ครบ เช่น เรื่อง retry หรือ network ของคอมพิวเตอร์บอท | เริ่มด้วยการทดสอบ e2e ก่อน แล้วติดต่อผู้เขียน |
| VRAM ชนกับ ComfyUI, Forge หรือ Ollama | LLM โหลดไม่ขึ้นหรือช้า | ห้ามรันพร้อมกัน และปิด Ollama ระหว่างใช้ทาง A |
| พื้นที่ D: ว่างประมาณ 21 GB | ติดตั้งไม่จบ | เคลียร์พื้นที่หรือเลือกทาง B |
| `.wslconfig` แบบ mirrored กระทบ distro เดิมและ Docker Desktop | งานเดิมอาจเสีย | ทดสอบงานเดิมหลังเปลี่ยน |
| คุณภาพข่าวจาก Gemma | ข่าวอ้างแหล่งที่ไม่น่าเชื่อถือ | อ่านข่าวก่อนกดอนุมัติทุกครั้ง (README เน้นเรื่องนี้) |

---

## 6. ความลับที่ห้าม commit หรือแสดงค่า

`news/.token`, `%LOCALAPPDATA%\BotPress\owner.json`, `D:\localai\*-api-key.txt`, `~/rakazo/.env` และ tar ที่ได้จาก `wsl --export` ทั้งหมดให้อ้างถึงด้วย path เท่านั้น

---

## 7. คำถามที่ยังเปิดอยู่

1. **เพจ Facebook `61574743782103`** ใช้ทำอะไร เป็นเพจที่โพสต์ข่าวจาก BotPress (โพสต์ด้วยมือ) หรือไม่ ถ้าต้องการโพสต์อัตโนมัติ ต้องเพิ่มเครื่องมือ MCP เช่น `post_facebook` ที่ใช้ Graph API และ Page Access Token โดยตั้ง approval rule ให้แบบเดียวกับ `publish_story`
2. hotfix ของ Rakazo, flag ใน `serve-th.bat` และ image `computer:v0.1.6-th` ต้องถามผู้เขียน (ลุงจืด / jaturapornchai)
3. ถ้าจะรันบน backend อื่นที่ไม่มี NVIDIA (เช่น BCAiRouter หรือ cloud LLM) ต้องแก้ `--selftest` ซึ่งตอนนี้บังคับให้มี GPU

## แหล่งอ้างอิง

- https://github.com/jaturapornchai/botpress (README และโค้ด, commit `c3dfeda`): แหล่งหลักของข้อมูลทุกข้อเกี่ยวกับแอป
- https://github.com/elie222/rakazo (tag v0.1.6)
- https://botpress.com/docs/studio/guides/advanced/v12, https://github.com/botpress/v12/ (การยุติ self-hosted)
- https://botpress.com/docs/integrations/integration-guides/messenger/ (Messenger บน Botpress Cloud)

# iHC-Press Runbook: การดูแลระบบและแก้เหตุขัดข้อง

> อัปเดต 2026-10-16 · สำหรับคนที่ดูแลเครื่องนี้ (Windows + WSL `Ubuntu-24.04`) · ฟีเจอร์ทั้งหมดดู [10](10-ฟีเจอร์ทั้งหมด.md) · สูตรใช้งานดู [12](12-Cookbook-สูตรใช้งาน.md)

## 0. แผนผังและตำแหน่งสำคัญ

```
Windows (เครื่องนี้)
  iHC-Press.bat ─▶ tools\Start-BotPress.ps1 ─▶ app\BotPress.exe (WebView2, ชื่อหน้าต่าง iHC-Press)
       │                                           │ rpc :5174 / health :3110 (ย้ายได้ถ้าชน)
       ▼                                           ▼
  WSL Ubuntu-24.04 · ~/rakazo (docker compose: postgres, supervisor, web, worker, api)
       └─ botpress-newsdesk (MCP :7790 ใน namespace ของ rakazo-worker-1, /news = D:\AI-ART\BotPress\data\news)
       │
       ▼ local provider (ตาม llm.json → ~/rakazo/.env)
  LocalAI-07  100.125.52.66:11434  Ollama · qwen3.6:35b-a3b · ctx 64K   ← ใช้อยู่
  LocalAI-08  100.97.194.95:8001   tensorfold · OpenThai 2.0 · ctx 128K   ← ออฟไลน์ตั้งแต่ 10-14
```

| อะไร | ที่ไหน |
|---|---|
| เปิดโปรแกรม | `D:\AI-ART\BotPress\iHC-Press.bat` (`dev` = devtools 9224) · `BotPress.bat` ใช้แทนกันได้ |
| launcher | `D:\AI-ART\BotPress\tools\Start-BotPress.ps1` (`-Dev`, `-NoPopup`, `-WaitPid <pid>`) |
| โค้ด (git) | `D:\SalmonRK\BotPress\iHC-Press` · branch `ihc-rename` · ไม่มีข้อมูลข่าวหรือ build ที่ใช้งานจริงอยู่ในนี้ |
| ตัวแอปที่ติดตั้ง | `D:\AI-ART\BotPress\app` = ผล `dotnet publish` (exe, `ui\`, `newsdesk\`, `botpress.sh`, `tools\yt-digest.mjs`) |
| ที่อยู่ทั้งหมด | `%LOCALAPPDATA%\BotPress\paths.json` (`app`, `news`, `infra`, `launcher`) · launcher สร้างให้ถ้ายังไม่มี · ไม่มีไฟล์ = โครงเดิม `D:\botpress\news`, `D:\localai` |
| infra | `D:\AI-ART\BotPress\localai` · `botadmin\rakazo.sh`, `llm-profiles\`, `backups\`, `logs\` |
| ค่า LLM ที่ใช้อยู่ | `%LOCALAPPDATA%\BotPress\llm.json` (สำรองอัตโนมัติ `llm.json.bak` ตอนสลับในแอป) |
| ความลับ (**ห้าม commit / ห้ามแปะในแชท**) | `%LOCALAPPDATA%\BotPress\owner.json`, `news\.token`, `~/rakazo/.env`, `*-api-key.txt`, `backups\secrets-*` |
| ข้อมูลข่าว | `D:\AI-ART\BotPress\data\news\` (`stories.json`, `sources.json`, `<วันที่>\*.md`, `youtube\`) |
| log | `D:\AI-ART\BotPress\localai\logs\launcher.log`, `newsroom-live-*.log` |

คำสั่งควบคุมใน WSL ใช้จาก PowerShell โดยประกาศ `bp` ครั้งเดียวต่อหน้าต่าง (บอกที่อยู่ข้อมูลข่าวและ infra ให้ `botpress.sh`):

```powershell
function bp { wsl -d Ubuntu-24.04 -- env BP_NEWS=/mnt/d/AI-ART/BotPress/data/news BP_INFRA=/mnt/d/AI-ART/BotPress/localai bash /mnt/d/AI-ART/BotPress/app/botpress.sh @args }
bp status     # Rakazo + NEWSDESK running
bp start|revive|stop
bp logs worker # 200 บรรทัดล่าสุด (api, web, worker, supervisor, postgres)
bp backup     # pg_dump + appdata + .env → D:\AI-ART\BotPress\localai\backups\rakazo-<เวลา>
bp newsdesk   # สร้าง container โต๊ะข่าวใหม่ถ้าหลุด
```

## 1. งานประจำวัน

### 1.1 เปิดระบบ (ก่อน 07:00)

1. ดับเบิลคลิก `D:\AI-ART\BotPress\iHC-Press.bat`
2. launcher จะทำตามลำดับ: ตรวจ port → ย้ายถ้าชน (เด้งแจ้งเตือน) → เขียน `.env` ตาม llm.json → เริ่ม WSL/Rakazo/โต๊ะข่าว → ตรวจ LLM → เปิดแอป
3. ดูหน้าต่าง launcher: ต้องเห็น `LLM พร้อม: Qwen3.6 35B-A3B (Ollama / LocalAI-07) · Ollama x.y.z`
4. ในแอปเปิด **Monitor**: การ์ด LLM = "พร้อม" และ Rakazo = "พร้อม"
5. เปิดแอปทิ้งไว้ทั้งวัน (คิว YouTube ของบอทและ routine ต้องใช้)

⚠ อย่าเปิด `app\BotPress.exe` ตรง ๆ เพราะ port อาจไม่ตรงกับ Rakazo และ `.env` จะไม่ถูกอัปเดต

### 1.2 ระหว่างวัน

| เวลา | ทำอะไร |
|---|---|
| หลัง 12:00 และ 17:30 | ศูนย์งาน → **รอคุณ** → อ่านเนื้อข่าว แหล่งอ้างอิง และผลตรวจ → อนุญาต / ปฏิเสธพร้อมเหตุผล |
| เมื่อเห็นการ์ดสีอำพัน (ค้างเกิน 3 ชม.) | ดู [§3.5](#35-เรื่องข่าวค้าง) |
| เมื่อมีคลิปน่าสนใจ | ตั้งค่า → YouTube → วางลิงก์ ([12](12-Cookbook-สูตรใช้งาน.md) สูตร 4) |

### 1.3 ปิดระบบ

- ปิดหน้าต่าง = ออกจากแอปเท่านั้น Rakazo และ routine ใน WSL ยังทำงานต่อ
- หยุดทั้งหมดจริง: Monitor → "หยุด" Rakazo หรือ `wsl --terminate Ubuntu-24.04`
- หยุดงานไป LLM ชั่วคราวแต่ไม่ปิดระบบ: ศูนย์งาน → งานประจำ → ปิด routine

## 2. ตรวจสุขภาพระบบ (Health check)

```powershell
# LLM ที่ใช้อยู่ (Ollama LocalAI-07)
curl.exe -s http://100.125.52.66:11434/api/version
curl.exe -s http://100.125.52.66:11434/api/ps          # โมเดลที่โหลดใน VRAM (ว่าง = ยังไม่โหลด / ปลดแล้ว)
# LLM สำรอง (DGX LocalAI-08)
curl.exe -s -m 4 http://100.97.194.95:8001/health      # busy:false, requests_running:0
tailscale status | findstr localaipc                   # ดูว่าเครื่อง online ไหม
# Rakazo + โต๊ะข่าว
bp status
# selftest
D:\AI-ART\BotPress\app\BotPress.exe --selftest               # ต้องได้ PASS (ต้องมี NVIDIA GPU)
cd D:\AI-ART\BotPress\data\newsdesk; node server.mjs --selftest    # 54/54
```

ในแอป: เมนู **ตั้งค่า → สมอง AI** แสดงสถานะทุกโปรไฟล์ในหน้าเดียว · **ตั้งค่า → YouTube** แสดงเครื่องมือที่ติดตั้งแล้ว

## 3. แก้เหตุขัดข้อง (Incident playbooks)

### 3.1 launcher แจ้ง "LLM ไม่ตอบ" หรือบอทล้มด้วย "Connection error."

1. ตั้งค่า → สมอง AI ดูว่าการ์ดที่ "กำลังใช้" ขึ้นเหตุผลว่าอะไร
2. ถ้าเป็น LocalAI-07: ตรวจ `curl.exe -s http://100.125.52.66:11434/api/version`
   - ไม่ตอบ → เครื่องปิดหรือ Tailscale หลุด ติดต่อเจ้าของเครื่อง
   - ตอบแต่บอทยังล้ม → ดู `/api/tags` ว่ายังมี `qwen3.6:35b-a3b`
3. ถ้าต้องใช้ต่อทันที: สลับไปโปรไฟล์ที่ "พร้อม" ([12](12-Cookbook-สูตรใช้งาน.md) สูตร 1)
4. คำขอแรกหลังว่าง ~30 นาทีช้า 20–30 วินาทีเป็นปกติ (Ollama โหลดโมเดลใหม่)

### 3.2 DGX (LocalAI-08) กลับมาแต่ OpenThai ใช้ไม่ได้

- tensorfold บน :8001 **ไม่เปิดเองหลัง reboot** (Ollama :11434 บน DGX เปิดเอง)
- ให้ผู้ดูแล DGX เปิด tensorfold ใหม่ แล้วตรวจ `curl.exe http://100.97.194.95:8001/health`
- DGX เป็นเครื่องใช้ร่วม **ถามก่อนส่งงานหนักหรือรันรอบข่าวยาว**
- จากนั้นสลับโปรไฟล์ `openthai-localai08` ในแอป

### 3.3 launcher เด้งว่าย้าย port

ปกติ แปลว่ามีโปรแกรมอื่นใช้ port เดิม (ตอนนี้ Vite ใช้ 5173 จึงย้ายเป็น 5174) ใช้ต่อได้เลย ดูรายละเอียดใน `launcher.log`

### 3.4 บอทไม่เห็นเครื่องมือโต๊ะข่าว / ได้ 401 / ไม่มี `list_sources`

```powershell
bp newsdesk    # สร้าง container ใหม่
wsl -d Ubuntu-24.04 -- docker logs --tail 50 botpress-newsdesk
```

ถ้ายังไม่หาย: เปิดแอปด้วย `iHC-Press.bat dev` แล้ว `cd D:\SalmonRK\BotPress\iHC-Press; node seed-bots.mjs` (idempotent ไม่สร้างซ้ำ)

### 3.5 เรื่องข่าวค้าง

| ค้างที่ | สาเหตุที่พบบ่อย | ทำอย่างไร |
|---|---|---|
| `pitched` / `assigned` | ยังไม่ถึงรอบหัวหน้าข่าว | งานประจำ → หัวหน้าข่าว → "รันเลย" |
| `factcheck` | ยังไม่ถึงรอบผู้ตรวจ | "รันเลย" งานของผู้ตรวจข่าว 1 หรือ 2 ตามสาย |
| `editing` นาน | **deadlock**: บก.ต้นฉบับรอฝ่ายโซเชียล/ภาพแก้ แต่สองฝ่ายนี้ไม่มี routine | แชทหาฝ่ายโซเชียล (หรือฝ่ายภาพ) ระบุรหัสเรื่องและสิ่งที่ต้องแก้ แล้ว "รันเลย" งานของ บก.ต้นฉบับ |
| `ready` ถูกตีกลับโดยบอทที่ไม่ใช่ บก.บห. | บั๊กบทบาท (ยังไม่แก้) | ดูประวัติเรื่อง แล้วสั่ง บก.ต้นฉบับ ให้ทำต่อ |
| การ์ดอนุมัติซ้ำ 2 ใบ | บก.บห. ขอซ้ำ | อนุมัติใบแรก **ปฏิเสธใบที่สอง** |

### 3.6 สรุปคลิป YouTube ไม่เสร็จ

| อาการ | ทำอย่างไร |
|---|---|
| บอทได้ "pending" ตลอด | แอปต้องเปิดอยู่ (หยิบคิวทุก 15 วินาที) · ดูไฟล์ค้างใน `D:\AI-ART\BotPress\data\news\youtube\requests\` |
| ได้ข้อความ error | ดู `news\youtube\<videoId>\error.json` · บอทเรียกใหม่ได้ (error ถูกล้างหลังรายงานครั้งเดียว) |
| "ไม่มีคำบรรยาย" | คลิปไม่มี subtitle/auto-caption สรุปไม่ได้ |
| yt-dlp ล้ม (YouTube เปลี่ยนระบบ) | `yt-dlp -U` แล้วลองใหม่ |
| ไม่มีภาพหน้าจอ | ตรวจ ffmpeg (ตั้งค่า → YouTube → รายการเครื่องมือ) |
| NotebookLM ล้ม / session หมดอายุ | สคริปต์ใช้ LLM แทนเอง · ล็อกอินใหม่ด้วยปุ่ม "เข้าสู่ระบบ Google" หรือ `notebooklm login` |

### 3.7 ล็อกอิน Rakazo ไม่ได้ / แอปขึ้นหน้าสร้างบัญชีใหม่

`owner.json` หาย → กู้จาก `D:\AI-ART\BotPress\localai\backups\secrets-*\` ไปที่ `%LOCALAPPDATA%\BotPress\` แล้วเปิดใหม่ **อย่ากดสร้างบัญชีใหม่**

### 3.8 สลับโปรไฟล์แล้วแอปไม่เปิดกลับมา

1. ดู `D:\AI-ART\BotPress\localai\logs\launcher.log` บรรทัดท้าย
2. เปิดเองด้วย `iHC-Press.bat`
3. ถ้าโปรไฟล์ใหม่เสีย: คัดลอก `%LOCALAPPDATA%\BotPress\llm.json.bak` กลับเป็น `llm.json` แล้วเปิดใหม่

## 4. สำรองและกู้คืน

| สำรองอะไร | อย่างไร | ความถี่ที่แนะนำ |
|---|---|---|
| ฐานข้อมูล Rakazo + appdata + .env | `botpress.sh backup` → `D:\AI-ART\BotPress\localai\backups\rakazo-<เวลา>\` | ทุกสัปดาห์ และก่อนอัปเกรด/seed ใหม่ |
| ข่าวและแหล่งข่าว | คัดลอก `D:\AI-ART\BotPress\data\news\` | ทุกสัปดาห์ |
| `owner.json`, `llm.json` | คัดลอกไป `D:\AI-ART\BotPress\localai\backups\secrets-<วันที่>\` | เมื่อเปลี่ยน |
| โปรไฟล์ LLM | `D:\AI-ART\BotPress\localai\llm-profiles\` | เมื่อเปลี่ยน |

กู้ฐานข้อมูล (หยุด worker ก่อน):

```bash
# ใน WSL
cd ~/rakazo && docker compose -f docker-compose.images.yml stop worker api web supervisor
docker exec -i rakazo-postgres-1 pg_restore -U rakazo -d rakazo --clean --if-exists < /mnt/d/AI-ART/BotPress/localai/backups/rakazo-<เวลา>/rakazo.pgdump
env BP_NEWS=/mnt/d/AI-ART/BotPress/data/news BP_INFRA=/mnt/d/AI-ART/BotPress/localai bash /mnt/d/AI-ART/BotPress/app/botpress.sh start
```

⚠ ยังไม่เคยทดสอบการกู้จริง ทำหลัง backup ล่าสุดเสมอ

## 5. Build และ deploy โค้ดใหม่

```powershell
cd D:\SalmonRK\BotPress\iHC-Press
# 1) ปิดแอปก่อน (exe ถูกล็อกตอนเปิด)
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o D:\AI-ART\BotPress\app
D:\AI-ART\BotPress\app\BotPress.exe --selftest   # PASS
cd newsdesk; node server.mjs --selftest; cd ..     # 54/54
# 2) ถ้าแก้ newsdesk/server.mjs ต้องสร้าง container ใหม่ (container อ่านโค้ดจาก app\newsdesk ที่ publish แล้ว)
wsl -d Ubuntu-24.04 -- docker restart botpress-newsdesk
# 3) เปิดแบบ dev แล้วทดสอบ e2e (เรียก LLM จริง ~1 นาที)
D:\AI-ART\BotPress\iHC-Press.bat dev
node tests\e2e.mjs D:\tmp                          # 18/18
```

- แอปอ่านหน้าจอจาก `D:\AI-ART\BotPress\app\ui\` (publish คัดลอกให้) แก้แค่ `ui\` จึงต้อง publish ใหม่ หรือระหว่างพัฒนาให้ตั้ง `BOTPRESS_UI_DIR=D:\SalmonRK\BotPress\iHC-Press\ui` ก่อนเปิดแอป แล้วปิดเปิดแอปเพื่อดูผล
- dotnet ใน PATH (`C:\Program Files\dotnet`, SDK 10.0.401) ใช้ได้ ไม่ต้องใช้ path ใน `%LOCALAPPDATA%` ตามที่ README ต้นฉบับเขียน

### 5.1 หลัง publish (ถ้าแก้ `newsdesk\server.mjs`)

container โต๊ะข่าวอ่านโค้ดจาก `app\newsdesk\` ตอนเริ่มเท่านั้น: `wsl -d Ubuntu-24.04 -- docker restart botpress-newsdesk` แล้วตรวจ `docker exec botpress-newsdesk grep -c VOICE_LINT //app/server.mjs` · ถ้าแก้ prompt บอท (`seed-bots.mjs` หรือ brand voice) ต้อง `node seed-bots.mjs --rewrite` · ติดตั้งเครื่องใหม่ดู [14](14-Prerequisite-ย้ายขึ้น-Production.md)

## 6. Git และการอัปเดตจากต้นทาง

| งาน | คำสั่ง |
|---|---|
| ดูสถานะ | `git -C D:\SalmonRK\BotPress\iHC-Press log --oneline -8` · branch: main → remote-llm → ihc-brand → **ihc-rename** |
| remote | `origin` = github.com/SalmonRK/iHC-Press · `upstream` = jaturapornchai/botpress (push ปิดไว้) |
| เช็กอัปเดต Rakazo + ต้นฉบับ | `node D:\SalmonRK\BotPress\tools\check-rakazo-updates.mjs` |
| ดึงต้นฉบับ | `git fetch upstream` แล้ว merge เข้า branch ของเรา (อ่าน diff ของ `seed-bots.mjs` และ `newsdesk/` ก่อน) |
| push | **ยังไม่เคย push** ทำเมื่อเจ้าของโปรเจกต์สั่งเท่านั้น: `git push -u origin ihc-rename` |

อัปเกรด Rakazo (v0.1.6 → v0.2.x): ทำตาม [04](04-Rakazo-อ้างอิงและอัปเดต.md) และ backup ก่อนเสมอ

## 7. ทดสอบ

| ทดสอบ | คำสั่ง | ใช้ LLM | เวลา |
|---|---|---|---|
| host selftest | `D:\AI-ART\BotPress\app\BotPress.exe --selftest` | ไม่ | วินาที |
| newsdesk selftest | `node newsdesk\server.mjs --selftest` | ไม่ | วินาที |
| seed dry run | `node seed-bots.mjs --dry` | ไม่ | วินาที |
| e2e (แอปต้องเปิดด้วย `dev`) | `node tests\e2e.mjs <outDir>` | ใช่ (สั้น) | ~1 นาที |
| เดินข่าวครบรอบ | `node tests\newsroom-live.mjs 120` | **ใช่ (หนัก)** | 45–120 นาที · **กดอนุมัติเผยแพร่เอง 1 เรื่อง** · ขออนุญาตเจ้าของเครื่อง LLM ก่อน |
| สรุปคลิป | `node tools\yt-digest.mjs <url>` | ใช่ (สั้น) | 15–30 วินาที |

## 8. ย้อนกลับการเปลี่ยนแปลงบนเครื่อง

ดูตาราง "สิ่งที่เปลี่ยนบนเครื่องนี้" ใน [05](05-สถานะการติดตั้ง.md) · ย้อนกลับ LLM: ใช้โปรไฟล์เดิมในแอป หรือคัดลอก `llm.json.bak` · ย้อนกลับโค้ด: `git checkout <branch ก่อนหน้า>` แล้ว build ใหม่

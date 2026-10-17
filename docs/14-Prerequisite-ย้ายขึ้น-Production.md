# Prerequisite: ย้าย iHC-Press ขึ้นเครื่อง Production

> อัปเดต 2026-10-17 · ใช้คู่กับ [11 Runbook](11-Runbook-การดูแลระบบ.md) (ดูแลประจำวัน) และ [05](05-สถานะการติดตั้ง.md) (ประวัติการติดตั้งเครื่องแรก)
> เป้าหมาย: เตรียมเครื่องใหม่ให้ครบตามรายการนี้ แล้วเปิดใช้งานได้ทันที รวมฟีเจอร์ล่าสุด **artwork ข่าว** และ **brand voice**

## 0. Checklist สรุป

| # | ต้องมี | จำเป็น | ตรวจด้วย | ค่าบนเครื่องพัฒนา (ใช้งานได้จริง) |
|---|---|---|---|---|
| 1 | Windows 11 x64 + Microsoft Edge + WebView2 Runtime | ✅ | `winver` | Windows 11 Pro 26200, Edge 155 |
| 2 | Node.js ≥ 22 (ต้องมี `fetch` และ `WebSocket` ในตัว) | ✅ | `node --version` | v24.15.0 |
| 3 | WSL2 + Ubuntu-24.04 (systemd, user `rakazo` uid 1000) | ✅ | `wsl -l -v` | NAT mode |
| 4 | Docker Engine + compose ใน Ubuntu (group `docker` = gid 1001) | ✅ | `wsl -d Ubuntu-24.04 -- docker --version` | 29.9.0 / compose 5.6.0 |
| 5 | Rakazo **v0.1.6** ที่ `~/rakazo` + `.env` | ✅ | `bp status` | healthy |
| 6 | LLM แบบ OpenAI-compatible ที่ทำ tool calling ได้ และ worker ใน WSL เรียกถึง | ✅ | `curl <url>/v1/models` จาก WSL | Ollama `qwen3.6:35b-a3b` ctx 65536 (LocalAI-07) |
| 7 | Tailscale (ถ้า LLM อยู่บน tailnet) | ตามที่ตั้ง LLM | `tailscale status` | LocalAI-07/08 อยู่บน tailnet |
| 8 | yt-dlp + ffmpeg บน PATH | สำหรับสรุป YouTube | `yt-dlp --version`, `ffmpeg -version` | มี |
| 9 | uv + notebooklm-py + ล็อกอิน Google | ไม่บังคับ | `notebooklm auth check` | ติดตั้งแล้ว ยังไม่ล็อกอิน |
| 10 | ไฟล์ติดตั้ง: `app\`, `tools\Start-BotPress.ps1`, `iHC-Press.bat`, `localai\` | ✅ | §5 | อยู่ใต้ `D:\AI-ART\BotPress\` |
| 11 | ความลับ (สร้างใหม่หรือย้ายอย่างปลอดภัย) | ✅ | §6 | ห้ามผ่าน git หรือแชท |
| 12 | พื้นที่ดิสก์ว่าง | ✅ | | แนะนำ ≥ 40 GB (WSL + image ของ Rakazo + ข่าวและภาพ) |

**ไม่ต้องมีบนเครื่อง production:** .NET SDK (แอป publish แบบ self-contained แล้ว), git, Python, Chrome Canary/Google Flow (ใช้เฉพาะตอนสร้างภาพ asset ใหม่ ทำที่เครื่องพัฒนา)

## 1. เครื่องและระบบปฏิบัติการ

- Windows 11 x64 ที่เปิด virtualization (สำหรับ WSL2) · ผู้ใช้ทั่วไปพอ แต่การติดตั้ง WSL/Docker ครั้งแรกอาจต้องใช้สิทธิ์ admin
- RAM แนะนำ ≥ 16 GB (Rakazo ใช้ postgres, worker และ computer ของบอท 15 ตัว)
- **ไม่ต้องมี GPU** ถ้า LLM อยู่เครื่องอื่น (แบบที่ใช้อยู่) · ถ้าจะรัน LLM ในเครื่องเดียวกันต้องวางแผน GPU แยก
- WebView2 Runtime มากับ Windows 11 แล้ว · Edge ใช้สำหรับ render ภาพข่าวแบบ headless (หรือ Chrome ก็ได้ ตั้ง `BROWSER=<path>`)

## 2. ซอฟต์แวร์บน Windows

| ซอฟต์แวร์ | ใช้ทำอะไร | ติดตั้ง |
|---|---|---|
| **Node.js LTS ≥ 22** | render ภาพข่าว (`tools\news-art\render.mjs`), สรุป YouTube, `seed-bots.mjs`, ชุดทดสอบ | `winget install OpenJS.NodeJS.LTS` |
| yt-dlp | ดึงข้อมูลและซับคลิป YouTube | `winget install yt-dlp.yt-dlp` |
| ffmpeg | ตัดภาพหน้าจอจากคลิป | `winget install Gyan.FFmpeg` |
| Tailscale | เข้าถึงเครื่อง LLM บน tailnet | `winget install Tailscale.Tailscale` แล้วล็อกอินบัญชีเดียวกับเครื่อง LLM |
| uv + notebooklm-py (ไม่บังคับ) | สรุปคลิปด้วย NotebookLM | ปุ่ม "ติดตั้ง" ในหน้า ตั้งค่า > YouTube ของแอป (เรียก `uv tool install "notebooklm-py[browser]"`) แล้วกด "เข้าสู่ระบบ Google" |

หลังติดตั้งให้ **ปิดแล้วเปิด PowerShell ใหม่** เพื่อให้ PATH ใหม่มีผล แล้วตรวจ `node --version`, `yt-dlp --version`, `ffmpeg -version`

## 3. WSL + Docker

1. **Ubuntu-24.04:** `wsl --install -d Ubuntu-24.04` (ถ้าค้าง ให้ import จาก rootfs ทางการตามที่ทำในเครื่องแรก ดู [05](05-สถานะการติดตั้ง.md) ข้อ 5)
2. **`/etc/wsl.conf`:**
   ```ini
   [boot]
   systemd=true
   [user]
   default=rakazo
   ```
   ผู้ใช้ `rakazo` ต้องเป็น uid 1000 แล้ว `wsl --shutdown` หนึ่งครั้ง
3. **Docker Engine + compose plugin + socat** ใน Ubuntu และให้ group `docker` เป็น **gid 1001** (container โต๊ะข่าวรันด้วย `--user 1000:1001`)
4. **`/etc/docker/daemon.json`** ย้ายวง docker ไม่ให้ชนกับวงของ WSL:
   ```json
   { "bip": "10.88.0.1/16", "default-address-pools": [ { "base": "10.89.0.0/16", "size": 24 } ] }
   ```
   แล้ว `sudo systemctl restart docker`
5. **ใช้ WSL โหมด NAT (ค่าเริ่มต้น)** ห้ามเปิด mirrored mode: เครื่องแรกลองแล้ว Hyper-V firewall บล็อก inbound และแก้ต้องใช้สิทธิ์ admin

## 4. Rakazo และ LLM

- **Rakazo v0.1.6** ที่ `~/rakazo` (`install-images.sh`, `docker-compose.images.yml`, `.env`) รายละเอียดและวิธีตรวจเวอร์ชันใหม่ดู [04](04-Rakazo-อ้างอิงและอัปเดต.md) · **ห้ามอัปเกรดเวอร์ชันโดยไม่ทดสอบ** แอปผูกกับสัญญา API ของ v0.1.6
- `.env` ต้องมีอย่างน้อย: ค่าฐานข้อมูลและ secret ที่สร้างใหม่ (`POSTGRES_*`, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `SCREEN_PROXY_SECRET`, `SANDBOX_SUPERVISOR_TOKEN`), `RAKAZO_LOCAL_MODELS`, `RAKAZO_LOCAL_MODELS_URL`, `RAKAZO_LOCAL_CONTEXT_WINDOW`, `RAKAZO_LOCAL_MAX_TOKENS` · `RAKAZO_WEB_PORT`/`RAKAZO_API_PORT` และ URL ของ auth launcher เขียนให้เองทุกครั้งที่เปิด
- **LLM:** endpoint แบบ OpenAI-compatible (`/v1/chat/completions`) ที่ทำ **tool calling** ได้ และ context ≥ 32K (บอทแต่ละตัวมีคำสั่งราว 10,000 ตัวอักษร + ผลจากเครื่องมือ) · ทางที่ทดสอบแล้ว: Ollama `qwen3.6:35b-a3b` ctx 65536 และ tensorfold `openthai2.0` ctx 131072
- โปรไฟล์ LLM อยู่ที่ `localai\llm-profiles\*.json` สลับในแอปที่ ตั้งค่า > สมอง AI · ค่าที่ใช้อยู่เก็บใน `%LOCALAPPDATA%\BotPress\llm.json`
- **ทดสอบก่อนเปิดใช้:** จาก WSL `curl -s <url>/v1/models` ต้องตอบ และคำขอสั้น ๆ ต้องตอบภายในไม่กี่วินาที (ถ้าเกิน 60 วินาที บอทจะล้มด้วย "Request timed out.")

## 5. ไฟล์ที่ต้องย้ายหรือสร้าง

| อะไร | จากเครื่องพัฒนา | ไปที่ production | หมายเหตุ |
|---|---|---|---|
| ตัวแอป | `D:\AI-ART\BotPress\app\` | `<ติดตั้ง>\app\` | ได้จาก `dotnet publish` (§7) มี exe, `ui\`, `newsdesk\`, `botpress.sh`, `tools\yt-digest.mjs`, `tools\paths.mjs` และ **`tools\news-art\` (render.mjs, template.html, ภาพ asset 14 ไฟล์, ฟอนต์ Noto Sans Thai)** · ภาพข่าวทำงาน offline ไม่ต้องใช้อินเทอร์เน็ต |
| launcher | `D:\AI-ART\BotPress\tools\Start-BotPress.ps1`, `iHC-Press.bat` | `<ติดตั้ง>\tools\`, `<ติดตั้ง>\` | ⚠ **ยังไม่อยู่ในรีโป git** ต้องคัดลอกเอง |
| infra | `D:\AI-ART\BotPress\localai\botadmin\rakazo.sh`, `llm-profiles\` | `<ติดตั้ง>\localai\` | ⚠ **ยังไม่อยู่ในรีโป git** · `backups\`, `logs\` สร้างใหม่ได้ |
| ข้อมูลข่าว (ไม่บังคับ) | `D:\AI-ART\BotPress\data\news\` (`stories.json`, `sources.json`, `youtube\`, `art\`, `<วันที่>\*.md`) | `<ติดตั้ง>\data\news\` | ไม่คัดลอก = เริ่มโต๊ะข่าวว่าง · **ห้ามคัดลอก `.token`** (โต๊ะข่าวสร้างใหม่เอง) |
| ที่อยู่ | `%LOCALAPPDATA%\BotPress\paths.json` | สร้างอัตโนมัติ | launcher เขียนให้จากโฟลเดอร์ที่ตัวเองอยู่ (`app`, `data\news`, `localai`) ถ้ายังไม่มี · **path ห้ามมีช่องว่าง** |

โครงที่แนะนำบน production (ใช้ path เดียวกันได้ เอกสารทั้งหมดจะตรงทันที):

```
D:\AI-ART\BotPress\
  iHC-Press.bat
  app\              ← dotnet publish
  tools\Start-BotPress.ps1
  localai\botadmin\rakazo.sh · llm-profiles\ · backups\ · logs\
  data\news\        ← โต๊ะข่าว ภาพข่าว (art\) สรุปคลิป
```

## 6. ความลับ (ห้าม commit · ห้ามแปะในแชท)

| ไฟล์ | วิธีที่แนะนำบน production |
|---|---|
| `~/rakazo/.env` | สร้าง secret ชุดใหม่ ไม่ใช้ของเครื่องพัฒนา |
| `%LOCALAPPDATA%\BotPress\owner.json` | สร้างใหม่ตอนเปิดแอปครั้งแรก (บัญชีเจ้าของ) |
| `<news>\.token` | โต๊ะข่าวสร้างเองตอนเริ่ม แล้ว `seed-bots.mjs` ส่งให้ Rakazo |
| `*-api-key.txt`, `localai\backups\secrets-*` | ย้ายผ่านช่องทางปลอดภัยเท่านั้น ถ้าจำเป็น |

⚠ รีโป `SalmonRK/iHC-Press` เป็น **public** และเอกสารมี Tailscale IP กับ path ภายใน ควรตัดสินใจก่อนว่าจะทำ private หรือลบข้อมูลเหล่านั้น

## 7. ขั้นตอนติดตั้งบน production (ตามลำดับ)

1. ติดตั้ง §2 และ §3 ให้ครบ แล้ว `wsl --shutdown` หนึ่งครั้ง
2. ติดตั้ง Rakazo v0.1.6 ใน `~/rakazo` ตาม [04](04-Rakazo-อ้างอิงและอัปเดต.md) และสร้าง `.env` (§4)
3. **build ตัวแอปที่เครื่องพัฒนา** (production ไม่ต้องมี SDK):
   ```powershell
   cd D:\SalmonRK\BotPress\iHC-Press
   git checkout ihc-rename
   node newsdesk\server.mjs --selftest        # ต้องได้ selftest OK (55 checks)
   node tests\news-art.mjs                    # ต้องได้ 6/6 PASS
   dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o <โฟลเดอร์ส่งออก>\app
   ```
4. คัดลอก `app\`, `tools\Start-BotPress.ps1`, `iHC-Press.bat`, `localai\` (และ `data\news\` ถ้าต้องการ) ไปที่ production ตาม §5
5. คัดลอกโปรไฟล์ LLM ที่จะใช้เป็น `%LOCALAPPDATA%\BotPress\llm.json` (หรือเลือกในแอปภายหลัง)
6. เปิด `iHC-Press.bat dev` ครั้งแรก (เปิด devtools 9224 ไว้ให้ seed) → launcher เลือก port ว่าง เริ่ม WSL/Rakazo/โต๊ะข่าว ตรวจ LLM แล้วเปิดแอป → สร้างบัญชีเจ้าของ
7. **สร้างทีมบอท** (ใช้ไฟล์จากรีโปบนเครื่องที่มี Node และเข้าถึง devtools ของแอปได้ เช่นคัดลอกโฟลเดอร์รีโปไปด้วย):
   ```powershell
   node seed-bots.mjs --dry      # ตรวจรายชื่อ ขนาดคำสั่ง (ต้อง ≤ 20000) และ token
   node seed-bots.mjs            # สร้างบอท 15 ตัว ห้อง 3 ห้อง routine 8 ตัว พร้อมแนวเขียน iHC-Press
   ```
   ⚠ routine เริ่มทำงานตามเวลา (เช่น 07:00) ทันทีหลัง seed **อย่า seed จนกว่า LLM พร้อมและเจ้าของเครื่อง LLM ตกลงเรื่องโหลดแล้ว**
8. ปิดแล้วเปิดแอปแบบปกติ (`iHC-Press.bat` ไม่มี `dev`)

## 8. ตรวจรับก่อนใช้งานจริง (go-live checklist)

| ตรวจ | วิธี | ผ่านเมื่อ |
|---|---|---|
| แอปและ host | `app\BotPress.exe --selftest` | SELFTEST PASS |
| Rakazo + โต๊ะข่าว | `bp status` (ประกาศ `bp` ตาม [11](11-Runbook-การดูแลระบบ.md) §0 โดยเปลี่ยน path ให้ตรงเครื่อง) | ทุก service healthy และ `NEWSDESK running` |
| ตัวตรวจภาษาในโต๊ะข่าว | `wsl -d Ubuntu-24.04 -- docker exec botpress-newsdesk grep -c VOICE_LINT //app/server.mjs` | ได้ตัวเลข ≥ 1 |
| LLM | จาก PowerShell: `curl.exe -s -m 60 <url>/v1/chat/completions -H "content-type: application/json" -d "{\"model\":\"<model>\",\"messages\":[{\"role\":\"user\",\"content\":\"ตอบคำเดียว: พร้อม\"}],\"max_tokens\":5}"` | ตอบภายในไม่กี่วินาที · ⚠ หน้า Monitor ขึ้น "พร้อม" ได้แม้คำขอจริงค้าง (ตรวจแค่ว่าติดต่อเครื่องได้) |
| ภาพข่าว | `node <app>\tools\news-art\render.mjs --id golive --headline "ทดสอบภาพข่าว iHC-Press" --out %TEMP%\golive` | ได้ PNG 3 ไฟล์ ภาษาไทยถูก |
| ภาพข่าวในแอป | เปิด โต๊ะข่าว → ข่าวที่ "รอ บก.บห." | มีภาพย่อบนการ์ด และในหน้าอ่านข่าวมีภาพ 3 ขนาด กดสร้างใหม่ได้ |
| แนวเขียนในบอท | `node seed-bots.mjs --dump %TEMP%\bots.json` แล้วค้นคำ "แนวเขียน iHC-Press" | อยู่ในคำสั่งของนักข่าว 8 ตัว บก.ต้นฉบับ และฝ่ายโซเชียล |
| รอบข่าวจริง 1 รอบ | สั่งในห้องข่าว แล้วดูข่าวเดินถึง ready (ดู [06](06-ผลทดสอบรอบข่าว.md)) | ข่าว ready มีภาพข่าวอัตโนมัติ และ get_story ไม่มี "ข้อสังเกตภาษา" ค้าง |
| สำรองข้อมูล | `bp backup` | มีโฟลเดอร์ใน `localai\backups\` |

## 9. สิ่งที่ต้องรู้ก่อน go-live (ณ 2026-10-17)

- ⚠ **LLM ที่ใช้อยู่ (LocalAI-07) ตอบช้าผิดปกติ** ตั้งแต่ 2026-10-16 ราว 21:40 (คำขอสั้น ๆ ไม่ตอบภายใน 150 วินาที) และ DGX LocalAI-08 ออฟไลน์ตั้งแต่ 10-14 · ต้องมี LLM ที่พร้อมก่อน ไม่งั้นบอทล้มด้วย "Request timed out."
- ⚠ e2e (`tests\e2e.mjs`) ผ่าน 14/18 ข้อที่ไม่ผ่านทั้งหมดเป็นขั้นที่ต้องให้ LLM ตอบ จึงยังไม่ได้ทดสอบรอบข่าวเต็มกับแนวเขียนใหม่
- launcher, `rakazo.sh` และโปรไฟล์ LLM ยังไม่อยู่ใน git (§5) ควรนำเข้ารีโป (ไม่รวมความลับ) ก่อนติดตั้งเครื่องที่สอง
- prompt ของบอทยังเรียกเจ้าของว่า "ลุงจืด" และใช้ชื่อ "BotPress สำนักข่าวบอท" (งาน rebrand ที่ยังค้าง)
- ข่าวที่เขียนก่อนเปิดแนวเขียนใหม่ (เช่น 20261014-01) ยังมีภาษาแบบเดิม แก้ได้โดยให้ บก.บห. ส่งกลับ editing

## 10. ฟีเจอร์ใหม่ที่มากับชุดนี้

| ฟีเจอร์ | อยู่ที่ไหน | ต้องตั้งค่าอะไรบน production |
|---|---|---|
| **ภาพข่าวอัตโนมัติ** ข่าวที่ถึง ready/published ได้ภาพ 3 ขนาดภายใน ~30 วินาที (แอปตรวจทุก 30 วินาที) และสร้างใหม่เองเมื่อพาดหัวหรือบรีฟภาพเปลี่ยน | `app\tools\news-art\`, ผลที่ `data\news\art\<id>\` | Node.js + Edge เท่านั้น |
| **แสดงภาพข่าว** ภาพย่อบนการ์ดในโต๊ะข่าว · หน้าอ่านข่าวมีภาพ 3 ขนาด เลือกแบบ (ข่าวทั่วไป / ข่าวด่วน / การ์ดสรุป) กดสร้างใหม่ ดูภาพเต็ม เปิดโฟลเดอร์ | `ui\newsdesk.js` | ไม่มี |
| **บรีฟภาพแบบมีโครงสร้าง** ฝ่ายภาพเลือกแบบภาพ ประเด็นของการ์ด และภาพหน้าจอจากคลิปได้ | prompt ฝ่ายภาพใน `seed-bots.mjs` | seed บอท |
| **Brand voice** แนวเขียนของ iHC-Press อยู่ในคำสั่งของนักข่าว บก.ต้นฉบับ และฝ่ายโซเชียล | [ihc-press-brand-voice.md](ihc-press-brand-voice.md) | seed บอท · แก้แนวเขียนแล้ว `node seed-bots.mjs --rewrite` |
| **ตัวตรวจภาษาในโต๊ะข่าว** update_story/get_story แจ้ง "ข้อสังเกตภาษา" เมื่อพบภาษาแปล คำต้องห้าม ปี ค.ศ. หรือวงเล็บอังกฤษเกิน 2 ที่ (แจ้งอย่างเดียว ไม่บล็อก) | `newsdesk\server.mjs` (`VOICE_LINT`) | ไม่มี (มากับตัวแอป) |

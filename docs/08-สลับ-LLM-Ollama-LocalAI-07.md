# สลับ LLM เป็น Ollama qwen3.6:35b-a3b บน LocalAI-07 (2026-10-16)

> ตั้งแต่ 2026-10-16 บอททั้ง 15 ตัวใช้ **qwen3.6:35b-a3b** บน Ollama ของ LocalAI-07 แทน OpenThai 2.0 บน DGX Spark (LocalAI-08) เพราะ DGX ออฟไลน์ตั้งแต่ 2026-10-14

## 1. ผลตรวจ LocalAI-07

| หัวข้อ | ผล |
|---|---|
| เครื่อง | Tailscale `localaipc-007` = **100.125.52.66** (Windows) |
| Ollama | `:11434` เปิดอยู่ เวอร์ชัน 0.30.11 ไม่มี auth (Open WebUI 0.10.2 อยู่ที่ `:8080`) |
| โมเดล | `qwen3.6:35b-a3b` (MoE 36B, Q4_K_M, 23.9 GB) มีอยู่แล้ว และรองรับ vision, tools และ thinking |
| โหลดลง GPU | ทั้งโมเดลอยู่ใน VRAM (24.5 GB) ใช้ **context 65,536** (ค่าที่ server ตั้ง) และ keep_alive ประมาณ 30 นาที |
| ความเร็ว | สร้างข้อความ **~230 token/s** · อ่าน prompt **~2,300 token/s** (prompt 19K token ใช้ 8.5 วินาที และหารหัสที่ซ่อนไว้กลางข้อความเจอ) |
| พร้อมกันหลายงาน | 4 คำขอพร้อมกันเสร็จใน 2.6 วินาที |
| ภาษาไทย | ดีเมื่อมี system prompt ภาษาไทย (prompt ไทยล้วนที่ส่งจาก Git Bash แบบ inline ได้คำตอบเป็นภาษาเกาหลี เพราะ encoding เพี้ยน ส่งเป็นไฟล์ UTF-8 แล้วปกติ) |
| Tool call | ถูกต้อง (`web_search` พร้อม arguments) |

**เทียบกับ OpenThai บน DGX:** qwen3.6 เร็วกว่ามาก (OpenThai อ่าน 72K token แบบ cold ใช้ 72 วินาที) แต่ context ใช้ได้ 64K ไม่ใช่ 128K+ และภาษาไทยเป็นธรรมชาติน้อยกว่าโมเดลไทยโดยตรง

## 2. ที่แก้ไป

| ส่วน | การเปลี่ยนแปลง |
|---|---|
| `%LOCALAPPDATA%\BotPress\llm.json` | ชี้ไป Ollama ของ LocalAI-07 และเพิ่มฟิลด์ `baseUrl`, `contextWindow`, `maxTokens`, `vision` |
| `tools\Start-BotPress.ps1` (launcher) | เขียน `RAKAZO_LOCAL_*` ใน `~/rakazo/.env` ตาม llm.json ทุกครั้งที่เปิด และตรวจ Ollama ผ่าน `/api/version` + `/api/tags` เพราะ Ollama ไม่มี `/health` |
| `Monitor.cs` | การ์ด LLM รู้จัก Ollama: แสดง "พร้อม", ชื่อโมเดลที่โหลดอยู่และ ctx จาก `/api/ps` และหัวการ์ดแสดง label จาก llm.json |
| `RakazoClient.cs` | หลังล็อกอิน ถ้า llm.json ระบุโมเดลอื่นของ provider เดียวกัน แอปจะ connect + setDefault ให้เอง บอทจึงเปลี่ยนตามทันที (ถ้าผู้ใช้เลือก BCAiRouter หรือ Synthetic ไว้ จะไม่ไปแตะ) |

- commit `f95d4cf` บน branch `ihc-rename` (ยังไม่ได้ push)
- `.env` ของ Rakazo ตอนนี้: `RAKAZO_LOCAL_MODELS=qwen3.6:35b-a3b`, `RAKAZO_LOCAL_MODELS_URL=http://100.125.52.66:11434/v1`, `RAKAZO_LOCAL_CONTEXT_WINDOW=65536`, `RAKAZO_LOCAL_MAX_TOKENS=16384`, `RAKAZO_LOCAL_VISION_MODELS=qwen3.6:35b-a3b`

## 3. ผลทดสอบหลังสลับ

- launcher: "LLM พร้อม: Qwen3.6 35B-A3B (Ollama / LocalAI-07) · Ollama 0.30.11"
- `tests/e2e.mjs`: **18/18 PASS** บอทใช้เครื่องมือเปิดเว็บและตอบภาษาไทยใน 7.9 วินาที และในกลุ่มทั้ง 2 ตัวตอบใน 3.3 วินาที
- ตาราง `runs` ของ Rakazo ทุก run ใหม่ใช้ `local / qwen3.6:35b-a3b` รวมถึง run ของ บก.ต้นฉบับ ที่ routine 15:30 เริ่มไว้ก่อนสลับ ซึ่ง worker รับไปทำต่อจนเสร็จ
- `BotPress.exe --selftest`: PASS · หน้า Monitor แสดงการ์ด LLM เป็น "พร้อม · model: qwen3.6:35b-a3b · ctx 64K"

## 4. วิธีสลับกลับหรือสลับไปเครื่องอื่น

มีโปรไฟล์อยู่ที่ `D:\AI-ART\BotPress\localai\llm-profiles\`:

| ไฟล์ | โมเดล |
|---|---|
| `qwen36-localai07.json` | qwen3.6:35b-a3b บน Ollama LocalAI-07 (ใช้อยู่) |
| `openthai-localai08.json` | OpenThai 2.0 บน tensorfold DGX Spark (ctx 128K) |

1. ปิด iHC-Press
2. คัดลอกโปรไฟล์ที่ต้องการไปทับ `%LOCALAPPDATA%\BotPress\llm.json`
3. เปิดด้วย `iHC-Press.bat` แล้ว launcher จะแก้ `.env` และสร้าง container ใหม่ จากนั้นแอปจะสลับ default model ให้เอง

## 5. ข้อควรรู้

- **context 64K มาจากฝั่ง Ollama** ซึ่ง API แบบ OpenAI ปรับต่อคำขอไม่ได้ ถ้าต้องการมากกว่านี้ ต้องตั้ง `OLLAMA_CONTEXT_LENGTH` บน LocalAI-07 แล้วแก้ `contextWindow` ใน llm.json ให้ตรงกัน ห้ามตั้ง contextWindow เกินค่าที่ Ollama ใช้จริง เพราะ Ollama จะตัด prompt เงียบ ๆ
- หลังว่าง ~30 นาที Ollama ปลดโมเดลออกจาก VRAM และคำขอแรกหลังจากนั้นช้าลงราว 20–30 วินาทีเพื่อโหลดใหม่ (การ์ด Monitor จะขึ้น "(ยังไม่โหลด)")
- ปุ่มเปิด/หยุด/รีสตาร์ท LLM ในแอปใช้ไม่ได้กับเครื่องระยะไกล เพราะตั้งใจไม่ให้ไปยุ่งกับ server ของเครื่องอื่น
- LocalAI-07 อาจมีคนอื่นใช้ร่วม ถ้าต้องรันรอบข่าวยาว ๆ ควรแจ้งเจ้าของเครื่องก่อน
- ระหว่างที่ DGX ออฟไลน์ (10-14 ถึง 10-16) routine ล้มไป 28 run และจะกลับมาทำงานปกติตั้งแต่รอบถัดไป

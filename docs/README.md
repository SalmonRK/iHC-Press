# เอกสาร iHC-Press (ต่อยอดจาก BotPress สำนักข่าวบอท) @ D:\AI-ART

> อัปเดต 2026-10-17 · **เริ่มเร็ว:** อยากรู้ว่าทำอะไรได้ → [10](10-ฟีเจอร์ทั้งหมด.md) · ดูแลระบบหรือมีปัญหา → [11](11-Runbook-การดูแลระบบ.md) · อยากทำงานเฉพาะเรื่อง → [12](12-Cookbook-สูตรใช้งาน.md)

| ไฟล์ | อ่านเมื่อ |
|---|---|
| [01-คู่มือการใช้งาน.md](01-คู่มือการใช้งาน.md) | **เริ่มที่นี่**: ฟีเจอร์, ทีมบอท, ขั้นตอนข่าว, แหล่งข่าว, วิธีใช้ประจำวัน, การเปิดด้วย `BotPress.bat` และปัญหาที่พบบ่อย |
| [02-ภาพรวม-TechStack-และแผนเดิม.md](02-ภาพรวม-TechStack-และแผนเดิม.md) | สถาปัตยกรรม, tech stack, จุดที่ต้องแก้เมื่อพัฒนาต่อ (หัวข้อ 4–5 เป็นแผนเดิมที่ถูกแทนแล้ว) |
| [03-Rakazo-และ-LLM-DGX-Spark.md](03-Rakazo-และ-LLM-DGX-Spark.md) | Rakazo ต่อโมเดลอย่างไร, ผลทดสอบ OpenThai บน DGX Spark, การขยาย context เป็น 128K, สิ่งที่ทำได้เมื่อมี Spark |
| [04-Rakazo-อ้างอิงและอัปเดต.md](04-Rakazo-อ้างอิงและอัปเดต.md) | ข้อมูล Rakazo (repo, ผู้พัฒนา, เวอร์ชัน) และขั้นตอนอัปเกรด ตรวจอัปเดตด้วย `node D:\SalmonRK\BotPress\tools\check-rakazo-updates.mjs` (อยู่นอก repo) |
| [05-สถานะการติดตั้ง.md](05-สถานะการติดตั้ง.md) | เช็กลิสต์การติดตั้งจริง, สิ่งที่เปลี่ยนบนเครื่อง และวิธีย้อนกลับ |
| [06-ผลทดสอบรอบข่าว.md](06-ผลทดสอบรอบข่าว.md) | ผลทดสอบเดินข่าวครบ 1 รอบ (เวลาที่ใช้ในแต่ละขั้น, บั๊กที่พบ) |
| [07-แบรนด์-iHC-Press.md](07-แบรนด์-iHC-Press.md) | แนวทางแบรนด์ (อิง iHAVECPU) และภาพ 3D ชุดใหม่ (โลโก้, hero, อวาตาร์ 15 บอท) |
| [08-สลับ-LLM-Ollama-LocalAI-07.md](08-สลับ-LLM-Ollama-LocalAI-07.md) | **LLM ปัจจุบัน:** qwen3.6:35b-a3b บน Ollama LocalAI-07 · ผลทดสอบ · วิธีสลับกลับ OpenThai |
| [09-หน้าตั้งค่า-แหล่งข่าว-YouTube.md](09-หน้าตั้งค่า-แหล่งข่าว-YouTube.md) | หน้า **ตั้งค่า**: สลับโมเดลในคลิกเดียว · รายการแหล่งข่าวให้บอท · สรุปคลิป YouTube + ภาพหน้าจอ · วิธีติดตั้ง NotebookLM |
| [10-ฟีเจอร์ทั้งหมด.md](10-ฟีเจอร์ทั้งหมด.md) | **Feature catalog:** ทุกฟีเจอร์พร้อมสถานะ (ใช้ได้ / มีข้อจำกัด / ยังไม่ทดสอบ / ยังไม่มี) และข้อจำกัดที่รู้แล้ว |
| [11-Runbook-การดูแลระบบ.md](11-Runbook-การดูแลระบบ.md) | **Runbook:** เปิด-ปิดประจำวัน, health check, แก้เหตุขัดข้องทีละอาการ, backup/กู้คืน, build/deploy, git, ทดสอบ |
| [13-Artwork-ข่าว.md](13-Artwork-ข่าว.md) | **Artwork ข่าว:** การทำงาน (pipeline, ข้อมูลข่าว→ภาพ, code map), วิธีใช้, วิธีต่อยอด, ข้อจำกัด และ **แผนพัฒนา 5 ระยะ** (ปุ่มในแอป → บอทสั่งเอง → ภาพหลากหลาย → รูปแบบใหม่ → คุณภาพ) |
| [12-Cookbook-สูตรใช้งาน.md](12-Cookbook-สูตรใช้งาน.md) | **Cookbook:** 14 สูตร เช่น สลับ/เพิ่มโมเดล, เพิ่มแหล่งข่าว, สรุปคลิป YouTube ทำข่าว, เปิด NotebookLM, แก้ deadlock, เพิ่มเครื่องมือโต๊ะข่าว |

## ตำแหน่งสำคัญ

| อะไร | ที่ไหน |
|---|---|
| เปิดโปรแกรม | `D:\AI-ART\BotPress\iHC-Press.bat` (`dev` = เปิด devtools) · `BotPress.bat` ใช้แทนกันได้ |
| **โค้ด (git branch `ihc-rename`)** | `D:\SalmonRK\BotPress\iHC-Press` · แก้โค้ดที่นี่แล้ว publish ไปที่ติดตั้ง |
| **ที่ติดตั้ง (โตได้ไม่กระทบโค้ด)** | `D:\AI-ART\BotPress\app` (exe + ui + newsdesk ที่ publish) · `data\news` (ข้อมูลข่าว) · `localai` (infra) · ตั้งค่าที่อยู่ใน `%LOCALAPPDATA%\BotPress\paths.json` |
| infra และ log | `D:\AI-ART\BotPress\localai` · `logs\launcher.log`, `logs\newsroom-live-*.log` |
| Rakazo | WSL `Ubuntu-24.04` → `~/rakazo` (`.env`, compose) |
| ตั้งค่า LLM | ในแอป: **ตั้งค่า → สมอง AI** · ไฟล์ `%LOCALAPPDATA%\BotPress\llm.json` → ตอนนี้ qwen3.6:35b-a3b บน Ollama `http://100.125.52.66:11434` · โปรไฟล์ที่ `D:\AI-ART\BotPress\localai\llm-profiles\` |
| ข่าวที่เผยแพร่ | `D:\AI-ART\BotPress\data\news\<วันที่>\` |
| แหล่งข่าว / สรุปคลิป | `D:\AI-ART\BotPress\data\news\sources.json` · `D:\AI-ART\BotPress\data\news\youtube\<videoId>\` |
| **Repo ของเรา (fork)** | https://github.com/SalmonRK/iHC-Press (public) · ในเครื่อง `origin` = fork, `upstream` = ต้นฉบับ (ดึงอย่างเดียว ปิดการ push) |
| ต้นฉบับ | https://github.com/jaturapornchai/botpress (ไม่มีไฟล์ LICENSE แต่ผู้เขียนประกาศเป็น open source "เอาไปต่อยอดได้เลย" ในเพจ ติด Ai ไปกับลุงจืด เมื่อ 4 ต.ค. 2026 ดู 05) · Rakazo https://github.com/elie222/rakazo (Apache-2.0) |

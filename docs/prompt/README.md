# Image prompts: iHC-Press

> อัปเดต 2026-10-14 · ไฟล์หลักที่สคริปต์ใช้จริงคือ `avatars.json` (ไฟล์นี้สร้างจาก JSON นั้นเพื่อให้อ่านง่าย) · แก้ prompt ที่ JSON แล้วสร้างไฟล์นี้ใหม่

## วิธีสร้างภาพ

```bash
# ต้องมี Chrome Canary ที่ล็อกอิน Google Flow ไว้ และเปิด CDP ที่ :9222 (ดูสกิล flow-creator)
node tools/gen-avatars.mjs D:/AI-ART/BotPress/brand/ihc-press/v3            # สร้างเฉพาะตัวที่ยังไม่มีไฟล์
node tools/gen-avatars.mjs D:/AI-ART/BotPress/brand/ihc-press/v3 checker-2  # สร้างใหม่เฉพาะตัวที่ระบุ
```

- โมเดล: Google Flow · Nano Banana 2.1 · ratio 1:1
- prompt เต็มของแต่ละตัว = `style` + `prompt` ของตัวละคร + `suffix` (ต่อกันเป็นบรรทัดเดียว เพราะถ้า prompt มีการขึ้นบรรทัด Flow จะกดสร้างก่อนพิมพ์ครบ)
- ⚠ Flow บางครั้งส่งภาพแรกหลังพักนานมาช้า ภาพจะสลับไฟล์เลื่อนไปหนึ่งตำแหน่ง สคริปต์ทำภาพ warm-up และตรวจไฟล์เสียให้แล้ว แต่ **ต้องเปิดดู contact sheet ทุกครั้ง** ว่าภาพตรงกับคำบรรยาย
- ⚠ คำว่า policy, law, gavel ทำให้ Flow ไม่สร้างภาพ ให้ใช้คำกลาง ๆ เช่น "technology regulation", "binder"

## แนวภาพ (v3 กึ่งสมจริง + K-pop idol)

- 3D กึ่งสมจริง ผสมลุคถ่ายแบบไอดอล K-pop เป็นตัวละครสมมติ ไม่เหมือนคนจริงหรือไอดอลคนใด
- สีแบรนด์ iHAVECPU ดำ-ขาว-แดง `#C81E23` อยู่ในทรงผมหรือเสื้อผ้าของทุกคน และใช้ rim light สีแดงบนพื้นเทาอ่อน
- **หลักให้จำง่าย:** แต่ละคนต้องต่างกันที่ (1) เพศและวัย (2) ทรงหรือสีผม ซึ่งเห็นชัดแม้ภาพเล็ก 192px (3) ชุด (4) **ของประจำตัว** ที่บอกหน้าที่

**style (ใช้ร่วมทุกตัว):**

> Stylized 3D character portrait that blends semi-realistic 3D rendering with a K-pop idol photoshoot aesthetic: polished realistic skin with a soft glow, detailed individual hair strands, slightly expressive eyes, refined idol styling — trendy styled hair, subtle makeup, fashionable layered outfit, statement accessories. Fictional original East and Southeast Asian character, not resembling any real celebrity or idol. Head and shoulders portrait, three-quarter view, confident charismatic expression looking at the camera, square avatar composition, soft beauty lighting, plain light gray studio background with a subtle red #C81E23 rim light, wardrobe accents in black, white and brand red #C81E23. Member of iHC-Press, a Thai technology and computer news team.

**suffix:** `No text, no letters, no logos, no watermark.`

## ตัวละคร 15 ตัว

| ไฟล์ | บอท | จุดจำ |
|---|---|---|
| `editor-in-chief.png` | บก.บห. | ผมดำทรง two-block ปลายแดง · ต่างหูห่วง · สูทกระดุมสองแถว · ปากกาหมึกซึม |
| `news-editor.png` | หัวหน้าข่าว | มวยผมต่ำปักปิ่นแดง · headset ไมค์ · แท็บเล็ตตารางงาน |
| `reporter-ai.png` | นักข่าว AI | บ็อบสั้นสีขาวแพลทินัม หน้าม้าตรง · แว่น AR ใส · โฮโลแกรมสมองแดง |
| `reporter-gadget.png` | นักข่าว Gadget | ผมแสกข้างเรียบ · แว่นกรอบเงินกลม · บอมเบอร์ซับแดง · มือถือพับได้ |
| `reporter-software.png` | นักข่าวซอฟต์แวร์ | ผมยาวมัดครึ่งหัว (half-up bun) · แว่นเหลี่ยมดำ · คาร์ดิแกน oversize · แล็ปท็อปติดสติกเกอร์ |
| `reporter-startup.png` | นักข่าวสตาร์ทอัพ | undercut เสยหลัง + เคราสั้น · quarter-zip ดำ · กราฟขาขึ้นโฮโลแกรมแดง |
| `reporter-security.png` | นักข่าวไซเบอร์ | หางม้าสูงซ่อนสีแดงด้านใน · ear cuff · techwear · โล่แม่กุญแจโฮโลแกรม |
| `reporter-gaming.png` | นักข่าวเกม | ผม mullet สีเทาเงินไฮไลต์แดง · ฮู้ดดี้ · headset คล้องคอ · จอยเกม · ขยิบตา |
| `reporter-cloud.png` | นักข่าวคลาวด์ | ผมลอนยาวประบ่า · ต่างหูรูปก้อนเมฆ · แจ็กเก็ตยีนส์ขาว · ก้อนเมฆมี server |
| `reporter-policy.png` | นักข่าวนโยบายเทค | ผมสั้นเรียบขมับสีเทา · แว่นเหลี่ยม · สูทสามชิ้น เนคไทแดง · แฟ้มดำแถบแดง |
| `checker-1.png` | ผู้ตรวจข่าว 1 | ผมยาวตรงหน้าม้า · แว่นกลมกรอบใหญ่ · แว่นขยาย · สมุดปกแดง |
| `checker-2.png` | ผู้ตรวจข่าว 2 | ผมเกรียน (buzz cut) · โค้ตยาวปกตั้ง ผ้าพันคอแดง · ปากกาแดงทัดหู · clipboard |
| `copy-editor.png` | บก.ต้นฉบับ | หมวกเบเร่ต์ดำ · ผมพิกซี่ปอยเงิน · ต่างหูมุก · ดินสอแดง + ต้นฉบับ |
| `social.png` | ฝ่ายโซเชียล | ผมมัดดังโงะสองข้าง ริบบิ้นแดง · บอมเบอร์แดง · มือถือมีหัวใจ/ไลก์ลอย |
| `photo.png` | ฝ่ายภาพ | หมวก bucket ดำ · ผมยาวรุงรัง · เสื้อกั๊ก utility · กล้อง DSLR สายแดง |

### บก.บห. (`editor-in-chief`)

```text
Role: editor in chief and team leader — a man in his early thirties with textured black two-block comma hair with dark red tips, a single silver hoop earring, black double-breasted blazer with a small red lapel pin over a black silk shirt, a thin silver chain necklace, holding a black fountain pen, calm mature leader smile.
```

### หัวหน้าข่าว (`news-editor`)

```text
Role: news editor who runs the daily news meeting — a woman in her late thirties with glossy black hair in a sleek low bun held by a red hairpin, a slim black headset microphone over one ear, black tailored blazer over a crisp white shirt, small gold stud earrings, holding a tablet showing a colorful schedule grid with no readable text, decisive energetic smile.
```

### นักข่าว AI (`reporter-ai`)

```text
Role: AI reporter — a woman in her mid twenties with a short platinum-white bob with straight blunt bangs, a thin transparent augmented-reality visor glasses with a faint red glow, white futuristic jacket with thin red circuit-line trim, a small glowing red neural-network brain hologram floating above her open palm, curious bright smile.
```

### นักข่าว Gadget (`reporter-gadget`)

```text
Role: gadget and smartphone reporter — a man in his late twenties with neat side-parted black hair, thin silver round glasses, black bomber jacket with a red lining over a white t-shirt, a smartwatch, one wireless earbud, holding up an open foldable smartphone toward the camera, enthusiastic friendly grin.
```

### นักข่าวซอฟต์แวร์ (`reporter-software`)

```text
Role: software and apps reporter — a woman in her late twenties with long straight black hair styled in a half-up bun, black rectangular glasses, oversized soft black cardigan over a red top, holding an open laptop covered in colorful round stickers with no letters, the screen showing abstract colorful code blocks, relaxed clever smile.
```

### นักข่าวสตาร์ทอัพ (`reporter-startup`)

```text
Role: startup and tech business reporter — a man in his mid thirties with a slicked-back black undercut and a neatly trimmed short beard, black quarter-zip knit sweater over a white t-shirt, a small red rocket-shaped lapel pin, holding a tablet with a glowing red rising bar-chart hologram popping out, ambitious confident smile.
```

### นักข่าวไซเบอร์ (`reporter-security`)

```text
Role: cybersecurity reporter — a woman in her mid twenties with a sleek high ponytail of black hair with a red underlayer, silver ear cuff, black cropped techwear jacket with red zipper details over a black turtleneck, black fingerless glove, a small glowing red shield-and-padlock hologram floating above her hand, cool confident look.
```

### นักข่าวเกม (`reporter-gaming`)

```text
Role: gaming reporter — a young man in his early twenties with fluffy layered mullet hair dyed silver-gray with one red streak, oversized black hoodie with red trim, wireless gaming headset resting around his neck, silver rings, holding a black and red game controller, playful wink and grin.
```

### นักข่าวคลาวด์ (`reporter-cloud`)

```text
Role: cloud and developer reporter — a woman in her early thirties with soft wavy shoulder-length dark brown hair, small silver cloud-shaped earrings, white denim jacket over a black top, a thin red lanyard, holding a small floating glowing white cloud with a tiny server rack inside showing red status lights, calm gentle smile.
```

### นักข่าวนโยบายเทค (`reporter-policy`)

```text
Role: technology regulation reporter — a man in his early forties with short neatly combed black hair graying at the temples, thin rectangular glasses, black three-piece suit with a red tie and a red pocket square, holding a thick black binder with red tab dividers against his chest, thoughtful composed smile.
```

### ผู้ตรวจข่าว 1 (`checker-1`)

```text
Role: fact checker — a woman in her early thirties with long straight black hair and blunt bangs, big round black-framed glasses, black turtleneck, holding a large brass magnifying glass up near her eye that slightly enlarges it, a red notebook tucked under her arm, sharp attentive expression with a slight smile.
```

### ผู้ตรวจข่าว 2 (`checker-2`)

```text
Role: fact checker detective style — a man in his late twenties with a short black buzz cut and a faint scar-free clean face, black long coat with the collar turned up and a red scarf, a red pen tucked behind his ear, holding a clipboard with red check marks and one cross mark, one eyebrow raised in a skeptical knowing smile.
```

### บก.ต้นฉบับ (`copy-editor`)

```text
Role: copy editor — a woman in her early forties with an elegant short pixie haircut with a silver streak under a black beret, pearl earrings, cream blouse under a black vest, holding a red pencil and a printed proof page covered in red correction marks with no readable text, precise warm smile.
```

### ฝ่ายโซเชียล (`social`)

```text
Role: social media editor — a young woman in her early twenties with long black hair styled in two high space buns tied with red ribbons, a glossy red bomber jacket over a white crop top, small heart-shaped earrings, holding a smartphone with 3D heart, thumbs-up and chat bubble icons popping out of the screen, bright cheerful smile with a peace sign.
```

### ฝ่ายภาพ (`photo`)

```text
Role: photo desk editor — a man in his late twenties with shaggy chin-length black hair under a black bucket hat, black utility vest with many pockets over a gray t-shirt, a red camera strap across his chest, holding a professional DSLR camera raised beside his face, creative easygoing grin.
```

## Prompt รุ่นก่อนหน้า (เก็บไว้อ้างอิง)

- **v1 หุ่นยนต์มาสคอต (ไม่ใช้แล้ว: ทุกตัวหน้าตาเหมือนกันเกินไป จนแยกไม่ออก):** อยู่ใน `D:\AI-ART\BotPress\brand\ihc-press\prompts-batch.sh` รวม prompt ของ **โลโก้แอป** และ **ภาพ hero** ซึ่งยังใช้อยู่
- **v2 ตัวเลือก บก.บห. 3 แบบ (A ผู้หญิงแนวอนิเมะ · B ผู้ชายกึ่งจริง · C ผู้ชายสมจริง):** ภาพอยู่ที่ `D:\AI-ART\BotPress\brand\ihc-press\v2\` ผู้ใช้เลือกแนว B+C แล้วเพิ่มความเป็น K-pop ได้เป็น v3

## ภาพปก (hero) v3: ทีม iHC-Press (ใช้งานจริงตั้งแต่ 2026-10-14)

- โมเดล: Google Flow · Nano Banana 2.1 · สร้างที่สัดส่วน **16:9** แล้วครอปเป็น **2.8:1** (เริ่มตัดที่ y=190 จาก 1376×768 แล้วย่อเป็น 1792×640) → `assets/src/hero.png` → `tools/make-assets.py`
- สร้าง 2 ภาพแล้วเลือกภาพที่ 2: ภาพที่ 1 มีแถบดำด้านบนและโลโก้ Apple บนแท็บเล็ต
- ไฟล์: `D:\AI-ART\BotPress\brand\ihc-press\v3-hero\` (`hero-1.jpg`, `hero-2.jpg` และ `hero.png` ที่ครอปแล้ว)
- ก่อนสร้างให้ทำภาพ warm-up 1 ภาพแล้วรอ 60 วินาที (กันภาพเลื่อนไฟล์)

```text
Wide cinematic group key art, stylized 3D render that blends semi-realistic 3D with a K-pop idol group photoshoot aesthetic: polished realistic skin with soft glow, detailed hair strands, fashionable styling. The iHC-Press team, a Thai technology and computer news desk, posing together like an idol group in a bright modern newsroom with large windows showing a Bangkok skyline, glowing wall screens with abstract charts and a world map, a gaming PC with red RGB lighting, clean white desks with black and red accents. Characters, all fictional and not resembling any real person: in the center a man in his early thirties with black two-block hair with red tips in a black double-breasted blazer holding a fountain pen; beside him a woman with a platinum-white bob and a transparent AR visor holding a small red brain hologram; a young man with a silver-gray mullet with a red streak in a black hoodie with a gaming headset around his neck holding a controller; a woman with a high black ponytail with a red underlayer in a black and red techwear jacket; a young man in a black bucket hat with a camera and red strap; a woman in a black beret holding a red pencil; a young woman with two space buns tied with red ribbons in a glossy red bomber jacket holding a smartphone; a woman with a sleek low bun and a headset microphone holding a tablet. Everyone smiling confidently toward the camera, arranged in a wide horizontal line across the middle of the frame with space above and below, waist-up framing. Palette white, black, neutral gray and brand red #C81E23, soft daylight with red rim lights. No readable text, no letters, no logos, no watermark.
```

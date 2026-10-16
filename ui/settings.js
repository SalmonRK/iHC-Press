// ตั้งค่า view: LLM profiles (switch machine/model in one click), the owner's news-source list (bots read it via list_sources),
// and YouTube -> digest (NotebookLM when installed and signed in, else the bots' LLM) with screen captures.
"use strict";
(() => {
  const { $, esc, icon, call, toast, modal, confirm, register, go } = App;
  const BEATS = { ai: "AI-โมเดล", gadget: "Gadget-ฮาร์ดแวร์", software: "ซอฟต์แวร์-แอป", startup: "สตาร์ทอัพ", security: "ไซเบอร์",
    gaming: "เกม", cloud: "คลาวด์-dev", policy: "นโยบายเทค", other: "อื่นๆ" }; // keys = newsdesk/server.mjs BEATS
  const TYPES = { web: "เว็บไซต์", rss: "RSS", youtube: "YouTube", social: "โซเชียล", other: "อื่นๆ" };
  const TABS = [["llm", "brain", "สมอง AI"], ["sources", "book", "แหล่งข่าว"], ["youtube", "play", "YouTube · NotebookLM"]];
  const field = (id, label, input, help = "") => `<div class="field"><label for="${id}">${label}</label>${input}${help ? `<div class="help">${help}</div>` : ""}<div class="err" id="${id}-err" role="alert"></div></div>`;
  const fieldErr = (root, id, msg) => { const e = $(`#${id}-err`, root); if (e) e.textContent = msg || ""; if (msg) $(`#${id}`, root)?.focus(); };
  const busy = (btn, on, label) => { if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label)}`; } else { btn.disabled = false; btn.innerHTML = btn.dataset.html; } };

  register("settings", (view, route) => {
    let tab = TABS.some(t => t[0] === route.tab) ? route.tab : "llm", alive = true;
    view.innerHTML = `
      <div class="page">
        <div class="page-head"><div><h1>ตั้งค่า</h1><div class="sub">เลือกเครื่องและโมเดลที่บอทใช้ · แหล่งข่าวที่เตรียมไว้ · สรุปคลิป YouTube</div></div></div>
        <div class="set-tabs" role="tablist" aria-label="หมวดการตั้งค่า">${TABS.map(([k, ic, l]) =>
          `<button role="tab" id="tab-${k}" aria-controls="set-body" data-tab="${k}">${icon(ic)}<span>${l}</span></button>`).join("")}</div>
        <div id="set-body" role="tabpanel" tabindex="-1"></div>
      </div>`;
    const body = $("#set-body", view);
    const show = k => {
      tab = k;
      view.querySelectorAll("[data-tab]").forEach(b => { const on = b.dataset.tab === k; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
      body.setAttribute("aria-labelledby", "tab-" + k);
      body.dataset.tab = k; // async tab code checks this before drawing: a slow answer must not land in the next tab
      ({ llm: llmTab, sources: sourcesTab, youtube: ytTab })[k](body, () => alive);
    };
    view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));
    // arrow keys move between tabs (WAI-ARIA tabs pattern)
    $(".set-tabs", view).onkeydown = e => {
      const i = TABS.findIndex(t => t[0] === tab), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const k = TABS[(i + d + TABS.length) % TABS.length][0];
      show(k); $(`[data-tab="${k}"]`, view).focus();
    };
    show(tab);
    return () => { alive = false; };
  });

  // ---------------- สมอง AI ----------------
  async function llmTab(root, alive) {
    root.innerHTML = `<div class="set-note">${icon("sparkles")}<div>บอททุกตัวใช้ <b>โปรไฟล์ที่เลือกไว้</b> เมื่อโหมดมุมซ้ายล่างเป็น <b>Local</b> · กด <b>ใช้โปรไฟล์นี้</b> แล้วแอปจะเปิดใหม่เองภายในราว 1 นาที งานที่บอทค้างอยู่จะทำต่อด้วยโมเดลใหม่</div></div>
      <div class="grid g2" id="pf-list">${'<div class="card skeleton" style="height:190px"></div>'.repeat(2)}</div>`;
    let data;
    try { data = await call("settings.profiles"); } catch (e) { if (root.dataset.tab === "llm") root.querySelector("#pf-list").innerHTML = `<div class="card"><b>อ่านโปรไฟล์ไม่ได้</b><div class="muted">${esc(e.message)}</div></div>`; return; }
    if (!alive() || root.dataset.tab !== "llm") return;
    const card = p => {
      const st = p.status, chip = st.ok ? "good" : "bad";
      return `<div class="card pf ${p.active ? "active" : ""}">
        <h3>${icon("brain")}<span class="pf-name">${esc(p.label || p.id)}</span><span class="grow"></span>
          ${p.active ? `<span class="chip good">${icon("check")}กำลังใช้</span>` : ""}
          <span class="chip ${chip}"><span class="dot ${chip}"></span>${esc(st.ok ? "พร้อม" : "ไม่พร้อม")}</span></h3>
        <div class="kv">
          <span class="dim">โมเดล</span><span class="mono">${esc(p.modelId)}</span>
          <span class="dim">เครื่อง</span><span class="mono">${esc(p.healthUrl)}</span>
          <span class="dim">ชนิด</span><span>${esc(st.kind || "-")}${st.ok ? ` · ตอบใน ${st.ms} ms` : ""}</span>
          <span class="dim">context</span><span>${p.contextWindow ? Math.round(p.contextWindow / 1024) + "K token" : "-"}${p.vision ? " · อ่านภาพได้" : ""}</span>
          <span class="dim">สถานะ</span><span class="${st.ok ? "" : "bad-text"}">${esc(st.detail)}</span>
        </div>
        <div class="pf-actions">${p.active ? `<button class="btn" data-recheck>${icon("refresh")}ตรวจอีกครั้ง</button>`
          : `<button class="btn primary" data-use="${esc(p.id)}">${icon("play")}ใช้โปรไฟล์นี้</button>
             <button class="btn ghost danger" data-del="${esc(p.id)}" aria-label="ลบโปรไฟล์ ${esc(p.label)}">${icon("trash")}ลบ</button>`}</div>
      </div>`;
    };
    root.querySelector("#pf-list").innerHTML = data.profiles.map(card).join("") +
      `<button class="card pf-add" id="pf-add">${icon("plus")}<b>เพิ่มเครื่องหรือโมเดล</b><span class="muted">ใส่ IP:port ของ Ollama, tensorfold หรือ llama-server แล้วเลือกโมเดลจากรายการ</span></button>`;
    root.querySelector("#pf-add").onclick = () => profileForm(() => llmTab(root, alive));
    root.querySelectorAll("[data-recheck]").forEach(b => b.onclick = () => llmTab(root, alive));
    root.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      const p = data.profiles.find(x => x.id === b.dataset.del);
      if (!await confirm({ title: "ลบโปรไฟล์นี้?", body: `${p.label}\n${p.modelId} @ ${p.healthUrl}\n\nลบเฉพาะการตั้งค่าในแอป ไม่กระทบเครื่องปลายทาง`, ok: "ลบ", danger: true })) return;
      try { await call("settings.profile.delete", { id: p.id }); toast("ลบโปรไฟล์แล้ว", "good"); llmTab(root, alive); } catch (e) { toast("ลบไม่สำเร็จ: " + e.message, "bad"); }
    });
    root.querySelectorAll("[data-use]").forEach(b => b.onclick = async () => {
      const p = data.profiles.find(x => x.id === b.dataset.use);
      const warn = p.status.ok ? "" : `\n\n⚠ ตอนนี้เครื่องนี้ ${p.status.detail} บอทจะทำงานไม่ได้จนกว่าเครื่องจะพร้อม`;
      if (!await confirm({ title: `สลับไปใช้ ${p.label}?`, body: `โมเดล ${p.modelId}\nเครื่อง ${p.healthUrl}\n\nแอปจะปิดแล้วเปิดใหม่เอง (ราว 30-90 วินาที) ระหว่างนั้น Rakazo จะเริ่มใหม่ด้วยค่าใหม่${warn}`, ok: "สลับและเปิดแอปใหม่" })) return;
      busy(b, true, "กำลังสลับ…");
      try {
        await call("settings.profile.use", { id: p.id });
        modal(`<h2>กำลังเปิด iHC-Press ใหม่</h2><div class="muted">สลับเป็น <b>${esc(p.label)}</b> แล้ว · หน้าต่างนี้จะปิดเองและเปิดขึ้นมาใหม่ในไม่ช้า</div><div class="restart-bar"><i></i></div>`);
      } catch (e) { busy(b, false); toast("สลับไม่สำเร็จ: " + e.message, "bad"); }
    });
  }

  function profileForm(done) {
    const m = modal(`<h2>เพิ่มเครื่องหรือโมเดล</h2><div class="muted">บอทจะเรียกเครื่องนี้ผ่านเครือข่าย (เช่น Tailscale) ต้องเปิด service ทิ้งไว้</div>
      <form id="pf-form" novalidate>
        ${field("pf-url", "ที่อยู่เซิร์ฟเวอร์ *", `<div class="row"><input class="input mono" id="pf-url" placeholder="http://100.125.52.66:11434" autocomplete="off"><button type="button" class="btn" id="pf-fetch">${icon("refresh")}ตรวจและดึงโมเดล</button></div>`,
          "Ollama ใช้ port 11434 · tensorfold / llama-server ใช้ port ของตัวเอง · ไม่ต้องใส่ /v1")}
        ${field("pf-model", "โมเดล *", `<select class="input" id="pf-model" disabled><option value="">— กดตรวจก่อน —</option></select>`)}
        ${field("pf-label", "ชื่อที่แสดง *", `<input class="input" id="pf-label" placeholder="เช่น Qwen3.6 (LocalAI-07)" maxlength="80">`)}
        <div class="grid g2" style="gap:12px">
          ${field("pf-ctx", "Context window (token)", `<input class="input num" id="pf-ctx" type="number" min="4096" step="1024" value="65536">`, "ห้ามเกินค่าที่เซิร์ฟเวอร์ตั้งไว้ (Ollama: OLLAMA_CONTEXT_LENGTH) ไม่งั้น prompt ถูกตัดเงียบ ๆ")}
          ${field("pf-max", "ตอบได้ยาวสุด (token)", `<input class="input num" id="pf-max" type="number" min="1024" step="1024" value="16384">`)}
        </div>
        <label class="check"><input type="checkbox" id="pf-vision"> โมเดลอ่านภาพได้ (vision)</label>
        ${field("pf-key", "API key (ถ้าเซิร์ฟเวอร์ต้องใช้)", `<input class="input" id="pf-key" type="password" autocomplete="off" placeholder="เว้นว่างได้">`)}
        <div class="actions"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" id="pf-save">${icon("check")}บันทึกโปรไฟล์</button></div>
      </form>`, { wide: true });
    const r = m.el, sel = $("#pf-model", r);
    $("[data-close]", r).onclick = m.close;
    const fetchModels = async () => {
      fieldErr(r, "pf-url", "");
      const b = $("#pf-fetch", r); busy(b, true, "กำลังตรวจ…");
      try {
        const res = await call("settings.models", { url: $("#pf-url", r).value });
        sel.innerHTML = res.models.length ? res.models.map(x => `<option>${esc(x)}</option>`).join("") : `<option value="">เครื่องตอบ แต่ไม่มีโมเดล</option>`;
        sel.disabled = !res.models.length;
        toast(`เจอ ${res.models.length} โมเดล (${res.kind === "ollama" ? "Ollama" : "OpenAI-compatible"})`, "good");
        if (!$("#pf-label", r).value && res.models[0]) $("#pf-label", r).value = res.models[0];
        sel.focus();
      } catch (e) { fieldErr(r, "pf-url", e.message); }
      finally { busy(b, false); }
    };
    $("#pf-fetch", r).onclick = fetchModels;
    $("#pf-url", r).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); fetchModels(); } };
    sel.onchange = () => { const l = $("#pf-label", r); if (!l.dataset.touched) l.value = sel.value; };
    $("#pf-label", r).oninput = e => { e.target.dataset.touched = 1; };
    $("#pf-form", r).onsubmit = async e => {
      e.preventDefault();
      ["pf-url", "pf-model", "pf-label"].forEach(id => fieldErr(r, id, ""));
      if (!sel.value) return fieldErr(r, "pf-model", "กด “ตรวจและดึงโมเดล” แล้วเลือกโมเดลก่อน");
      if (!$("#pf-label", r).value.trim()) return fieldErr(r, "pf-label", "ตั้งชื่อให้จำได้ เช่น ชื่อโมเดลและเครื่อง");
      const b = $("#pf-save", r); busy(b, true, "กำลังบันทึก…");
      try {
        await call("settings.profile.save", { profile: { url: $("#pf-url", r).value, modelId: sel.value, label: $("#pf-label", r).value,
          contextWindow: +$("#pf-ctx", r).value, maxTokens: +$("#pf-max", r).value, vision: $("#pf-vision", r).checked, apiKey: $("#pf-key", r).value } });
        toast("บันทึกโปรไฟล์แล้ว กด “ใช้โปรไฟล์นี้” เพื่อสลับ", "good"); m.close(); done();
      } catch (err) { busy(b, false); fieldErr(r, "pf-url", err.message); }
    };
  }

  // ---------------- แหล่งข่าว ----------------
  let srcFilter = { q: "", beat: "", type: "" };
  async function sourcesTab(root, alive) {
    root.innerHTML = `<div class="card skeleton" style="height:240px"></div>`;
    let doc;
    try { doc = await call("sources.get"); } catch (e) { if (root.dataset.tab === "sources") root.innerHTML = `<div class="card"><b>อ่านรายการแหล่งข่าวไม่ได้</b><div class="muted">${esc(e.message)}</div></div>`; return; }
    if (!alive() || root.dataset.tab !== "sources") return;
    let list = doc.sources || [];
    const save = async (next, msg) => {
      try { doc = await call("sources.save", { sources: next }); list = doc.sources; toast(msg, "good"); draw(); return true; }
      catch (e) { toast("บันทึกไม่สำเร็จ: " + e.message, "bad"); return false; }
    };
    const draw = () => {
      if (root.dataset.tab !== "sources") return;
      if (!list.length) {
        root.innerHTML = `<div class="card empty">${icon("book", "i big-i")}<h2>ยังไม่มีแหล่งข่าวที่เตรียมไว้</h2>
          <div class="muted">ใส่เว็บ ข่าวประชาสัมพันธ์ หรือช่อง YouTube ที่เชื่อถือได้ บอทนักข่าวจะไล่ดูรายการนี้ก่อนค้นเว็บทั่วไป</div>
          <div class="row" style="justify-content:center;margin-top:16px"><button class="btn primary" id="src-seed">${icon("sparkles")}ใส่ชุดเริ่มต้น (เน้นคอมพิวเตอร์และฮาร์ดแวร์)</button>
          <button class="btn" id="src-add0">${icon("plus")}เพิ่มเอง</button></div></div>`;
        $("#src-seed", root).onclick = async e => { busy(e.currentTarget, true, "กำลังใส่…"); try { doc = await call("sources.seed"); list = doc.sources; toast(`ใส่ชุดเริ่มต้น ${list.length} แหล่งแล้ว`, "good"); draw(); } catch (err) { toast(err.message, "bad"); draw(); } };
        $("#src-add0", root).onclick = () => sourceForm(null, list, save);
        return;
      }
      const q = srcFilter.q.toLowerCase();
      const shown = list.map((s, i) => ({ ...s, i })).filter(s => (!q || (s.name + " " + s.url + " " + s.note).toLowerCase().includes(q))
        && (!srcFilter.beat || !s.beats.length || s.beats.includes(srcFilter.beat)) && (!srcFilter.type || s.type === srcFilter.type));
      const on = list.filter(s => s.enabled).length;
      root.innerHTML = `
        <div class="set-note">${icon("users")}<div>บอทนักข่าวเรียกเครื่องมือ <code>list_sources</code> เพื่อดูรายการนี้ก่อนหาข่าว (ปิดไว้ = บอทไม่เห็น) · แก้แล้วมีผลทันที ไม่ต้องเปิดแอปใหม่</div></div>
        <div class="src-bar">
          <label class="search"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input id="src-q" placeholder="ค้นหาชื่อ ลิงก์ หมายเหตุ" value="${esc(srcFilter.q)}" aria-label="ค้นหาแหล่งข่าว"></label>
          <select class="input" id="src-beat" aria-label="กรองตามสาย"><option value="">ทุกสาย</option>${Object.entries(BEATS).map(([k, l]) => `<option value="${k}" ${srcFilter.beat === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          <select class="input" id="src-type" aria-label="กรองตามชนิด"><option value="">ทุกชนิด</option>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${srcFilter.type === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          <span class="muted num">${on}/${list.length} เปิดใช้</span><span class="grow"></span>
          <button class="btn primary" id="src-add">${icon("plus")}เพิ่มแหล่งข่าว</button>
        </div>
        <div class="src-list">${shown.length ? shown.map(s => `
          <div class="src ${s.enabled ? "" : "off"}">
            <label class="switch" title="${s.enabled ? "เปิดใช้อยู่" : "ปิดไว้"}"><input type="checkbox" data-toggle="${s.i}" ${s.enabled ? "checked" : ""} aria-label="เปิดใช้ ${esc(s.name)}"><span></span></label>
            <div class="src-main">
              <div class="src-name"><b>${esc(s.name)}</b><span class="chip type-${s.type}">${esc(TYPES[s.type] || s.type)}</span></div>
              <a class="src-url mono" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a>
              <div class="src-meta">${s.beats.length ? s.beats.map(b => `<span class="beat">${esc(BEATS[b] || b)}</span>`).join("") : `<span class="beat all">ทุกสาย</span>`}${s.note ? `<span class="muted">· ${esc(s.note)}</span>` : ""}</div>
            </div>
            <div class="src-actions"><button class="btn sm ghost" data-edit="${s.i}" aria-label="แก้ไข ${esc(s.name)}">${icon("edit")}แก้ไข</button>
              <button class="btn sm ghost danger" data-del="${s.i}" aria-label="ลบ ${esc(s.name)}">${icon("trash")}</button></div>
          </div>`).join("") : `<div class="card muted" style="text-align:center">ไม่มีแหล่งที่ตรงกับตัวกรอง</div>`}</div>`;
      const q$ = $("#src-q", root);
      q$.oninput = () => { srcFilter.q = q$.value; const pos = q$.selectionStart; draw(); const n = $("#src-q", root); n.focus(); n.setSelectionRange(pos, pos); };
      $("#src-beat", root).onchange = e => { srcFilter.beat = e.target.value; draw(); };
      $("#src-type", root).onchange = e => { srcFilter.type = e.target.value; draw(); };
      $("#src-add", root).onclick = () => sourceForm(null, list, save);
      root.querySelectorAll("[data-toggle]").forEach(c => c.onchange = () => {
        const next = list.map((s, i) => (i === +c.dataset.toggle ? { ...s, enabled: c.checked } : s));
        save(next, `${c.checked ? "เปิด" : "ปิด"} ${list[+c.dataset.toggle].name} แล้ว`);
      });
      root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => sourceForm(+b.dataset.edit, list, save));
      root.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
        const s = list[+b.dataset.del];
        if (!await confirm({ title: `ลบ ${s.name}?`, body: s.url, ok: "ลบ", danger: true })) return;
        save(list.filter((_, i) => i !== +b.dataset.del), `ลบ ${s.name} แล้ว`);
      });
    };
    draw();
  }

  const guessType = url => /youtube\.com|youtu\.be/i.test(url) ? "youtube" : /facebook\.com|x\.com|twitter\.com|tiktok\.com|instagram\.com|threads\.net/i.test(url) ? "social"
    : /rss|feed|\.xml(\?|$)|atom/i.test(url) ? "rss" : "web";

  function sourceForm(index, list, save) {
    const s = index == null ? { name: "", url: "", type: "web", beats: [], note: "", enabled: true } : list[index];
    const m = modal(`<h2>${index == null ? "เพิ่มแหล่งข่าว" : "แก้ไขแหล่งข่าว"}</h2>
      <form id="src-form" novalidate>
        ${field("sf-url", "ลิงก์ *", `<input class="input mono" id="sf-url" value="${esc(s.url)}" placeholder="https://newsroom.intel.com/ หรือ https://www.youtube.com/@ช่อง" autocomplete="off">`)}
        ${field("sf-name", "ชื่อ *", `<input class="input" id="sf-name" value="${esc(s.name)}" maxlength="120" placeholder="เช่น Intel Newsroom">`)}
        ${field("sf-type", "ชนิด", `<select class="input" id="sf-type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${s.type === k ? "selected" : ""}>${l}</option>`).join("")}</select>`, "เลือกให้อัตโนมัติจากลิงก์ แก้ได้")}
        <fieldset class="field beats"><legend>สายข่าวที่ใช้แหล่งนี้</legend>
          <div class="beat-pick">${Object.entries(BEATS).map(([k, l]) => `<label><input type="checkbox" value="${k}" ${s.beats.includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
          <div class="help">ไม่เลือกเลย = ใช้ได้ทุกสาย</div></fieldset>
        ${field("sf-note", "หมายเหตุสำหรับบอท", `<input class="input" id="sf-note" value="${esc(s.note)}" maxlength="300" placeholder="เช่น ข่าวลือเยอะ ต้องยืนยันกับแหล่งทางการ">`)}
        <label class="check"><input type="checkbox" id="sf-on" ${s.enabled ? "checked" : ""}> เปิดใช้ (บอทเห็นแหล่งนี้)</label>
        <div class="actions"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn primary">${icon("check")}บันทึก</button></div>
      </form>`, { wide: true });
    const r = m.el;
    $("[data-close]", r).onclick = m.close;
    $("#sf-url", r).oninput = e => { if (index == null) $("#sf-type", r).value = guessType(e.target.value); };
    $("#src-form", r).onsubmit = async e => {
      e.preventDefault();
      ["sf-url", "sf-name"].forEach(id => fieldErr(r, id, ""));
      const url = $("#sf-url", r).value.trim(), name = $("#sf-name", r).value.trim();
      if (!/^https?:\/\/\S+\.\S+/.test(url)) return fieldErr(r, "sf-url", "ใส่ลิงก์เต็มที่ขึ้นต้นด้วย https://");
      if (!name) return fieldErr(r, "sf-name", "ตั้งชื่อให้บอทอ่านเข้าใจ");
      const item = { name, url, type: $("#sf-type", r).value, note: $("#sf-note", r).value.trim(), enabled: $("#sf-on", r).checked,
        beats: [...r.querySelectorAll(".beat-pick input:checked")].map(c => c.value) };
      const next = index == null ? [...list, item] : list.map((x, i) => (i === index ? item : x));
      if (await save(next, index == null ? `เพิ่ม ${name} แล้ว` : `บันทึก ${name} แล้ว`)) m.close();
    };
  }

  // ---------------- YouTube · NotebookLM ----------------
  async function ytTab(root, alive) {
    root.innerHTML = `
      <div class="grid g2 yt-top">
        <div class="card" id="yt-tools"><h3>${icon("terminal")}เครื่องมือที่ต้องมี<span class="grow"></span><button class="btn sm ghost" id="yt-recheck">${icon("refresh")}ตรวจใหม่</button></h3><div class="skeleton" style="height:180px"></div></div>
        <div class="card"><h3>${icon("play")}สรุปคลิปจากลิงก์</h3>
          <form id="yt-form" class="row" novalidate><input class="input" id="yt-url" placeholder="https://www.youtube.com/watch?v=…" aria-label="ลิงก์คลิป YouTube" autocomplete="off">
            <button class="btn primary" id="yt-go">${icon("sparkles")}สรุปคลิป</button></form>
          <div class="err" id="yt-url-err" role="alert"></div>
          <div class="muted yt-steps" id="yt-steps">ได้: สรุปภาษาไทย · ประเด็นสำคัญพร้อมเวลา · ภาพหน้าจอ ณ เวลานั้น · ข้ออ้างที่ต้องตรวจ<br>ปกติใช้ 15-60 วินาที (คลิปยาวใช้นานขึ้นเพราะต้องดาวน์โหลดภาพ)</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><h3>${icon("inbox")}คลิปที่สรุปแล้ว<span class="grow"></span><button class="btn sm ghost" id="yt-open">${icon("folder")}เปิดโฟลเดอร์</button></h3><div id="yt-list" class="skeleton" style="height:80px"></div></div>`;
    $("#yt-recheck", root).onclick = () => tools(root);
    $("#yt-open", root).onclick = () => call("yt.folder", { id: "" });
    $("#yt-form", root).onsubmit = async e => {
      e.preventDefault();
      const url = $("#yt-url", root).value.trim();
      fieldErr(root, "yt-url", "");
      if (!/(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}/.test(url)) return fieldErr(root, "yt-url", "ใส่ลิงก์คลิป (watch?v=…, youtu.be/…, shorts/…) ไม่ใช่ลิงก์ช่อง");
      const b = $("#yt-go", root); busy(b, true, "กำลังสรุป…");
      const steps = $("#yt-steps", root), t0 = Date.now(), tick = setInterval(() => { steps.innerHTML = `<span class="shimmer-text">อ่านข้อมูลคลิป → คำบรรยาย → สรุป → จับภาพหน้าจอ · ${Math.round((Date.now() - t0) / 1000)} วินาที</span>`; }, 500);
      try { const r = await call("yt.digest", { url }); toast(`สรุปแล้ว: ${r.points} ประเด็น · ${r.frames} ภาพ`, "good"); $("#yt-url", root).value = ""; await list(root); reader(r.id); }
      catch (err) { fieldErr(root, "yt-url", "สรุปไม่สำเร็จ: " + err.message); }
      finally { clearInterval(tick); busy(b, false); steps.textContent = `เสร็จใน ${Math.round((Date.now() - t0) / 1000)} วินาที`; }
    };
    tools(root); list(root);
    // bots queue clips too: keep the list fresh while this tab is open
    const iv = setInterval(() => { if (!alive() || !document.body.contains(root) || !$("#yt-list", root)) return clearInterval(iv); list(root); }, 15000);
  }

  async function tools(root) {
    const box = $("#yt-tools", root);
    if (!box) return;
    box.querySelector(".tool-list, .skeleton")?.replaceWith(Object.assign(document.createElement("div"), { className: "skeleton", style: "height:180px" }));
    let s;
    try { s = await call("tools.status"); } catch (e) { if (box.isConnected) box.querySelector(".skeleton").outerHTML = `<div class="muted">${esc(e.message)}</div>`; return; }
    if (!box.isConnected) return;
    const t = s.tools, row = (ok, name, why, extra = "") => `<li class="${ok ? "ok" : "no"}"><span class="tk" aria-hidden="true">${ok ? icon("check") : icon("x")}</span>
      <div><b>${name}</b> <span class="muted">${why}</span>${extra}</div><span class="sr-only">${ok ? "พร้อม" : "ยังไม่พร้อม"}</span></li>`;
    const ver = x => (x.ok ? `<span class="mono dim"> ${esc(x.version.replace(/\s*\(.*$/, ""))}</span>` : "");
    box.querySelector(".skeleton").outerHTML = `<div class="tool-list"><ul>
        ${row(t.node.ok, "Node.js", "รันสคริปต์สรุปคลิป", ver(t.node))}
        ${row(t.ytdlp.ok, "yt-dlp", "อ่านข้อมูล คำบรรยาย และดาวน์โหลดภาพ", ver(t.ytdlp) + (t.ytdlp.ok ? "" : `<div class="cmd">pip install -U yt-dlp</div>`))}
        ${row(t.ffmpeg.ok, "ffmpeg", "จับภาพหน้าจอจากคลิป", t.ffmpeg.ok ? "" : `<div class="cmd">winget install Gyan.FFmpeg</div>`)}
        ${row(t.uv.ok, "uv", "ใช้ติดตั้ง NotebookLM", ver(t.uv) + (t.uv.ok ? "" : `<div class="cmd">winget install astral-sh.uv</div>`))}
        ${row(t.notebooklm.ok, "notebooklm-py", "ตัวเชื่อม NotebookLM (ไม่ใช่ของ Google อย่างเป็นทางการ)", t.notebooklm.ok ? ver(t.notebooklm)
          : `<div class="row" style="margin-top:6px"><button class="btn sm" id="nlm-install" ${t.uv.ok ? "" : "disabled"}>${icon("plus")}ติดตั้ง</button><span class="cmd">uv tool install "notebooklm-py[browser]"</span></div>`)}
        ${row(s.notebooklmAuth, "บัญชี Google ใน NotebookLM", "ล็อกอินครั้งเดียว", s.notebooklmAuth ? "" : `<div class="row" style="margin-top:6px"><button class="btn sm" id="nlm-login" ${t.notebooklm.ok ? "" : "disabled"}>${icon("external")}เข้าสู่ระบบ Google</button></div>`)}
      </ul>
      <div class="engine">ตัวสรุปตอนนี้: <b>${s.notebooklmAuth ? "NotebookLM" : "LLM ของบอท (" + esc(s.engine.replace(/^llm:/, "")) + ")"}</b>${s.notebooklmAuth ? " · ถ้า NotebookLM ล้มเหลวจะใช้ LLM แทน" : " · ติดตั้งและล็อกอิน NotebookLM แล้วจะสลับให้อัตโนมัติ"}</div></div>`;
    $("#nlm-install", box)?.addEventListener("click", async () => {
      if (!await confirm({ title: "ติดตั้ง notebooklm-py?", body: "เป็นโปรแกรมโอเพนซอร์สที่ไม่ใช่ของ Google (ใช้ API ภายในของ NotebookLM ซึ่ง Google เปลี่ยนได้ทุกเมื่อ)\nจะเปิดหน้าต่างคำสั่งให้ดูการติดตั้ง (~30 วินาที และดาวน์โหลด Chromium ~170 MB ตอนล็อกอินครั้งแรก)\n\nแนะนำให้ใช้บัญชี Google แยกสำหรับงานนี้", ok: "ติดตั้ง" })) return;
      try { await call("nlm.install"); toast("เปิดหน้าต่างติดตั้งแล้ว ติดตั้งเสร็จกด “ตรวจใหม่”", "good"); } catch (e) { toast(e.message, "bad"); }
    });
    $("#nlm-login", box)?.addEventListener("click", async () => {
      try { await call("nlm.login"); toast("ล็อกอิน Google ในหน้าต่างเบราว์เซอร์ที่เปิดขึ้น เสร็จแล้วกด “ตรวจใหม่”", "good"); } catch (e) { toast(e.message, "bad"); }
    });
  }

  async function list(root) {
    const el = $("#yt-list", root);
    if (!el) return;
    let r;
    try { r = await call("yt.list"); } catch (e) { if (!el.isConnected) return; el.className = ""; el.innerHTML = `<div class="muted">${esc(e.message)}</div>`; return; }
    if (!el.isConnected) return;
    el.className = "";
    const q = r.queued.map(x => `<div class="yt-row pending"><span class="spin"></span><div><b>${esc(x.id)}</b><div class="muted">${r.busy === x.id ? "กำลังสรุป" : "รอคิว"} · ขอโดย ${esc(x.by || "-")}</div></div></div>`).join("");
    el.innerHTML = q + (r.done.length ? r.done.map(d => `<button class="yt-row" data-yt="${esc(d.id)}">
        <span class="yt-thumb" aria-hidden="true">${icon("play")}</span>
        <div class="grow"><b>${esc(d.title)}</b><div class="muted">${esc(d.channel)} · ${d.points} ประเด็น · ${d.frames} ภาพ · ${esc(App.relTime(d.at))}</div></div>
        <span class="chip">${esc(String(d.engine).startsWith("notebooklm") ? "NotebookLM" : "LLM")}</span>${icon("chevron")}</button>`).join("")
      : (q ? "" : `<div class="muted" style="padding:8px 2px">ยังไม่มีคลิปที่สรุป · วางลิงก์ด้านบน หรือให้บอทเรียก youtube_digest</div>`));
    el.querySelectorAll("[data-yt]").forEach(b => b.onclick = () => reader(b.dataset.yt));
  }

  async function reader(id) {
    let d;
    try { d = await call("yt.get", { id }); } catch (e) { return toast("เปิดสรุปไม่ได้: " + e.message, "bad"); }
    const secs = t => t.split(":").reduce((a, n) => a * 60 + +n, 0);
    const shot = p => d.frames.find(f => f.t === p.t);
    const m = modal(`<div class="muted">${esc(d.channel)} · ${esc(d.uploaded)} · สรุปโดย ${esc(d.engine)}</div><h2 class="headline">${esc(d.title)}</h2>
      <div class="reader-sec"><h3>สรุป</h3><div class="md">${esc(d.summary)}</div></div>
      <div class="reader-sec"><h3>ประเด็นสำคัญและภาพหน้าจอ</h3><div class="yt-points">${d.key_points.map(p => `<figure class="yt-point">
        ${shot(p)?.src ? `<img src="${shot(p).src}" alt="ภาพหน้าจอคลิปที่ ${esc(p.t)}">` : `<div class="yt-noshot">ไม่มีภาพ</div>`}
        <figcaption><a href="${esc(d.url)}&t=${secs(p.t)}s" target="_blank" rel="noopener" class="ts">${esc(p.t)}</a> ${esc(p.point)}</figcaption></figure>`).join("")}</div></div>
      <div class="reader-sec"><h3>มุมข่าว</h3><p>${esc(d.news_angle || "-")}</p></div>
      ${d.claims_to_verify?.length ? `<div class="reader-sec"><h3>ต้องตรวจกับแหล่งต้นทาง</h3><ul>${d.claims_to_verify.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      <div class="muted" style="margin-top:12px">ภาพหน้าจอเป็นของช่อง ${esc(d.channel)} ใช้ประกอบข่าวต้องให้เครดิตและลิงก์คลิป</div>
      <div class="actions"><button class="btn" data-folder>${icon("folder")}เปิดโฟลเดอร์</button><a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">${icon("external")}เปิดคลิป</a><button class="btn primary" data-close>ปิด</button></div>`, { wide: true });
    $("[data-close]", m.el).onclick = m.close;
    $("[data-folder]", m.el).onclick = () => call("yt.folder", { id });
  }

  // sidebar entry point
  App.openSettings = tab => go({ type: "settings", tab });
})();

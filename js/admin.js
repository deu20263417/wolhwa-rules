/* 월화 규칙 포털 — 관리자 편집
   권한: 페이지 소유자와 편집 권한자(admin)만 편집 화면을 보고 저장할 수 있다.
   저장소 규칙(db rules)도 write:"admin" 이라, 화면을 우회해도 일반 방문자는 쓸 수 없다.
   저장 위치: docs/<문서키> {md, updatedAt, by, note} · 편집 기록: edits/<자동 id> */
(function () {
  const S = WH.adminState = { checked: false, canEdit: false, db: null, user: null, uid: null, sel: "RULES", drafts: {}, confirmRevert: false };
  const LABEL = { RULES: "전체 규칙", WAR_RULES: "전쟁·약탈 세부", PENALTY: "제재 기준", CASES: "판정집", FAQ: "FAQ", CHANGELOG: "변경 이력", NOTICE: "공지" };
  const $ = (s, el = document) => el.querySelector(s);
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  async function init() {
    const C = window.claude;
    if (!C || typeof C.use !== "function") { S.checked = true; return; }
    try {
      const [user, db] = await Promise.all([C.use("user"), C.use("db")]);
      S.user = user; S.db = db;
      if (user) { S.canEdit = !!(await user.canEdit()); try { S.uid = await user.id(); } catch {} }
    } catch { /* 권한 없음으로 처리 */ }
    S.checked = true;
    if (S.canEdit) { document.body.classList.add("is-admin"); }
    if (S.db) {
      try {
        const snap = await withTimeout(S.db.collection("docs").get(), 10000);
        let changed = false;
        snap.docs.forEach(d => { const v = d.exists && d.data(); if (v && typeof v.md === "string" && WH.DOC_KEYS.includes(d.id)) { WH.setOverride(d.id, v); changed = true; } });
        if (changed) { WH.refresh(); return; }
      } catch { /* 저장소에 닿지 않으면 원본 파일로 계속 표시 */ }
    }
    WH.rerenderSide();
  }

  function stats(key, md) {
    const r = /^### 제\d+조/gm, c = /^## 제\d+장/gm, cs = /^### 사례 \d+/gm, q = /^\*\*Q\./gm;
    const n = re => (md.match(re) || []).length;
    if (key === "RULES") return { ok: n(r) > 0 && n(c) > 0, text: `장 ${n(c)}개 · 조 ${n(r)}개` };
    if (key === "CASES") return { ok: n(cs) > 0, text: `사례 ${n(cs)}건` };
    if (key === "FAQ") return { ok: n(q) > 0, text: `질문 ${n(q)}개` };
    return { ok: md.trim().length > 0, text: `${md.length.toLocaleString()}자` };
  }

  WH.renderAdmin = function (root) {
    if (!root) return;
    if (!S.checked) { root.innerHTML = `<div class="lock"><p class="muted">권한을 확인하고 있어요…</p></div>`; return; }
    if (!S.canEdit) {
      root.innerHTML = `<div class="lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        <h1 class="serif" style="font-size:28px">운영진 전용 화면입니다</h1>
        <p class="muted" style="margin-top:10px">규칙 편집은 이 페이지의 소유자와 편집 권한을 받은 운영진만 할 수 있어요. 규칙에 문제가 있으면 디스코드 신고 티켓으로 알려 주세요.</p>
        <p style="margin-top:20px"><a class="btn-sm" href="#rules" style="display:inline-flex;align-items:center;text-decoration:none">전체 규칙 보기</a></p></div>`;
      return;
    }
    if (!S.db) { root.innerHTML = `<div class="lock"><h1 class="serif" style="font-size:28px">저장소에 연결할 수 없어요</h1><p class="muted" style="margin-top:10px">로그인 상태를 확인하고 새로고침해 주세요. 그동안 규칙은 원본 파일로 표시됩니다.</p></div>`; return; }

    const key = S.sel, info = WH.model.overrideInfo(key);
    const cur = S.drafts[key] ?? WH.model.md(key);
    root.innerHTML = `
      <div class="page-head"><p class="eyebrow">ADMIN</p><h1>규칙 편집</h1>
        <p class="desc">이 화면은 소유자와 편집 권한자에게만 보입니다. 저장하면 모든 방문자에게 바로 적용되고, 원본 파일(data/${key}.md)은 그대로 남아 언제든 되돌릴 수 있어요. 큰 변경은 CHANGELOG에도 기록하세요 (제65조).</p></div>
      <div class="admin-bar">
        <label class="field">문서<select id="adDoc">${WH.DOC_KEYS.map(k => `<option value="${k}" ${k === key ? "selected" : ""}>${LABEL[k]} (${k}.md)${WH.model.overridden(k) ? " · 수정본" : ""}</option>`).join("")}</select></label>
        <label class="field" style="flex:1;min-width:220px">변경 사유 (필수)<input id="adNote" type="text" maxlength="120" placeholder="예: 제17조 TNT 상한 64 → 48 조정"></label>
        <button class="btn-sm primary" id="adSave" type="button">저장하고 적용</button>
        <button class="btn-sm danger" id="adRevert" type="button" ${info ? "" : "disabled"}>원본으로 되돌리기</button>
      </div>
      <p class="status" id="adStatus" style="margin-top:10px">${info ? `수정본 적용 중 · ${WH.esc((info.updatedAt || "").replace("T", " ").slice(0, 16))}${info.note ? " · " + WH.esc(info.note) : ""}` : "원본 파일 표시 중"}</p>
      <div class="admin-grid">
        <label class="sr" for="adText">마크다운</label>
        <textarea id="adText" spellcheck="false">${WH.esc(cur)}</textarea>
        <div class="admin-preview prose" id="adPreview" aria-label="미리보기"></div>
      </div>
      <h2 class="serif" style="font-size:20px;margin-top:40px">최근 편집 기록</h2>
      <ul class="history" id="adHistory"><li class="muted">불러오는 중…</li></ul>`;

    const ta = $("#adText"), pv = $("#adPreview"), st = $("#adStatus");
    let t;
    const preview = () => { pv.innerHTML = WH.mdHtml(ta.value); WH.enhance(pv); const s = stats(key, ta.value); st.dataset.check = s.text; st.textContent = st.textContent.split(" · 검사:")[0] + " · 검사: " + s.text + (s.ok ? "" : " (형식 확인 필요)"); st.className = "status" + (s.ok ? "" : " err"); };
    preview();
    ta.addEventListener("input", () => { S.drafts[key] = ta.value; clearTimeout(t); t = setTimeout(preview, 300); });
    $("#adDoc").addEventListener("change", e => { S.sel = e.target.value; S.confirmRevert = false; WH.renderAdmin(root); });

    $("#adSave").addEventListener("click", async e => {
      const note = $("#adNote").value.trim(), md = ta.value, s = stats(key, md);
      if (!note) { st.className = "status err"; st.textContent = "변경 사유를 적어 주세요."; $("#adNote").focus(); return; }
      if (!s.ok) { st.className = "status err"; st.textContent = `저장하지 않았어요. 문서 형식을 확인하세요 (${s.text}). 제목 형식(## 제N장, ### 제N조 (제목))이 바뀌면 화면에 표시되지 않아요.`; return; }
      if (md === WH.model.md(key)) { st.className = "status"; st.textContent = "바뀐 내용이 없어요."; return; }
      e.target.disabled = true; st.className = "status"; st.textContent = "저장 중…";
      const now = new Date().toISOString();
      try {
        await S.db.doc("docs/" + key).set({ md, updatedAt: now, by: S.uid || "", note });
        try { await S.db.collection("edits").add({ doc: key, at: now, by: S.uid || "", note, chars: md.length }); } catch {}
        WH.setOverride(key, { md, updatedAt: now, by: S.uid, note });
        delete S.drafts[key];
        WH.toast("저장했어요 · 모든 방문자에게 적용됩니다");
        WH.refresh();
      } catch (err) {
        e.target.disabled = false; st.className = "status err";
        st.textContent = err && err.code === "invalid_argument" ? "저장 권한이 없거나 문서가 너무 커요 (256KB 이하)." : err && err.code === "quota_exceeded" ? "저장 공간이 가득 찼어요." : "저장하지 못했어요. 잠시 뒤 다시 시도하세요.";
      }
    });

    $("#adRevert").addEventListener("click", async e => {
      if (!S.confirmRevert) { S.confirmRevert = true; e.target.textContent = "한 번 더 누르면 원본으로 돌아갑니다"; return; }
      e.target.disabled = true;
      try {
        await S.db.doc("docs/" + key).delete();
        try { await S.db.collection("edits").add({ doc: key, at: new Date().toISOString(), by: S.uid || "", note: "원본 파일로 되돌림", chars: 0 }); } catch {}
        WH.setOverride(key, null); delete S.drafts[key]; S.confirmRevert = false;
        WH.toast("원본 파일로 되돌렸어요"); WH.refresh();
      } catch { e.target.disabled = false; st.className = "status err"; st.textContent = "되돌리지 못했어요. 잠시 뒤 다시 시도하세요."; }
    });

    withTimeout(S.db.collection("edits").orderBy("at", "desc").limit(20).get(), 10000).then(async snap => {
      const rows = snap.docs.map(d => d.data()).filter(Boolean);
      let names = {};
      try { if (S.user && S.user.profiles) { const ps = await S.user.profiles([...new Set(rows.map(r => r.by).filter(Boolean))]); Object.keys(ps || {}).forEach(id => { names[id] = ps[id].name; }); } } catch {}
      const h = $("#adHistory"); if (!h) return;
      h.innerHTML = rows.length ? rows.map(r => `<li><span class="muted">${WH.esc((r.at || "").replace("T", " ").slice(0, 16))}</span><span>${WH.esc(LABEL[r.doc] || r.doc)}</span><span>${WH.esc(r.note || "")} <span class="muted">· ${WH.esc(names[r.by] || "운영진")}</span></span></li>`).join("") : `<li class="muted">아직 편집 기록이 없어요.</li>`;
    }).catch(() => { const h = $("#adHistory"); if (h) h.innerHTML = `<li class="muted">기록을 불러오지 못했어요.</li>`; });
  };

  const start = () => init().then(() => { if (location.hash === "#admin") WH.refresh(); });
  if (WH.ready) start(); else document.addEventListener("wh:ready", start, { once: true });
})();

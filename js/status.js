/* 월화 서버 상태
   설정: data/site.json 의 "status"
   - endpoint: 운영진 백엔드(예: backend/worker.js)의 주소. 있으면 이것을 쓴다.
   - address + edition: 백엔드가 없으면 공개 조회 서비스(mcsrvstat.us)로 조회한다.
   - maintenance / maintenanceNote: 점검 표시 (조회보다 우선)
   어떤 경우에도 실패는 조용히 처리하고, 규칙 페이지는 그대로 동작한다. 비밀 값은 이 파일에 두지 않는다. */
(function () {
  const CACHE_KEY = "wolhwa-status";
  let cfg = {}, last = null, timer = 0;

  function url() {
    if (cfg.endpoint) return cfg.endpoint;
    if (!cfg.address) return null;
    const base = cfg.edition === "bedrock" ? "https://api.mcsrvstat.us/bedrock/3/" : "https://api.mcsrvstat.us/3/";
    return base + encodeURIComponent(cfg.address.trim());
  }
  function normalize(d) {
    if (!d || typeof d !== "object") throw new Error("bad");
    const motd = d.motd && (Array.isArray(d.motd.clean) ? d.motd.clean.join(" ") : d.motd.clean || d.motd);
    return {
      online: !!d.online,
      players: d.players ? { online: +d.players.online || 0, max: +d.players.max || 0 } : null,
      version: typeof d.version === "string" ? d.version.replace(/§./g, "") : (d.version && d.version.name) || "",
      motd: typeof motd === "string" ? motd.replace(/§./g, "").trim().slice(0, 120) : "",
      at: Date.now(),
    };
  }
  async function fetchStatus() {
    const u = url(); if (!u) return null;
    try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); if (c && c.u === u && Date.now() - c.v.at < (cfg.refreshSec || 60) * 1000) return c.v; } catch {}
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
    try {
      const r = await fetch(u, { signal: ac.signal, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("http " + r.status);
      const v = normalize(await r.json());
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ u, v })); } catch {}
      return v;
    } finally { clearTimeout(t); }
  }

  function view() {
    if (cfg.maintenance) return { cls: "maint", state: "점검 중", detail: cfg.maintenanceNote || "점검이 끝나면 공지로 알려드립니다.", mini: "점검 중" };
    if (!url()) return { cls: "unset", state: "서버 주소 준비 중", detail: "주소가 정해지면 접속 인원과 버전을 여기에 표시합니다.", mini: "주소 준비 중" };
    if (last === null) return { cls: "", state: "서버 상태 확인 중", detail: "", mini: "확인 중" };
    if (last === "error") return { cls: "unknown", state: "상태를 확인할 수 없어요", detail: "조회 서비스에 연결하지 못했어요. 규칙 열람은 정상입니다.", mini: "확인 불가" };
    if (!last.online) return { cls: "off", state: "서버 오프라인", detail: "지금은 접속할 수 없어요.", mini: "오프라인" };
    const p = last.players ? `접속 ${last.players.online} / ${last.players.max}명` : "";
    return { cls: "on", state: "서버 온라인", detail: [p, last.version && "버전 " + last.version, last.motd].filter(Boolean).join(" · "), mini: p ? "온라인 · " + p : "온라인" };
  }
  function paint() {
    const v = view();
    document.querySelectorAll("[data-srv]").forEach(el => {
      el.className = "srv " + v.cls;
      const s = el.querySelector("[data-srv-state]"), d = el.querySelector("[data-srv-detail]"), c = el.querySelector("[data-srv-copy]");
      if (s) s.textContent = v.state; if (d) d.textContent = v.detail;
      if (c) c.hidden = !cfg.address;
    });
    document.querySelectorAll("[data-srv-mini]").forEach(el => { el.textContent = v.mini; el.dataset.state = v.cls; });
  }
  async function tick() {
    if (document.hidden) return;
    if (!cfg.maintenance && url()) { try { last = (await fetchStatus()) || "error"; } catch { last = "error"; } }
    paint();
  }
  document.addEventListener("click", async e => {
    if (!e.target.closest("[data-srv-copy]")) return;
    try { await navigator.clipboard.writeText(cfg.address); WH.toast && WH.toast("서버 주소를 복사했어요"); }
    catch { WH.toast && WH.toast("주소: " + cfg.address); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

  window.WH = window.WH || {};
  WH.status = {
    start(c) { cfg = c || {}; paint(); tick(); clearInterval(timer); timer = setInterval(tick, Math.max(30, cfg.refreshSec || 60) * 1000); },
    paint,
    _normalize: normalize,
  };
})();

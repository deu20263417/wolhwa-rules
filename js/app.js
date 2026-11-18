/* 월화 규칙 포털 — 화면, 라우팅, 검색 */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((.+?)\)/g, "$1");
  const pad = n => String(n).padStart(2, "0");
  const view = $("#view");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ICON = {
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    fold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  };
  const DOC_ROUTE = { RULES: "rules", WAR_RULES: "war", PENALTY: "penalty", CASES: "cases", FAQ: "faq", CHANGELOG: "changelog", NOTICE: "notice", REPORT: "report" };
  const PAGE_META = {
    rules: ["전체 규칙", "RULES"], war: ["전쟁·약탈 세부", "WAR_RULES"], penalty: ["제재 안내", "PENALTY"],
    cases: ["사례별 판정집", "CASES"], faq: ["자주 묻는 질문", "FAQ"], changelog: ["규칙 변경 이력", "CHANGELOG"],
    notice: ["공지", "NOTICE"], report: ["신고·문의 안내", "REPORT"], admin: ["규칙 편집", null],
  };
  let M, cleanup = [], state = { page: null, chapter: null };

  /* ───────── 공통 ───────── */
  let toastT;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch { toast("복사할 수 없어요. 주소창의 링크를 직접 복사하세요."); }
  }
  const inArtifact = /claude|anthropic/.test(location.hostname) || location.protocol === "blob:" || location.origin === "null";
  const linkOf = id => ((inArtifact && M.site.shareUrl) || location.href.split("#")[0]) + "#" + id;

  function mdHtml(md) {
    try { return window.marked ? marked.parse(md, { mangle: false, headerIds: false }) : "<pre>" + esc(md) + "</pre>"; }
    catch { return "<pre>" + esc(md) + "</pre>"; }
  }
  // 렌더된 본문 정리: 표 감싸기, 문서 링크 → 라우트, "제N조" → 규칙 링크
  function enhance(root, { headPrefix } = {}) {
    $$("table", root).forEach(t => { if (!t.parentElement.classList.contains("tw")) { const w = document.createElement("div"); w.className = "tw"; t.replaceWith(w); w.appendChild(t); } });
    $$("a[href]", root).forEach(a => {
      const m = a.getAttribute("href").match(/^([A-Z_]+)\.md$/);
      if (m && DOC_ROUTE[m[1]]) a.setAttribute("href", "#" + DOC_ROUTE[m[1]]);
      else if (/^https?:/.test(a.getAttribute("href"))) { a.target = "_blank"; a.rel = "noopener"; }
    });
    if (headPrefix) $$("h2,h3", root).forEach((h, i) => { h.id = headPrefix + "-s" + i; });
    const keys = new Set(M.articles.map(a => a.key));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (/제\d+조/.test(n.nodeValue) && !n.parentElement.closest("a,code,pre,h1,h2,h3,.art-no")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment(); let last = 0; const s = node.nodeValue;
      s.replace(/제(\d+)조(?:의(\d+))?/g, (m0, num, sub, idx) => {
        const key = sub ? num + "-" + sub : num;
        if (!keys.has(key)) return m0;
        frag.append(s.slice(last, idx));
        const a = document.createElement("a"); a.className = "rule-ref"; a.href = "#rule-" + key; a.textContent = m0; frag.append(a);
        last = idx + m0.length; return m0;
      });
      frag.append(s.slice(last)); node.replaceWith(frag);
    });
    return root;
  }
  const pillOf = v => ({ ok: "허용", no: "위반", mid: "조건부" }[v]);

  function markIn(root, q) {
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 0 && !/^제?\d+조?$/.test(t));
    if (!terms.length) return;
    const re = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
    const reT = new RegExp(re.source, "i");
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => reT.test(n.nodeValue) && !n.parentElement.closest("mark,button") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(node => { re.lastIndex = 0; const span = document.createElement("span"); span.innerHTML = esc(node.nodeValue).replace(re, m => `<mark class="hit">${m}</mark>`); node.replaceWith(...span.childNodes); });
  }

  /* ───────── 라우팅 ───────── */
  function route(hash) {
    const h = decodeURIComponent((hash || "").replace(/^#/, ""));
    let m;
    if (!h || h === "home") return { page: "home" };
    if (h === "rules") return { page: "rules", chapter: 1 };
    if ((m = h.match(/^ch-(\d+)$/))) return { page: "rules", chapter: +m[1] };
    if ((m = h.match(/^rule-(\d+(?:-\d+)?)$/))) { const a = M.artByKey(m[1]); return a ? { page: "rules", chapter: a.chapter, target: h } : { page: "rules", chapter: 1 }; }
    if (/^pen-/.test(h)) return { page: "penalty", target: h };
    if (/^case-\d+$/.test(h)) return { page: "cases", target: h };
    if (/^faq-g?\d+$/.test(h)) return { page: "faq", target: h };
    if ((m = h.match(/^(war|penalty|changelog|notice|report)-s?\d+$/))) return { page: m[1], target: h };
    if (PAGE_META[h] || h === "home") return { page: h };
    return { page: "home" };
  }
  function go() {
    if (!M) return;
    const r = route(location.hash);
    closeDrawer();
    const same = r.page === state.page && (r.page !== "rules" || r.chapter === state.chapter) && view.childElementCount;
    if (!same) render(r);
    if (r.target) jump(r.target, true);
    else if (!same) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    markNav(r.page);
  }
  function jump(id, flash) {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.classList.contains("case")) el.classList.add("open");
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (flash) { const f = el.querySelector(".art-head") || el; f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
      if (WH.lastQuery) { markIn(el.closest("article,li,tr") || el, WH.lastQuery); WH.lastQuery = ""; }
    });
  }
  function markNav(page) {
    const top = ["rules", "war", "cases", "changelog", "notice"].includes(page) ? "rules" : page;
    $$(".gnb a").forEach(a => { if (a.dataset.nav === top) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $$(".tabbar [data-tab]").forEach(a => a.classList.toggle("on", a.dataset.tab === (page === "home" ? "home" : page === "penalty" ? "penalty" : top === "rules" ? "rules" : "")));
  }

  function render(r) {
    cleanup.forEach(f => f()); cleanup = [];
    state = { page: r.page, chapter: r.chapter || null };
    let html;
    if (r.page === "home") html = homeView();
    else html = docsLayout(r);
    view.innerHTML = html;
    view.classList.remove("enter"); void view.offsetWidth; if (!reduce) view.classList.add("enter");
    if (r.page === "home") afterHome(); else afterDocs(r);
    document.dispatchEvent(new Event("wh:render"));
    document.title = r.page === "home" ? "월화서버" : (r.page === "rules" ? `제${r.chapter}장 ${chapterOf(r.chapter)?.title || ""}` : PAGE_META[r.page][0]) + " · 월화";
    onScroll();
  }
  const chapterOf = n => M.rules.chapters.find(c => c.no === n);

  /* ───────── 홈 ───────── */
  function homeView() {
    const s = M.site, n = M.notices[0];
    const firstTable = (() => { const m = M.md("WAR_RULES").match(/## 1\.[^\n]*\n+(\|[\s\S]*?)\n\n/); return m ? m[1] : ""; })();
    const sev = M.artByKey("60");
    const sevItems = sev ? [...sev.md.matchAll(/^- (.+)$/gm)].map(m => m[1]) : [];
    const ladder = (() => { const a = M.artByKey("59"); return a ? [...a.md.matchAll(/^\| (\d단계) \| (.+?) \|/gm)].map(m => [m[1], m[2]]) : []; })();
    return `
    <section class="hero" id="hero" aria-labelledby="heroTitle">
      <div class="kv">
        <picture>
          <source type="image/webp" srcset="img/hero-800.webp 800w, img/hero-1200.webp 1200w, img/hero-1672.webp 1672w" sizes="100vw">
          <img id="kvImg" src="img/hero-1200.jpg" width="1672" height="941" fetchpriority="high" decoding="async" alt="월화 키 비주얼. 보름달과 벚꽃 아래 한옥, 월화 로고와 보랏빛 물약">
        </picture>
        <canvas id="petals" aria-hidden="true"></canvas>
      </div>
      <div class="wrap hero-body">
        <h1 id="heroTitle" class="sr">${esc(s.name)} ${esc(s.hanja)} · ${esc(s.subtitle)}</h1>
        <div class="hero-row">
          <div>
            <p class="kicker">${esc(s.hanja)} · ${esc(s.english)}</p>
            <h2>${esc(s.tagline).replace("전쟁은", "<em>전쟁은</em>")}</h2>
            <p class="lead">${esc(s.subtitle)}. 등록한 거점은 지켜지고, 공식 전쟁에서만 문이 열립니다.</p>
          </div>
          <div>
            <div class="ctas">
              <a class="btn btn-gold" href="#rules">규칙 확인하기</a>
              <a class="btn btn-line" href="#war">전쟁 절차 보기</a>
            </div>
            <button class="hero-search" type="button" data-open-search>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              규칙 번호나 단어로 찾기<span class="ex">&nbsp;· 예: 33, 철수, 엔더 상자</span><kbd>/</kbd>
            </button>
          </div>
        </div>
        <div class="srv" data-srv aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          <b data-srv-state>서버 상태 확인 중</b>
          <span class="srv-detail" data-srv-detail></span>
          <button class="srv-copy" type="button" data-srv-copy hidden>주소 복사</button>
        </div>
        <div class="hero-stats">
          ${s.keyNumbers.map(([b, t, h]) => `<a href="#${esc(h)}"><b>${esc(b)}</b><span>${esc(t)}</span></a>`).join("")}
        </div>
      </div>
      <div class="lattice" aria-hidden="true"></div>
    </section>

    <div class="wrap">
      ${n ? `<a class="notice-bar" href="#notice-1"><span class="tag">공지</span><time>${esc(n.date)}</time><b>${esc(n.title)}</b></a>` : ""}

      <section class="home-sec" aria-labelledby="catTitle">
        <div class="sec-title"><div><p class="eyebrow">CATEGORIES</p><h2 id="catTitle">규칙 카테고리</h2></div><a href="#rules">전체 규칙 보기 →</a></div>
        <div class="cat-grid">
          ${M.rules.chapters.map(c => { const a = c.articles; return `<a href="#ch-${c.no}"><span class="no">제${c.no}장</span><b>${esc(c.title)}</b><span>${a.length ? `${a[0].label} ~ ${a[a.length - 1].label} · ${a.length}개 조항` : "안내"}</span></a>`; }).join("")}
          <a href="#cases"><span class="no">판정</span><b>사례별 판정집</b><span>${M.cases.length}건</span></a>
          <a href="#faq"><span class="no">안내</span><b>자주 묻는 질문</b><span>${M.faq.length}개</span></a>
          <a href="#changelog"><span class="no">기록</span><b>규칙 변경 이력</b><span>${esc(s.rulesVersion)}</span></a>
        </div>
      </section>

      ${firstTable ? `<section class="home-sec" aria-labelledby="lootTitle">
        <div class="sec-title"><div><p class="eyebrow">AT A GLANCE</p><h2 id="lootTitle">무엇을 털 수 있나요</h2></div><a href="#war">전쟁·약탈 세부 →</a></div>
        <div class="matrix-wrap" id="lootTable">${mdHtml(firstTable)}</div>
      </section>` : ""}

      <section class="home-sec" aria-labelledby="warTitle">
        <div class="sec-title"><div><p class="eyebrow">WAR</p><h2 id="warTitle">신청에서 휴전까지</h2></div><a href="#ch-4">제4장 전쟁 규칙 →</a></div>
        <ol class="timeline">${s.warTimeline.map(([t, h, p, k]) => `<li class="${esc(k)}"><span class="t">${esc(t)}</span><h4>${esc(h)}</h4><p>${esc(p)}</p></li>`).join("")}</ol>
      </section>

      <section class="home-sec" aria-labelledby="penTitle">
        <div class="two">
          <div>
            <div class="sec-title"><div><p class="eyebrow">ZERO TOLERANCE</p><h2 id="penTitle">즉시 영구 정지</h2></div><a href="#rule-60">제60조 →</a></div>
            <ul class="severe">${sevItems.map(t => `<li>${inl(t)}</li>`).join("")}</ul>
          </div>
          <div>
            <div class="sec-title"><div><p class="eyebrow">PENALTY</p><h2>제재 7단계</h2></div><a href="#penalty">제재 안내 →</a></div>
            <div class="ladder">${ladder.map(([k, v], i) => `<div style="height:${30 + i * 11.6}%"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
            <p class="muted" style="font-size:13px;margin-top:14px">단순 의심만으로는 정지하지 않습니다. 운영진 2인 이상이 증거를 확인합니다 (제42조).</p>
          </div>
        </div>
      </section>

      <section class="home-sec" aria-label="바로가기">
        <div class="quick">
          <a href="#ch-3"><b>약탈 규칙</b><span>평시 약탈과 테러의 경계</span></a>
          <a href="#cases"><b>판정집 ${M.cases.length}건</b><span>허용 ${M.cases.filter(c => c.verdict === "ok").length} · 위반 ${M.cases.filter(c => c.verdict === "no").length} · 조건부 ${M.cases.filter(c => c.verdict === "mid").length}</span></a>
          <a href="#ch-9"><b>신고·이의제기</b><span>증거 기준과 처리 기한</span></a>
          <a href="#notice"><b>공지</b><span>${n ? esc(n.date) : "등록된 공지 없음"}</span></a>
        </div>
      </section>
    </div>`;
  }
  function afterHome() {
    $$("#lootTable td").forEach(td => {
      const t = td.textContent;
      const cls = t.includes("✅") ? "ok" : t.includes("⛔") ? "no" : null;
      if (cls) td.innerHTML = `<span class="pill ${cls}">${esc(t.replace(/[✅⛔]\s*/g, "").trim())}</span>`;
    });
    $$("#lootTable table").forEach(t => t.classList.add("matrix"));
    $$("#lootTable td:last-child").forEach(td => enhance(td));
    startPetals();
    const img = $("#kvImg");
    if (img && !reduce) {
      let tk = false;
      const par = () => { if (tk) return; tk = true; requestAnimationFrame(() => { const y = Math.min(scrollY, 900); img.style.transform = `translate3d(0,${y * .18}px,0) scale(${1 + y / 6000})`; tk = false; }); };
      addEventListener("scroll", par, { passive: true });
      img.addEventListener("animationend", () => { img.style.animation = "none"; }, { once: true });
      cleanup.push(() => removeEventListener("scroll", par));
    }
  }

  /* 매화 꽃잎: 화면에 보일 때만, 탭이 보일 때만 그린다 */
  function startPetals() {
    const cv = $("#petals"); if (!cv || reduce) return;
    const ctx = cv.getContext("2d"); let W, H, raf = 0, on = true, petals = [];
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const N = W < 700 ? 8 : 16;
    for (let i = 0; i < N; i++) petals.push({ x: Math.random() * W, y: Math.random() * H, r: 2.5 + Math.random() * 3.5, vx: -.15 - Math.random() * .35, vy: .25 + Math.random() * .45, a: Math.random() * 6, va: (Math.random() - .5) * .02, o: .3 + Math.random() * .5, c: Math.random() < .2 ? "#c7b3ff" : "#f6bfd0" });
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.x += p.vx + Math.sin(p.a) * .2; p.y += p.vy; p.a += p.va;
        if (p.y > H + 10 || p.x < -10) { p.y = -10; p.x = Math.random() * W * 1.1; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = p.o; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .62, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      raf = on ? requestAnimationFrame(draw) : 0;
    };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting && !document.hidden; if (on && !raf) raf = requestAnimationFrame(draw); });
    io.observe(cv);
    const vis = () => { on = !document.hidden; if (on && !raf) raf = requestAnimationFrame(draw); };
    document.addEventListener("visibilitychange", vis);
    addEventListener("resize", size);
    cleanup.push(() => { on = false; cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener("visibilitychange", vis); removeEventListener("resize", size); });
  }

  /* ───────── 문서 레이아웃 ───────── */
  function sideHtml(r) {
    const admin = document.body.classList.contains("is-admin");
    const item = (href, label, active, no) => `<li><a class="nav-item${active ? " active" : ""}" href="${href}">${no ? `<span class="no">${no}</span>` : ""}${esc(label)}</a></li>`;
    return `<aside class="side" id="side" aria-label="카테고리">
      <label class="sr" for="sideFilter">카테고리에서 찾기</label>
      <input class="side-filter" id="sideFilter" type="search" placeholder="조항 제목 거르기" autocomplete="off">
      <h4>전체 규칙</h4>
      <ul id="sideRules">${M.rules.chapters.map(c => {
        const open = r.page === "rules" && r.chapter === c.no;
        return `<li data-ch="${c.no}">
          <a class="nav-item${open ? " active" : ""}" href="#ch-${c.no}" aria-expanded="${open}"><span class="no">${pad(c.no)}</span>${esc(c.title)}<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></a>
          <div class="sub${open ? " open" : ""}">${c.articles.map(a => `<a href="#rule-${a.key}" data-art="${a.key}">${a.label} ${esc(a.title)}</a>`).join("")}</div>
        </li>`; }).join("")}</ul>
      <h4>세부 안내</h4>
      <ul>${item("#war", "전쟁·약탈 세부", r.page === "war")}${item("#penalty", "제재 기준표", r.page === "penalty")}${item("#cases", "사례별 판정집", r.page === "cases")}${item("#faq", "자주 묻는 질문", r.page === "faq")}${item("#report", "신고·문의 안내", r.page === "report")}</ul>
      <h4>소식</h4>
      <ul>${item("#notice", "공지", r.page === "notice")}${item("#changelog", "규칙 변경 이력", r.page === "changelog")}</ul>
      ${admin ? `<h4>운영진</h4><ul>${item("#admin", "규칙 편집", r.page === "admin")}</ul>` : ""}
    </aside>`;
  }
  function tocHtml(items, extra = "") {
    const links = items.map(t => `<a href="#${t.id}" class="${t.l3 ? "l3" : ""}" data-toc="${t.id}">${esc(t.label)}</a>`).join("");
    return { right: `<nav class="toc" aria-label="이 페이지 목차"><h4>이 페이지</h4>${links}<div class="toc-actions"><button type="button" data-top>↑ 맨 위로</button>${extra}</div></nav>`,
      inline: items.length ? `<div class="toc-inline"><details><summary>이 페이지 목차 · ${items.length}</summary><nav>${links}</nav></details></div>` : "" };
  }
  function head(eyebrow, title, desc, tools = "") {
    return `<div class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${desc ? `<p class="desc">${desc}</p>` : ""}${tools ? `<div class="page-tools">${tools}</div>` : ""}</div>`;
  }
  function crumbs(list) { return `<nav class="crumbs" aria-label="현재 위치"><a href="#home">홈</a>${list.map(([h, t]) => `<span>/</span>${h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`}`).join("")}</nav>`; }
  const copyMdBtn = key => key ? `<button class="btn-sm" type="button" data-copy-md="${key}">마크다운 복사</button>` : "";

  function docsLayout(r) {
    let body = "", toc = [], extra = "";
    switch (r.page) {
      case "rules": ({ body, toc, extra } = rulesPage(r.chapter)); break;
      case "cases": ({ body, toc } = casesPage()); break;
      case "faq": ({ body, toc } = faqPage()); break;
      case "notice": ({ body, toc } = noticePage()); break;
      case "admin": body = crumbs([[null, "규칙 편집"]]) + `<div id="adminRoot"></div>`; break;
      default: ({ body, toc } = mdPage(r.page));
    }
    const t = tocHtml(toc, extra);
    return `<div class="docs">${sideHtml(r)}<div class="content" id="content">${body.replace("<!--TOC-->", t.inline)}</div>${t.right}</div>`;
  }

  function rulesPage(no) {
    const c = chapterOf(no) || M.rules.chapters[0];
    const idx = M.rules.chapters.indexOf(c), prev = M.rules.chapters[idx - 1], next = M.rules.chapters[idx + 1];
    const a = c.articles;
    const desc = a.length ? `${a[0].label} ~ ${a[a.length - 1].label} · ${a.length}개 조항` : "";
    const tools = `<button class="btn-sm" type="button" data-expand="1">세부 모두 펼치기</button><button class="btn-sm" type="button" data-expand="0">모두 접기</button>${copyMdBtn("RULES")}`;
    let body = crumbs([["#rules", "전체 규칙"], [null, `제${c.no}장`]]) + head(`제${c.no}장`, esc(c.title), desc, tools) + "<!--TOC-->";
    if (c.no === 1 && M.rules.preamble) body += `<details class="fold" style="margin-top:20px"><summary>문서 정보와 표기 안내 ${ICON.chev}</summary><div class="fold-body prose" data-md="preamble"></div></details>`;
    if (c.note) body += `<div class="chapter-note prose" data-md="note"></div>`;
    body += a.map(art => {
      const rel = M.byArt[art.key] || { pen: [], cases: [] };
      const tags = [art.severe ? `<span class="tag-s severe">중대 위반</span>` : "", art.ban && !art.severe ? `<span class="tag-s ban">금지</span>` : "", ...art.tags.map(t => `<span class="tag-s${t.includes("관리자 확인") ? " draft" : ""}">${esc(t)}</span>`)].join("");
      return `<article class="art${art.draft ? " draft" : ""}" id="rule-${art.key}" data-art="${art.key}">
        <div class="art-head">
          <a class="art-no" href="#rule-${art.key}">${art.label}</a><h2>${esc(art.title)}</h2>
          <div class="art-tools">
            <button class="mini" type="button" data-link="rule-${art.key}" aria-label="${art.label} 링크 복사">${ICON.link}<span class="lbl">링크</span></button>
            <button class="mini toggle" type="button" data-toggle aria-expanded="true" aria-label="${art.label} 접기">${ICON.fold}<span class="lbl">접기</span></button>
          </div>
        </div>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        <div class="art-body"><div class="prose" data-md-art="${art.key}"></div></div>
        ${rel.pen.length || rel.cases.length ? `<div class="art-subs">
          ${rel.pen.length ? `<details class="fold"><summary>제재 기준 <span class="n">${rel.pen.length}</span>${ICON.chev}</summary><div class="fold-body"><div class="tw" style="overflow-x:auto"><table class="pen-table"><thead><tr><th>코드</th><th>위반</th><th>기본</th><th>부가 조치</th></tr></thead><tbody>
            ${rel.pen.map(p => `<tr><td><a href="#pen-${p.code.toLowerCase()}">${esc(p.code)}</a></td><td>${inl(p.what)}</td><td>${esc(p.base)}</td><td>${inl(p.extra)}</td></tr>`).join("")}</tbody></table></div></div></details>` : ""}
          ${rel.cases.length ? `<details class="fold"><summary>관련 사례 <span class="n">${rel.cases.length}</span>${ICON.chev}</summary><div class="fold-body"><ul class="case-links">
            ${rel.cases.map(cs => `<li><a href="#case-${cs.no}"><span class="k">사례 ${pad(cs.no)}</span><span class="t">${inl(cs.title)}</span><span class="pill ${cs.verdict}">${pillOf(cs.verdict)}</span></a></li>`).join("")}</ul></div></details>` : ""}
        </div>` : ""}
      </article>`;
    }).join("");
    body += `<nav class="pager" aria-label="장 이동">${prev ? `<a href="#ch-${prev.no}"><span>← 이전 장</span><b>제${prev.no}장 ${esc(prev.title)}</b></a>` : ""}${next ? `<a class="next" href="#ch-${next.no}"><span>다음 장 →</span><b>제${next.no}장 ${esc(next.title)}</b></a>` : ""}</nav>`;
    const toc = a.map(x => ({ id: "rule-" + x.key, label: `${x.label} ${x.title}` }));
    return { body, toc, extra: `<button type="button" data-expand="1">세부 모두 펼치기</button><button type="button" data-expand="0">모두 접기</button>` };
  }

  function mdPage(page) {
    const [title, key] = PAGE_META[page];
    const descs = { war: "전쟁 진행 순서, 신청 양식, 전쟁 구역 계산, 운영진 체크리스트.", penalty: "위반별 기본 제재, 가중·감경 사유, 재범 기준. 코드를 누르면 해당 조항으로 이동합니다.", changelog: "모든 규칙 변경과 제정 전 검수 기록.", report: "신고 접수처와 기한, 양식, 증거 준비, 처리 순서, 이의제기." };
    const body = crumbs([[null, title]]) + head(key + ".md", esc(title), descs[page] || "", copyMdBtn(key)) + "<!--TOC-->" + `<div class="prose" data-md-doc="${key}" style="margin-top:24px"></div>`;
    const secs = page === "war" ? M.war : page === "changelog" ? M.changelog : page === "report" ? M.report : sectionsOf(M.md(key));
    const toc = secs.map((s, i) => ({ id: `${page}-s${i}`, label: s.title, l3: s.level === 3 }));
    return { body, toc };
  }
  function sectionsOf(md) { const o = []; md.split("\n").forEach(l => { const h = l.match(/^(#{2,3}) (.+)$/); if (h) o.push({ level: h[1].length, title: h[2].replace(/[`*]/g, "").trim() }); }); return o; }

  function casesPage() {
    const cats = [...new Set(M.cases.map(c => c.cat))];
    const chip = (k, v, label, n) => `<button class="chip" type="button" data-f="${k}" data-v="${esc(v)}" aria-pressed="${v === "all"}">${esc(label)}<span class="n">${n}</span></button>`;
    const body = crumbs([[null, "사례별 판정집"]]) + head("CASES.md", "사례별 판정집", "정상적인 약탈은 처벌하지 않습니다. 피해자가 화가 났다는 사실만으로 위반이 되지 않습니다. 항목을 눌러 판정 근거와 권장 제재를 펼치세요.",
      `<div class="chips" role="group" aria-label="분류">${chip("cat", "all", "전체", M.cases.length)}${cats.map(c => chip("cat", c, c, M.cases.filter(x => x.cat === c).length)).join("")}</div>
       <div class="chips" role="group" aria-label="판정">${chip("v", "all", "모든 판정", M.cases.length)}${["ok", "no", "mid"].map(v => chip("v", v, pillOf(v), M.cases.filter(x => x.verdict === v).length)).join("")}</div>${copyMdBtn("CASES")}`) + "<!--TOC-->" +
      `<ol class="case-list" id="caseList">${M.cases.map(c => `<li class="case" id="case-${c.no}" data-cat="${esc(c.cat)}" data-v="${c.verdict}">
        <button type="button" aria-expanded="false"><span class="k">사례 ${pad(c.no)}</span><h3>${inl(c.title)}<span class="cat">${esc(c.cat)}</span></h3><span class="pill ${c.verdict}">${esc(c.verdictText || pillOf(c.verdict))}</span>${ICON.chev}</button>
        <div class="case-body"><dl>${["상황", "관련 규칙", "판정", "근거", "권장 제재", "확인 사항"].filter(k => c.f[k]).map(k => `<dt>${k}</dt><dd class="cf">${inl(c.f[k])}</dd>`).join("")}</dl>
        <div style="margin-top:12px"><button class="mini" type="button" data-link="case-${c.no}">${ICON.link}<span class="lbl">이 사례 링크 복사</span></button></div></div></li>`).join("")}</ol>`;
    const toc = cats.map(c => ({ id: "case-" + M.cases.find(x => x.cat === c).no, label: c }));
    return { body, toc };
  }

  function faqPage() {
    const cats = [...new Set(M.faq.map(f => f.cat))];
    const body = crumbs([[null, "자주 묻는 질문"]]) + head("FAQ.md", "자주 묻는 질문", "신규 유저를 위한 안내입니다. 효력은 전체 규칙에 있으며, 답변의 조항 번호를 누르면 해당 규칙으로 이동합니다.", copyMdBtn("FAQ")) + "<!--TOC-->" +
      cats.map((c, ci) => `<section class="faq-group" id="faq-g${ci}" aria-label="${esc(c)}"><h2>${esc(c)}</h2><ol class="case-list" style="margin-top:0">${M.faq.filter(f => f.cat === c).map(f => `
        <li class="case" id="faq-${f.id}"><button type="button" aria-expanded="false"><span class="k">Q</span><h3>${inl(f.q)}</h3>${ICON.chev}</button><div class="case-body"><p class="cf">${inl(f.a)}</p></div></li>`).join("")}</ol></section>`).join("");
    return { body, toc: cats.map((c, i) => ({ id: "faq-g" + i, label: c })) };
  }

  function noticePage() {
    const body = crumbs([[null, "공지"]]) + head("NOTICE.md", "공지", "운영 공지와 규칙 시행 안내.", copyMdBtn("NOTICE")) + "<!--TOC-->" +
      (M.notices.length ? M.notices.map((n, i) => `<article class="art" id="notice-${i + 1}"><div class="art-head"><span class="art-no">${esc(n.date)}</span><h2>${esc(n.title)}</h2><div class="art-tools"><button class="mini" type="button" data-link="notice-${i + 1}">${ICON.link}<span class="lbl">링크</span></button></div></div><div class="art-body"><div class="prose" data-md-notice="${i}"></div></div></article>`).join("") : `<p class="muted" style="margin-top:24px">등록된 공지가 없습니다.</p>`);
    return { body, toc: M.notices.map((n, i) => ({ id: "notice-" + (i + 1), label: n.date + " " + n.title })) };
  }

  function afterDocs(r) {
    const content = $("#content");
    // 마크다운 채우기
    $$("[data-md-art]", content).forEach(el => { const a = M.artByKey(el.dataset.mdArt); el.innerHTML = mdHtml(a.md); enhance(el); });
    $$("[data-md='preamble']", content).forEach(el => { el.innerHTML = mdHtml(M.rules.preamble.replace(/^# .+\n/, "")); enhance(el); });
    $$("[data-md='note']", content).forEach(el => { el.innerHTML = mdHtml(chapterOf(r.chapter).note); enhance(el); });
    $$("[data-md-notice]", content).forEach(el => { el.innerHTML = mdHtml(M.notices[+el.dataset.mdNotice].md); enhance(el); });
    $$("[data-md-doc]", content).forEach(el => {
      el.innerHTML = mdHtml(M.md(el.dataset.mdDoc)); enhance(el, { headPrefix: r.page });
      if (r.page === "penalty") penaltyTables(el, content);
    });
    $$(".cf", content).forEach(el => enhance(el));
    if (r.page === "admin" && WH.renderAdmin) WH.renderAdmin($("#adminRoot"));

    // 사이드바: 장 펼침 + 필터
    $$("#sideRules .nav-item .chev").forEach(ch => ch.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const a = ch.closest(".nav-item"), sub = a.nextElementSibling, open = !sub.classList.contains("open");
      sub.classList.toggle("open", open); a.setAttribute("aria-expanded", open);
    }));
    $("#sideFilter").addEventListener("input", e => {
      const q = e.target.value.trim();
      $$("#sideRules > li").forEach(li => {
        const c = chapterOf(+li.dataset.ch), chHit = !q || c.title.includes(q);
        let any = false;
        $$(".sub a", li).forEach(a => { const hit = !q || chHit || a.textContent.includes(q) || a.dataset.art === q.replace(/\D/g, ""); a.classList.toggle("hidden", !hit); any = any || hit; });
        li.classList.toggle("hidden", !(chHit || any));
        const sub = $(".sub", li); if (q) sub.classList.toggle("open", any); else sub.classList.toggle("open", state.page === "rules" && state.chapter === c.no);
      });
    });

    // 판정집·FAQ 필터와 펼침
    const filt = { cat: "all", v: "all" };
    $$("[data-f]", content).forEach(b => b.addEventListener("click", () => {
      filt[b.dataset.f] = b.dataset.v;
      $$(`[data-f="${b.dataset.f}"]`, content).forEach(x => x.setAttribute("aria-pressed", x === b));
      $$("#caseList .case").forEach(li => { li.hidden = !((filt.cat === "all" || li.dataset.cat === filt.cat) && (filt.v === "all" || li.dataset.v === filt.v)); });
    }));
    $$(".case > button", content).forEach(b => b.addEventListener("click", () => {
      const li = b.parentElement, open = !li.classList.contains("open"); li.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
    }));

    trackReading();
  }


  /* 제재표: 기본 단계로 1·2·3차를 계산해 열을 더하고, 분류 필터와 모바일 카드 표시를 붙인다 */
  function penaltyTables(el, content) {
    const groups = [];
    $$("table", el).forEach(t => {
      const head = [...t.tHead?.rows[0]?.cells || []].map(c => c.textContent.trim());
      if (head[0] !== "코드" || head[3] !== "기본") return;
      const h3 = t.closest(".tw").previousElementSibling;
      const g = h3 && h3.tagName === "H3" ? h3.textContent.trim() : "기타";
      groups.push(g); t.dataset.group = g; t.classList.add("pen-rows"); if (h3) h3.dataset.group = g;
      const hr = t.tHead.rows[0];
      hr.cells[3].textContent = "1차";
      ["2차", "3차"].reverse().forEach(x => { const th = document.createElement("th"); th.textContent = x; hr.insertBefore(th, hr.cells[4]); });
      const labels = ["코드", "위반", "조항", "1차", "2차", "3차", "부가 조치"];
      $$("tbody tr", t).forEach(tr => {
        const code = tr.cells[0].textContent.trim(); tr.id = "pen-" + code.toLowerCase();
        const baseTxt = tr.cells[3].textContent, sev = tr.cells[1].textContent.includes("🚨");
        const m = baseTxt.match(/^(\d)단계/); const b = m ? +m[1] : null;
        const st = n => n == null ? "기본 +1" : `${Math.min(7, n)}단계`;
        const second = sev ? "7단계" : b == null ? "직전 +1" : st(b + 1), third = sev ? "7단계" : b == null ? "직전 +1" : st(Math.max(3, b + 2));
        [third, second].forEach(v => { const td = document.createElement("td"); td.textContent = v; if (v === "7단계") td.className = "perm"; tr.insertBefore(td, tr.cells[4]); });
        if (sev || b === 7) { tr.classList.add("sev"); tr.cells[3].classList.add("perm"); }
        [...tr.cells].forEach((td, i) => { td.dataset.label = labels[i]; const v = document.createElement("span"); v.className = "v"; v.append(...td.childNodes); td.append(v); });
      });
    });
    const uniq = [...new Set(groups)];
    if (uniq.length) {
      const bar = document.createElement("div"); bar.className = "chips pen-filter"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "제재 분류 필터");
      bar.innerHTML = [`<button type="button" class="chip" data-pg="all" aria-pressed="true">전체</button>`, ...uniq.map(g => `<button type="button" class="chip" data-pg="${esc(g)}" aria-pressed="false">${esc(g.replace(/\s*\(.*\)\s*/, ""))}</button>`)].join("");
      const first = $("table.pen-rows", el).closest(".tw").previousElementSibling;
      first.before(bar);
      bar.addEventListener("click", e => {
        const c = e.target.closest(".chip"); if (!c) return; const g = c.dataset.pg;
        $$(".chip", bar).forEach(x => x.setAttribute("aria-pressed", x === c));
        $$("table.pen-rows", el).forEach(t => { const on = g === "all" || t.dataset.group === g; t.closest(".tw").hidden = !on; const h = t.closest(".tw").previousElementSibling; if (h && h.tagName === "H3") h.hidden = !on; });
      });
    }
  }

  /* 현재 읽는 항목 표시 */
  function trackReading() {
    const targets = $$(".toc a[data-toc]").map(a => document.getElementById(a.dataset.toc)).filter(Boolean);
    if (!targets.length) return;
    const set = id => {
      $$(".toc a").forEach(a => a.classList.toggle("reading", a.dataset.toc === id));
      $$(".sub a").forEach(a => a.classList.toggle("reading", "rule-" + a.dataset.art === id));
    };
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) set(vis[0].target.id);
    }, { rootMargin: "-70px 0px -70% 0px" });
    targets.forEach(t => io.observe(t));
    set(targets[0].id);
    cleanup.push(() => io.disconnect());
  }

  /* ───────── 위임 이벤트 ───────── */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-link],[data-toggle],[data-expand],[data-copy-md],[data-top],[data-open-search],.toc a,.toc-inline a");
    if (!t) return;
    if (t.matches("[data-link]")) { copy(linkOf(t.dataset.link), "링크를 복사했어요"); }
    else if (t.matches("[data-toggle]")) {
      const art = t.closest(".art"), c = !art.classList.contains("collapsed");
      art.classList.toggle("collapsed", c); t.setAttribute("aria-expanded", !c); $(".lbl", t).textContent = c ? "펼치기" : "접기";
    } else if (t.matches("[data-expand]")) {
      const on = t.dataset.expand === "1";
      $$("#content .art").forEach(a => { a.classList.toggle("collapsed", !on); const b = $("[data-toggle]", a); if (b) { b.setAttribute("aria-expanded", on); $(".lbl", b).textContent = on ? "접기" : "펼치기"; } });
      $$("#content details.fold").forEach(d => { d.open = on; });
      $$("#content .case").forEach(c => c.classList.toggle("open", on));
      toast(on ? "모든 항목을 펼쳤어요" : "모든 항목을 접었어요");
    } else if (t.matches("[data-copy-md]")) { copy(M.md(t.dataset.copyMd), `${t.dataset.copyMd}.md 를 복사했어요 · 디스코드에 붙여넣으세요`); }
    else if (t.matches("[data-top]")) { scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }
    else if (t.matches("[data-open-search]")) { openSearch(); }
    else if (t.matches(".toc a,.toc-inline a")) {
      const id = t.getAttribute("href").slice(1);
      if (document.getElementById(id) && route("#" + id).page === state.page) { e.preventDefault(); jump(id, true); if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id); }
    }
  });

  /* ───────── 검색 ───────── */
  let INDEX = [], palFilter = "all", palSel = 0, palItems = [];
  const PAL_CATS = [["all", "전체"], ["규칙", "규칙"], ["제재", "제재"], ["사례", "사례"], ["FAQ", "FAQ"], ["전쟁", "전쟁"], ["신고", "신고"], ["소식", "공지·이력"]];
  function buildIndex() {
    INDEX = [
      ...M.articles.map(a => ({ type: "규칙", num: a.sub ? null : a.no, key: a.key, title: `${a.label} ${a.title}`, sub: `제${a.chapter}장 ${chapterOf(a.chapter).title}${a.draft ? " · 관리자 확인 필요" : ""}`, text: a.text, href: "#rule-" + a.key })),
      ...M.penalty.map(p => ({ type: "제재", code: p.code, title: `${p.code} ${p.what.replace(/[🚨*]/g, "").trim()}`, sub: `${p.group} · ${p.clause} · 기본 ${p.base}`, text: WH.plain(p.extra), href: "#pen-" + p.code.toLowerCase() })),
      ...M.cases.map(c => ({ type: "사례", title: `사례 ${c.no}. ${c.title}`, sub: `${c.cat} · ${pillOf(c.verdict)}`, text: c.text, href: "#case-" + c.no })),
      ...M.faq.map(f => ({ type: "FAQ", title: f.q, sub: f.cat, text: f.text, href: "#faq-" + f.id })),
      ...M.war.map((s, i) => ({ type: "전쟁", title: s.title, sub: "전쟁·약탈 세부", text: s.text, href: "#war-s" + i })),
      ...M.notices.map((n, i) => ({ type: "소식", title: n.title, sub: "공지 · " + n.date, text: WH.plain(n.md), href: "#notice-" + (i + 1) })),
      ...M.changelog.map((s, i) => ({ type: "소식", title: s.title, sub: "변경 이력", text: s.text, href: "#changelog-s" + i })),
      ...M.report.map((s, i) => ({ type: "신고", title: s.title, sub: "신고·문의 안내", text: s.text, href: "#report-s" + i })),
    ];
    INDEX.forEach(it => { it.hay = (it.title + " " + it.sub + " " + it.text).toLowerCase(); it.tl = it.title.toLowerCase(); });
  }
  function search(q) {
    const pool = INDEX.filter(it => palFilter === "all" || it.type === palFilter);
    q = q.trim();
    if (!q) return palFilter === "all" ? pool.filter(it => [14, 15, 16, 17, 18, 30, 33, 60].includes(it.num)) : pool.slice(0, 15);
    const ql = q.toLowerCase();
    const num = q.match(/^제?\s*(\d{1,3})\s*조?$/);
    const subn = q.match(/^제?\s*(\d{1,3})\s*(?:조의|조\s*의|의|-)\s*(\d{1,2})$/);
    const code = q.match(/^([a-z])\s*-?\s*(\d{1,2})$/i);
    const terms = ql.split(/\s+/).filter(Boolean);
    const out = [];
    for (const it of pool) {
      let s = 0;
      if (num && it.num === +num[1]) s += 1000;
      if (num && it.key && it.key.startsWith(num[1] + "-")) s += 500;
      if (subn && it.key === subn[1] + "-" + subn[2]) s += 1000;
      if (code && it.code && it.code.toLowerCase() === `${code[1]}-${code[2]}`.toLowerCase()) s += 1000;
      if (!s) {
        if (!terms.every(t => it.hay.includes(t))) continue;
        if (it.tl.includes(ql)) s += 40;
        terms.forEach(t => { if (it.tl.includes(t)) s += 12; s += Math.min(5, it.hay.split(t).length - 1); });
        if (it.type === "규칙") s += 4;
      }
      out.push([s, it]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, 60).map(x => x[1]);
  }
  function snippet(it, q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let txt = it.text || ""; const low = txt.toLowerCase();
    let at = terms.length ? Math.min(...terms.map(t => { const i = low.indexOf(t); return i < 0 ? 1e9 : i; })) : 0;
    if (at === 1e9) at = 0;
    const start = Math.max(0, at - 40); txt = (start ? "…" : "") + txt.slice(start, start + 150) + (txt.length > start + 150 ? "…" : "");
    return hl(txt, terms);
  }
  function hl(text, terms) {
    let h = esc(text);
    terms.filter(t => t.length).sort((a, b) => b.length - a.length).forEach(t => { h = h.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`); });
    return h;
  }
  function drawResults() {
    const q = $("#palInput").value;
    palItems = search(q); palSel = 0;
    const box = $("#palResults");
    if (!palItems.length) {
      box.innerHTML = q.trim() ? `<div class="pal-empty"><b>"${esc(q)}"</b>에 맞는 결과가 없어요. 다른 단어나 조 번호(예: 15)로 찾아보세요.${palFilter !== "all" ? " 카테고리를 '전체'로 바꿔 보세요." : ""}</div>`
        : `<div class="pal-empty">조 번호, 제재 코드, 단어로 찾을 수 있어요. 예: <b>33</b>, <b>W-7</b>, <b>엔더 상자</b></div>`;
    } else {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      box.innerHTML = (q.trim() ? "" : `<div class="pal-empty" style="padding:10px 12px 4px">자주 찾는 조항</div>`) +
        palItems.map((it, i) => `<a href="${it.href}" role="option" class="${i === 0 ? "sel" : ""}" style="animation-delay:${Math.min(i, 10) * 18}ms"><span class="ty">${esc(it.type)}</span><span class="ti">${hl(it.title, terms)}</span><span class="sn">${esc(it.sub)}${q.trim() ? " · " + snippet(it, q) : ""}</span></a>`).join("");
    }
    $("#palCount").textContent = q.trim() ? `${palItems.length}건` : "";
    $$("#palChips .chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.c === palFilter));
  }
  function openSearch(prefill) {
    const p = $("#palette"); p.classList.add("open"); document.body.style.overflow = "hidden";
    const inp = $("#palInput"); if (prefill != null) inp.value = prefill; drawResults(); setTimeout(() => inp.focus(), 20);
  }
  function closeSearch() { $("#palette").classList.remove("open"); document.body.style.overflow = ""; }
  function setupSearch() {
    $("#palChips").innerHTML = PAL_CATS.map(([k, l]) => `<button type="button" class="chip" data-c="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("");
    $("#palChips").addEventListener("click", e => { const c = e.target.closest(".chip"); if (!c) return; palFilter = c.dataset.c; drawResults(); $("#palInput").focus(); });
    $("#palInput").addEventListener("input", drawResults);
    $("#palInput").addEventListener("keydown", e => {
      const links = $$("#palResults a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!links.length) return;
        palSel = (palSel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.classList.toggle("sel", i === palSel)); links[palSel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { e.preventDefault(); if (links[palSel]) { WH.lastQuery = $("#palInput").value.trim(); location.hash = links[palSel].getAttribute("href"); closeSearch(); if (location.hash === links[palSel].getAttribute("href")) go(); } }
    });
    $("#palResults").addEventListener("click", e => { const a = e.target.closest("a"); if (a) { WH.lastQuery = $("#palInput").value.trim(); closeSearch(); if (location.hash === a.getAttribute("href")) { e.preventDefault(); go(); } } });
    $("#palClose").addEventListener("click", closeSearch);
    $("#palette").addEventListener("click", e => { if (e.target.id === "palette") closeSearch(); });
    $("#searchBtn").addEventListener("click", () => openSearch());
    $("#tabSearch").addEventListener("click", () => openSearch());
    document.addEventListener("keydown", e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); openSearch(); }
      else if (e.key === "Escape") { closeSearch(); closeDrawer(); }
    });
  }

  /* ───────── 서랍 메뉴(모바일) ───────── */
  function openDrawer() { if (!$("#side")) { location.hash = "#rules"; setTimeout(() => document.body.classList.add("drawer"), 60); return; } document.body.classList.add("drawer"); }
  function closeDrawer() { document.body.classList.remove("drawer"); }
  $("#menuBtn").addEventListener("click", () => document.body.classList.contains("drawer") ? closeDrawer() : openDrawer());
  $("#tabMenu").addEventListener("click", openDrawer);
  $("#scrim").addEventListener("click", closeDrawer);

  /* ───────── 테마 ───────── */
  const root = document.documentElement;
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  try { const t = localStorage.getItem("wolhwa-theme"); if (t) root.dataset.theme = t; } catch {}
  $("#themeBtn").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark"; root.dataset.theme = next;
    try { localStorage.setItem("wolhwa-theme", next); } catch {}
    toast(next === "dark" ? "다크 모드" : "라이트 모드");
  });

  /* ───────── 스크롤: 진행 표시, 헤더 ───────── */
  function onScroll() {
    const h = document.documentElement.scrollHeight - innerHeight;
    $("#progress").style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    const hero = $("#hero");
    $("#top").classList.toggle("on-hero", !!hero && scrollY < hero.offsetHeight - 70);
    $("#toTop").classList.toggle("show", scrollY > 700);
  }
  let scT = false;
  addEventListener("scroll", () => { if (scT) return; scT = true; requestAnimationFrame(() => { onScroll(); scT = false; }); }, { passive: true });
  $("#toTop").addEventListener("click", () => { scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); $("#view").focus({ preventScroll: true }); });

  /* ───────── 푸터 ───────── */
  function footer() {
    const s = M.site, last = M.latestEdit();
    $("#foot").innerHTML = `<div class="lattice" aria-hidden="true"></div><div class="wrap"><div class="cols">
      <div class="brand"><b>${esc(s.name)} <span class="serif" style="font-size:16px;color:var(--night-gold)">${esc(s.hanja)}</span></b><p>${esc(s.tagline)}</p></div>
      <div><h4>서버 정보</h4><dl><dt>상태</dt><dd data-srv-mini>확인 중</dd>${s.status && s.status.address ? `<dt>주소</dt><dd>${esc(s.status.address)}</dd>` : ""}${s.server.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
      <div><h4>운영 안내</h4><dl>${s.support.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
      <div><h4>문서</h4><ul><li><a href="#rules">전체 규칙</a></li><li><a href="#war">전쟁·약탈 세부</a></li><li><a href="#penalty">제재 기준표</a></li><li><a href="#cases">사례별 판정집</a></li><li><a href="#faq">FAQ</a></li><li><a href="#report">신고·문의</a></li><li><a href="#changelog">변경 이력</a></li></ul></div>
    </div><div class="bottom"><span>규칙 ${esc(s.rulesVersion)} · 개정일 ${esc(s.revisedAt)}${last ? ` · 운영진 최근 수정 ${esc(last.slice(0, 10))}` : ""}</span><span>© ${esc(s.name)}(${esc(s.hanja)}) 운영진</span></div></div>`;
  }

  /* ───────── 시작 ───────── */
  WH.toast = toast; WH.mdHtml = mdHtml; WH.enhance = enhance; WH.esc = esc;
  WH.refresh = () => { M = WH.build(); buildIndex(); footer(); state.page = null; go(); if (WH.status) WH.status.paint(); };
  WH.rerenderSide = () => { if (state.page && state.page !== "home") { const y = scrollY; state.page = null; go(); scrollTo(0, y); } };
  setupSearch();
  WH.load().then(model => {
    M = model; buildIndex(); footer(); go();
    if (WH.status) WH.status.start(M.site.status || {});
    document.addEventListener("wh:render", () => WH.status && WH.status.paint());
    addEventListener("hashchange", go);
    WH.ready = true; document.dispatchEvent(new Event("wh:ready"));
  }).catch(err => {
    view.innerHTML = `<div class="wrap" style="padding:80px 20px"><h1 class="serif">규칙을 불러오지 못했어요</h1><p class="muted" style="margin-top:12px">${esc(err.message)} · 잠시 뒤 새로고침해 주세요.</p></div>`;
  });
})();

/* 월화 공식 위키 — 화면, 라우팅, 검색
   데이터는 data.js 의 WH.model 에서만 읽는다. 이 파일에는 규칙 내용이 없다.
   CSP(style-src 'self')를 지키기 위해 HTML 문자열에 style 속성을 쓰지 않는다. 크기는 CSSOM(el.style)으로만 정한다. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((.+?)\)/g, "$1");
  const pad = n => String(n).padStart(2, "0");
  const view = $("#view");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
  const ICON = {
    chev: svg('<path d="m9 6 6 6-6 6"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    side: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
    scroll: svg('<path d="M7 4h11a2 2 0 0 1 2 2v1h-4M7 4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h9a2 2 0 0 0 2-2V7M7 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2M10 9h6M10 13h6"/>'),
    swords: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l-2 2 2 2 2-2"/>'),
    flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    coins: svg('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 11v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><ellipse cx="17" cy="15" rx="4" ry="2"/><path d="M13 15v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3"/>'),
    shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
    terminal: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  };
  const DOC_ROUTE = { RULES: "rules", WAR_RULES: "war", PENALTY: "penalty", CASES: "cases", FAQ: "faq", CHANGELOG: "changelog", NOTICE: "notice", REPORT: "report" };
  const PAGE_META = {
    rules: ["서버 규칙", "RULES"], war: ["전쟁·약탈 세부 절차", "WAR_RULES"], penalty: ["제재 기준표", "PENALTY"],
    cases: ["사례별 판정집", "CASES"], faq: ["자주 묻는 질문", "FAQ"], changelog: ["규칙 변경 이력", "CHANGELOG"],
    notice: ["공지", "NOTICE"], report: ["신고·문의 안내", "REPORT"], admin: ["규칙 편집", null],
  };
  /* 페이지 → 상단 메뉴 */
  const NAV_OF = { rules: "rules", war: "war", penalty: "penalty", cases: "penalty", faq: "faq", report: "guide", notice: "guide", changelog: "guide", admin: "admin" };
  let M, cleanup = [], state = { page: null, chapter: null, cat: null };

  /* ───────── 공통 ───────── */
  let toastT;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch { toast("복사할 수 없어요. 직접 선택해서 복사해 주세요."); }
  }
  const inArtifact = /claude|anthropic/.test(location.hostname) || location.protocol === "blob:" || location.origin === "null";
  const linkOf = id => ((inArtifact && M.site.shareUrl) || location.href.split("#")[0]) + "#" + id;

  /* 마크다운 → HTML. 문서는 운영진만 고치지만, 한 번 더 걸러서 스크립트·이벤트 속성·위험한 주소를 지운다. */
  const BAD_TAGS = "script,style,iframe,object,embed,link,meta,base,form,button,textarea,select,svg,math,frame,frameset";
  function sanitize(html) {
    const doc = new DOMParser().parseFromString("<body>" + html, "text/html"); // 스크립트·리소스가 실행되지 않는 문서
    const body = doc.body;
    body.querySelectorAll(BAD_TAGS).forEach(n => n.remove());
    body.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
        if (n.startsWith("on") || n === "style" || n === "srcdoc") el.removeAttribute(a.name);
        else if ((n === "href" || n === "src" || n === "xlink:href") && /^(javascript|vbscript|data):/.test(v.replace(/\s/g, ""))) el.removeAttribute(a.name);
      });
      if (el.tagName === "INPUT" && el.type !== "checkbox") el.remove();
    });
    return body.innerHTML;
  }
  function mdHtml(md) {
    try { return window.marked ? sanitize(marked.parse(md, { mangle: false, headerIds: false })) : "<pre>" + esc(md) + "</pre>"; }
    catch { return "<pre>" + esc(md) + "</pre>"; }
  }
  /* 렌더된 본문 정리: 표 감싸기, 콜아웃, 코드 복사, 문서 링크 → 라우트, "제N조" → 규칙 링크 */
  function enhance(root, { headPrefix } = {}) {
    $$("table", root).forEach(t => { if (!t.parentElement.classList.contains("tw")) { const w = document.createElement("div"); w.className = "tw"; w.tabIndex = 0; w.setAttribute("role", "region"); w.setAttribute("aria-label", "표 (옆으로 밀어 보기)"); t.replaceWith(w); w.appendChild(t); } });
    $$("blockquote", root).forEach(bq => {
      const first = bq.querySelector("p"); const txt = first ? first.textContent.trim() : "";
      const m = txt.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i);
      let kind = "note";
      if (m) { kind = m[1].toLowerCase(); first.innerHTML = first.innerHTML.replace(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br>)?/i, ""); }
      else if (/^(⚠|주의|경고)/.test(txt)) kind = "warning";
      else if (/^(💡|팁|TIP)/i.test(txt)) kind = "tip";
      bq.classList.add("callout", "callout-" + (kind === "caution" ? "warning" : kind === "important" ? "warning" : kind));
      const label = { note: "안내", tip: "팁", warning: "주의", important: "중요", caution: "주의" }[kind];
      bq.insertAdjacentHTML("afterbegin", `<span class="callout-label">${label}</span>`);
    });
    $$("pre", root).forEach(pre => {
      if (pre.parentElement.classList.contains("code")) return;
      const box = document.createElement("div"); box.className = "code";
      const bar = document.createElement("div"); bar.className = "code-bar";
      bar.innerHTML = `<span>양식</span><button type="button" class="code-copy" aria-label="코드 복사">${ICON.copy}<span>복사</span></button>`;
      pre.replaceWith(box); box.append(bar, pre);
    });
    $$("a[href]", root).forEach(a => {
      const h = a.getAttribute("href");
      const m = h.match(/^([A-Z_]+)\.md$/);
      if (m && DOC_ROUTE[m[1]]) a.setAttribute("href", "#" + DOC_ROUTE[m[1]]);
      else if (/^https?:/.test(h)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
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

  /* ───────── 위키 카테고리 ───────── */
  function categories() {
    return (M.wiki.categories || []).map(c => {
      let docs = c.docs;
      if (docs === "chapters") docs = M.rules.chapters.map(ch => ({ title: `제${ch.no}장 ${ch.title}`, desc: ch.articles.length ? `${ch.articles[0].label} ~ ${ch.articles[ch.articles.length - 1].label} · ${ch.articles.length}개 조항` : "", href: "#ch-" + ch.no }));
      else if (docs === "faq") docs = [...new Set(M.faq.map(f => f.cat))].map((cat, i) => ({ title: cat, desc: `질문 ${M.faq.filter(f => f.cat === cat).length}개`, href: "#faq-g" + i }));
      return { ...c, docs: Array.isArray(docs) ? docs : [] };
    });
  }
  const catById = id => categories().find(c => c.id === id);
  /* 현재 페이지 주소가 들어 있는 카테고리들 */
  function catsFor(hrefs) { return categories().filter(c => c.docs.some(d => hrefs.includes(d.href))); }

  /* ───────── 라우팅 ───────── */
  function route(hash) {
    const h = decodeURIComponent((hash || "").replace(/^#/, ""));
    let m;
    if (!h || h === "home") return { page: "home" };
    if (h === "view") return null;
    if (h === "rules") return { page: "rules", chapter: 1 };
    if ((m = h.match(/^cat-([a-z]+)$/))) return catById(m[1]) ? { page: "cat", cat: m[1] } : { page: "home" };
    if ((m = h.match(/^ch-(\d+)$/))) return { page: "rules", chapter: +m[1] };
    if ((m = h.match(/^rule-(\d+(?:-\d+)?)$/))) { const a = M.artByKey(m[1]); return a ? { page: "rules", chapter: a.chapter, target: h } : { page: "rules", chapter: 1 }; }
    if (/^pen-/.test(h)) return { page: "penalty", target: h };
    if (/^case-\d+$/.test(h)) return { page: "cases", target: h };
    if (/^faq-g?\d+$/.test(h)) return { page: "faq", target: h };
    if ((m = h.match(/^(war|penalty|changelog|notice|report)-s?\d+$/))) return { page: m[1], target: h };
    if (PAGE_META[h]) return { page: h };
    return { page: "home" };
  }
  function go() {
    if (!M) return;
    const r = route(location.hash);
    if (!r) return; // 본문 바로가기
    closeDrawer();
    const same = r.page === state.page && (r.page !== "rules" || r.chapter === state.chapter) && (r.page !== "cat" || r.cat === state.cat) && view.childElementCount;
    if (!same) render(r);
    if (r.target) jump(r.target, true);
    else if (!same) window.scrollTo({ top: 0, behavior: "auto" });
    markNav(r);
  }
  function jump(id, flash) {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.classList.contains("case")) { el.classList.add("open"); const b = el.querySelector(":scope > button"); if (b) b.setAttribute("aria-expanded", "true"); }
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (flash) { const f = el.querySelector(".art-head") || el; f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
      if (WH.lastQuery) { markIn(el.closest("article,li,tr") || el, WH.lastQuery); WH.lastQuery = ""; }
    });
  }
  function navKey(r) {
    if (r.page === "cat") return r.cat === "rules" ? "rules" : r.cat === "penalty" ? "penalty" : r.cat === "faq" ? "faq" : r.cat;
    if (r.page === "rules") return [3, 4].includes(r.chapter) ? "war" : r.chapter === 5 ? "clan" : "rules";
    return NAV_OF[r.page] || "";
  }
  function markNav(r) {
    const key = navKey(r);
    $$(".gnb a").forEach(a => { if (a.dataset.nav === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const tab = r.page === "home" ? "home" : ["penalty", "cases"].includes(r.page) ? "penalty" : r.page === "rules" ? "rules" : "";
    $$(".tabbar [data-tab]").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
    const cur = location.hash || "#home";
    $$("#drawerBody a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === cur));
  }

  function render(r) {
    cleanup.forEach(f => f()); cleanup = [];
    state = { page: r.page, chapter: r.chapter || null, cat: r.cat || null };
    view.innerHTML = r.page === "home" ? homeView() : docsLayout(r);
    view.classList.remove("enter"); void view.offsetWidth; if (!reduce) view.classList.add("enter");
    if (r.page === "home") afterHome(); else afterDocs(r);
    document.dispatchEvent(new Event("wh:render"));
    const t = r.page === "home" ? "" : r.page === "rules" ? `제${r.chapter}장 ${chapterOf(r.chapter)?.title || ""}` : r.page === "cat" ? catById(r.cat).name : PAGE_META[r.page][0];
    document.title = t ? `${t} · 월화 공식 위키` : "월화 공식 위키";
    onScroll();
  }
  const chapterOf = n => M.rules.chapters.find(c => c.no === n);

  /* ───────── 홈 ───────── */
  function homeView() {
    const s = M.site, n = M.notices[0], cats = categories();
    const firstTable = (() => { const m = M.md("WAR_RULES").match(/## 1\.[^\n]*\n+(\|[\s\S]*?)\n\n/); return m ? m[1] : ""; })();
    const sev = M.artByKey("60");
    const sevItems = sev ? [...sev.md.matchAll(/^- (.+)$/gm)].map(m => m[1]) : [];
    const ladder = (() => { const a = M.artByKey("59"); return a ? [...a.md.matchAll(/^\| (\d단계) \| (.+?) \|/gm)].map(m => [m[1], m[2]]) : []; })();
    const [t1, t2] = s.tagline.split(/,\s*/);
    const docCount = cats.reduce((a, c) => a + c.docs.length, 0);
    return `
    <section class="hero" id="hero" aria-labelledby="heroTitle">
      <div class="wrap">
        <div class="hero-grid">
          <div>
            <p class="eyebrow">${esc(s.hanja)} · ${esc(s.english)} 공식 위키</p>
            <h1 id="heroTitle">${esc(t1)},${t2 ? `<br>${esc(t2)}` : ""}</h1>
          </div>
          <div class="hero-side">
            <p>${esc(s.subtitle)}입니다. 처음이라면 시작하기 문서부터, 궁금한 규칙이 있다면 조 번호나 단어로 검색하세요.</p>
            <div class="hero-ctas">
              <a class="btn btn-primary" href="#cat-start">처음 오셨나요?</a>
              <a class="btn btn-line" href="#rules">서버 규칙 보기</a>
            </div>
          </div>
        </div>
        <div class="home-search" role="search">
          <label class="sr" for="homeSearch">위키 검색</label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="homeSearch" type="search" placeholder="조 번호나 단어로 검색 (예: 33, 철수, W-7)" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="homeAc" aria-expanded="false" enterkeyhint="search">
          <kbd>/</kbd>
          <div class="ac" id="homeAc" role="listbox" aria-label="검색 추천" hidden></div>
        </div>
        <figure class="banner">
          <picture>
            <source type="image/webp" srcset="img/hero-800.webp 800w, img/hero-1200.webp 1200w, img/hero-1672.webp 1672w" sizes="(min-width: 1240px) 1160px, 100vw">
            <img id="kvImg" src="img/hero-1200.jpg" width="1672" height="941" fetchpriority="high" decoding="async" alt="월화 키 비주얼. 보름달과 벚꽃 아래 한옥, 월화 로고와 보랏빛 물약">
          </picture>
          <figcaption>${esc(s.hanja)} · 달과 꽃의 약탈 서버</figcaption>
        </figure>
        <div class="home-strip">
          <div class="srv" data-srv aria-live="polite">
            <span class="dot" aria-hidden="true"></span>
            <b data-srv-state>서버 상태 확인 중</b>
            <span class="srv-detail" data-srv-detail></span>
            <button class="srv-copy" type="button" data-srv-copy hidden>주소 복사</button>
          </div>
          ${n ? `<a class="notice-line" href="#notice-1"><span class="tag">공지</span><time datetime="${esc(n.date)}">${esc(n.date)}</time><b>${esc(n.title)}</b>${ICON.chev}</a>` : ""}
        </div>
      </div>
    </section>

    <section class="home-sec wrap" aria-labelledby="catTitle">
      <div class="cat-wrap">
        <div class="cat-intro">
          <h2 id="catTitle">하고 싶은 일로 <br>찾아보기</h2>
          <p>카테고리 ${cats.length}개 · 문서 ${docCount}개</p>
        </div>
        <ul class="cat-list">
          ${cats.map(c => `<li><a href="#cat-${esc(c.id)}" class="${c.docs.length ? "" : "empty"}">
            <span class="cat-ico ico-${esc(c.id)}">${ICON[c.icon] || ICON.info}</span>
            <span class="cat-txt"><b>${esc(c.name)}</b><span>${esc(c.desc)}</span></span>
            <span class="cat-count">${c.docs.length ? `문서 ${c.docs.length}` : "준비 중"}</span>
          </a></li>`).join("")}
        </ul>
      </div>
    </section>

    ${firstTable ? `<section class="home-sec wrap" aria-labelledby="lootTitle">
      <div class="sec-head"><h2 id="lootTitle">무엇을 털 수 있나요</h2><a href="#war">전쟁·약탈 세부 ${ICON.chev}</a></div>
      <div class="tw matrix-wrap" id="lootTable" tabindex="0" role="region" aria-label="약탈 가능 여부 표">${mdHtml(firstTable)}</div>
    </section>` : ""}

    <section class="home-sec wrap" aria-labelledby="warTitle">
      <div class="sec-head"><h2 id="warTitle">전쟁은 이렇게 진행돼요</h2><a href="#ch-4">제4장 PvP 및 전쟁 규칙 ${ICON.chev}</a></div>
      <ol class="timeline">${s.warTimeline.map(([t, h, p, k]) => `<li class="${esc(k)}"><span class="t">${esc(t)}</span><b>${esc(h)}</b><p>${esc(p)}</p></li>`).join("")}</ol>
    </section>

    <section class="home-sec wrap" aria-labelledby="penTitle">
      <div class="two">
        <div>
          <div class="sec-head"><h2 id="penTitle">즉시 영구 정지되는 행위</h2><a href="#rule-60">제60조 ${ICON.chev}</a></div>
          <ul class="severe">${sevItems.map(t => `<li><span>${inl(t)}</span></li>`).join("")}</ul>
        </div>
        <div>
          <div class="sec-head"><h2>제재 7단계</h2><a href="#penalty">제재 기준표 ${ICON.chev}</a></div>
          <div class="ladder" id="ladder">${ladder.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
          <p class="note-sm">단순 의심만으로는 정지하지 않습니다. 운영진 2인 이상이 증거를 확인합니다 (제42조).</p>
        </div>
      </div>
    </section>`;
  }
  function afterHome() {
    $$("#lootTable td").forEach(td => {
      const t = td.textContent;
      const cls = t.includes("✅") ? "ok" : t.includes("⛔") ? "no" : null;
      if (cls) td.innerHTML = `<span class="pill ${cls}">${esc(t.replace(/[✅⛔]\s*/g, "").trim())}</span>`;
    });
    $$("#lootTable table").forEach(t => t.classList.add("matrix"));
    $$("#lootTable td:last-child, .severe li > span").forEach(td => enhance(td));
    $$("#ladder > div").forEach((d, i, all) => { d.style.height = (34 + i * (66 / Math.max(1, all.length - 1))) + "%"; });
    setupAutocomplete($("#homeSearch"), $("#homeAc"));
  }

  /* ───────── 문서 레이아웃 ───────── */
  function sideHtml(r) {
    const admin = document.body.classList.contains("is-admin");
    const cur = location.hash || "";
    const cats = categories();
    const rulesOpen = r.page === "rules" || (r.page === "cat" && r.cat === "rules");
    const isCur = href => href === cur || (href === "#" + r.page) || (r.page === "cat" && href === "#cat-" + r.cat);
    return `<aside class="side" id="side" aria-label="위키 카테고리">
      <div class="side-top">
        <label class="sr" for="sideFilter">문서 거르기</label>
        <input class="side-filter" id="sideFilter" type="search" placeholder="문서·조항 제목 거르기" autocomplete="off">
      </div>
      <ul class="tree" id="sideTree">
        ${cats.map(c => {
          const open = (r.page === "cat" && r.cat === c.id) || c.docs.some(d => isCur(d.href) || (r.page === "rules" && d.href === "#ch-" + r.chapter && c.id === "rules"));
          const body = c.id === "rules" ? M.rules.chapters.map(ch => {
            const chOpen = r.page === "rules" && r.chapter === ch.no;
            return `<li data-ch="${ch.no}"><a class="leaf${chOpen ? " active" : ""}" href="#ch-${ch.no}"${chOpen ? ' aria-current="page"' : ""}><span class="no">${pad(ch.no)}</span>${esc(ch.title)}</a>
              <div class="sub${chOpen ? " open" : ""}">${ch.articles.map(a => `<a href="#rule-${a.key}" data-art="${a.key}">${a.label} ${esc(a.title)}</a>`).join("")}</div></li>`;
          }).join("") : c.docs.length ? c.docs.map(d => `<li><a class="leaf${isCur(d.href) ? " active" : ""}" href="${esc(d.href)}">${esc(d.title)}</a></li>`).join("") : `<li class="leaf-empty">준비 중</li>`;
          return `<li class="grp${open || (c.id === "rules" && rulesOpen) ? " open" : ""}" data-cat="${esc(c.id)}">
            <div class="grp-row"><a class="grp-link${r.page === "cat" && r.cat === c.id ? " active" : ""}" href="#cat-${esc(c.id)}"><span class="grp-ico">${ICON[c.icon] || ICON.info}</span>${esc(c.name)}</a>
            <button class="grp-btn" type="button" aria-label="${esc(c.name)} 펼치기" aria-expanded="${open || (c.id === "rules" && rulesOpen)}">${ICON.down}</button></div>
            <ul class="grp-body">${body}</ul></li>`;
        }).join("")}
        ${admin ? `<li class="grp open"><div class="grp-row"><a class="grp-link${r.page === "admin" ? " active" : ""}" href="#admin"><span class="grp-ico">${ICON.shield}</span>규칙 편집</a></div></li>` : ""}
      </ul>
    </aside>`;
  }
  function tocHtml(items, extra = "") {
    const links = items.map(t => `<a href="#${t.id}" class="${t.l3 ? "l3" : ""}" data-toc="${t.id}">${esc(t.label)}</a>`).join("");
    return {
      right: `<nav class="toc" aria-label="이 페이지 목차">${items.length ? `<h4>이 페이지</h4>${links}` : ""}<div class="toc-actions"><button type="button" data-top>↑ 맨 위로</button>${extra}</div></nav>`,
      inline: items.length ? `<details class="toc-inline"><summary>이 페이지 목차 <span class="n">${items.length}</span>${ICON.down}</summary><nav aria-label="이 페이지 목차">${links}</nav></details>` : "",
    };
  }
  function head(eyebrow, title, desc, tools = "", updated = "") {
    return `<header class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${desc ? `<p class="desc">${desc}</p>` : ""}
      ${updated ? `<p class="meta-line"><span>최종 수정 <time datetime="${esc(updated)}">${esc(updated)}</time></span><span>규칙 ${esc(M.site.rulesVersion)}</span></p>` : ""}
      ${tools ? `<div class="page-tools">${tools}</div>` : ""}</header>`;
  }
  function crumbs(list) {
    return `<nav class="crumbs" aria-label="현재 위치"><button class="side-toggle" type="button" data-side-toggle aria-label="사이드바 접기·펼치기">${ICON.side}</button><a href="#home">홈</a>${list.map(([h, t]) => `<span aria-hidden="true">/</span>${h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}`).join("")}</nav>`;
  }
  const copyMdBtn = key => key ? `<button class="btn-sm" type="button" data-copy-md="${key}">${ICON.copy}마크다운 복사</button>` : "";

  /* 문서 아래: 관련 문서와 이전·다음 */
  function docFooter(hrefs, exclude = []) {
    const cats = catsFor(hrefs);
    const seen = new Set([...hrefs, ...exclude]);
    const rel = [];
    cats.forEach(c => c.docs.forEach(d => { if (!seen.has(d.href) && rel.length < 6) { seen.add(d.href); rel.push({ ...d, cat: c.name }); } }));
    let pager = "";
    const c0 = cats[0];
    if (c0 && !hrefs.some(h => /^#ch-/.test(h))) {
      const i = c0.docs.findIndex(d => hrefs.includes(d.href));
      const prev = c0.docs[i - 1], next = c0.docs[i + 1];
      if (prev || next) pager = `<nav class="pager" aria-label="이전·다음 문서">${prev ? `<a href="${esc(prev.href)}"><span>← 이전 문서</span><b>${esc(prev.title)}</b></a>` : "<span></span>"}${next ? `<a class="next" href="${esc(next.href)}"><span>다음 문서 →</span><b>${esc(next.title)}</b></a>` : ""}</nav>`;
    }
    return pager + (rel.length ? `<section class="related" aria-labelledby="relTitle"><h2 id="relTitle">관련 문서</h2><ul>${rel.map(d => `<li><a href="${esc(d.href)}"><b>${esc(d.title)}</b><span>${esc(d.cat)}${d.desc ? " · " + esc(d.desc) : ""}</span></a></li>`).join("")}</ul></section>` : "");
  }

  function docsLayout(r) {
    let body = "", toc = [], extra = "";
    switch (r.page) {
      case "rules": ({ body, toc, extra } = rulesPage(r.chapter)); break;
      case "cat": ({ body, toc } = catPage(r.cat)); break;
      case "cases": ({ body, toc } = casesPage()); break;
      case "faq": ({ body, toc } = faqPage()); break;
      case "notice": ({ body, toc } = noticePage()); break;
      case "admin": body = crumbs([[null, "규칙 편집"]]) + `<div id="adminRoot"></div>`; break;
      default: ({ body, toc } = mdPage(r.page));
    }
    const t = tocHtml(toc, extra);
    return `<div class="docs" id="docs">${sideHtml(r)}<div class="content" id="content">${body.replace("<!--TOC-->", t.inline)}</div>${t.right}</div>`;
  }

  function catPage(id) {
    const c = catById(id);
    const body = crumbs([[null, c.name]]) +
      `<header class="page-head cat-head"><span class="cat-ico big ico-${esc(c.id)}">${ICON[c.icon] || ICON.info}</span><div><p class="eyebrow">카테고리</p><h1>${esc(c.name)}</h1><p class="desc">${esc(c.desc)}</p><p class="meta-line"><span>${c.docs.length ? `문서 ${c.docs.length}개` : "준비 중"}</span><span>최종 수정 ${esc(M.site.revisedAt)}</span></p></div></header>` +
      (c.docs.length ? `<ol class="doc-list">${c.docs.map((d, i) => `<li><a href="${esc(d.href)}"><span class="no">${pad(i + 1)}</span><span class="doc-txt"><b>${esc(d.title)}</b>${d.desc ? `<span>${esc(d.desc)}</span>` : ""}</span>${ICON.arrow}</a></li>`).join("")}</ol>`
        : `<blockquote class="callout callout-note"><span class="callout-label">준비 중</span><p>이 카테고리의 문서는 아직 없습니다. 운영진이 실제 서버 정보를 확인한 뒤 추가할 예정입니다. 그동안은 <a href="#faq">자주 묻는 질문</a>이나 <a href="#report">신고·문의 안내</a>를 이용해 주세요.</p></blockquote>`) +
      `<section class="related" aria-labelledby="relTitle"><h2 id="relTitle">다른 카테고리</h2><ul>${categories().filter(x => x.id !== id).slice(0, 6).map(x => `<li><a href="#cat-${esc(x.id)}"><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></a></li>`).join("")}</ul></section>`;
    return { body, toc: [] };
  }

  function rulesPage(no) {
    const c = chapterOf(no) || M.rules.chapters[0];
    const idx = M.rules.chapters.indexOf(c), prev = M.rules.chapters[idx - 1], next = M.rules.chapters[idx + 1];
    const a = c.articles;
    const desc = a.length ? `${a[0].label} ~ ${a[a.length - 1].label} · ${a.length}개 조항` : "";
    const tools = `<button class="btn-sm" type="button" data-expand="1">세부 모두 펼치기</button><button class="btn-sm" type="button" data-expand="0">모두 접기</button>${copyMdBtn("RULES")}`;
    let body = crumbs([["#cat-rules", "서버 규칙"], [null, `제${c.no}장`]]) + head(`서버 규칙 · 제${c.no}장`, esc(c.title), desc, tools, M.updated("RULES")) + "<!--TOC-->";
    if (c.no === 1 && M.rules.preamble) body += `<details class="fold"><summary>문서 정보와 표기 안내 ${ICON.chev}</summary><div class="fold-body prose" data-md="preamble"></div></details>`;
    if (c.note) body += `<div class="chapter-note prose" data-md="note"></div>`;
    body += a.map(art => {
      const rel = M.byArt[art.key] || { pen: [], cases: [] };
      const tags = [art.severe ? `<span class="tag-s severe">중대 위반</span>` : "", art.ban && !art.severe ? `<span class="tag-s ban">금지 포함</span>` : "", ...art.tags.map(t => `<span class="tag-s${t.includes("관리자 확인") ? " draft" : ""}">${esc(t)}</span>`)].join("");
      return `<article class="art${art.draft ? " draft" : ""}" id="rule-${art.key}" data-art="${art.key}" aria-labelledby="h-${art.key}">
        <div class="art-head">
          <a class="art-no" href="#rule-${art.key}">${art.label}</a><h2 id="h-${art.key}">${esc(art.title)}</h2>
          <div class="art-tools">
            <button class="mini" type="button" data-link="rule-${art.key}" aria-label="${art.label} 링크 복사">${ICON.link}<span class="lbl">링크</span></button>
            <button class="mini toggle" type="button" data-toggle aria-expanded="true" aria-label="${art.label} 접기">${ICON.down}<span class="lbl">접기</span></button>
          </div>
        </div>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        <div class="art-body"><div class="prose" data-md-art="${art.key}"></div></div>
        ${rel.pen.length || rel.cases.length ? `<div class="art-subs">
          ${rel.pen.length ? `<details class="fold"><summary>제재 기준 <span class="n">${rel.pen.length}</span>${ICON.chev}</summary><div class="fold-body"><div class="tw" tabindex="0" role="region" aria-label="제재 기준 표"><table class="pen-table"><thead><tr><th>코드</th><th>위반</th><th>기본</th><th>부가 조치</th></tr></thead><tbody>
            ${rel.pen.map(p => `<tr><td><a href="#pen-${p.code.toLowerCase()}">${esc(p.code)}</a></td><td>${inl(p.what)}</td><td>${esc(p.base)}</td><td>${inl(p.extra)}</td></tr>`).join("")}</tbody></table></div></div></details>` : ""}
          ${rel.cases.length ? `<details class="fold"><summary>관련 사례 <span class="n">${rel.cases.length}</span>${ICON.chev}</summary><div class="fold-body"><ul class="case-links">
            ${rel.cases.map(cs => `<li><a href="#case-${cs.no}"><span class="k">사례 ${pad(cs.no)}</span><span class="t">${inl(cs.title)}</span><span class="pill ${cs.verdict}">${pillOf(cs.verdict)}</span></a></li>`).join("")}</ul></div></details>` : ""}
        </div>` : ""}
      </article>`;
    }).join("");
    body += `<nav class="pager" aria-label="장 이동">${prev ? `<a href="#ch-${prev.no}"><span>← 이전 장</span><b>제${prev.no}장 ${esc(prev.title)}</b></a>` : "<span></span>"}${next ? `<a class="next" href="#ch-${next.no}"><span>다음 장 →</span><b>제${next.no}장 ${esc(next.title)}</b></a>` : ""}</nav>`;
    body += docFooter(["#ch-" + c.no, ...a.map(x => "#rule-" + x.key)], M.rules.chapters.map(x => "#ch-" + x.no));
    const toc = a.map(x => ({ id: "rule-" + x.key, label: `${x.label} ${x.title}` }));
    return { body, toc, extra: `<button type="button" data-expand="1">세부 모두 펼치기</button><button type="button" data-expand="0">모두 접기</button>` };
  }

  function mdPage(page) {
    const [title, key] = PAGE_META[page];
    const descs = { war: "전쟁 진행 순서, 신청 양식, 전쟁 구역 계산, 운영진 체크리스트.", penalty: "위반별 1차·2차·3차 제재와 영구 정지 조건. 코드를 누르면 해당 조항과 함께 볼 수 있어요.", changelog: "모든 규칙 변경과 제정 전 검수 기록.", report: "신고 접수처와 기한, 양식, 증거 준비, 처리 순서, 이의제기." };
    const parent = { war: ["#cat-war", "전쟁과 약탈"], penalty: ["#cat-penalty", "제재와 판정"], changelog: ["#cat-guide", "이용 안내"], report: ["#cat-guide", "이용 안내"] }[page];
    const body = crumbs([parent || [null, ""], [null, title]].filter(x => x[1])) + head(parent ? parent[1] : "문서", esc(title), descs[page] || "", copyMdBtn(key), M.updated(key)) + "<!--TOC-->" + `<div class="prose doc-body" data-md-doc="${key}"></div>` + docFooter(["#" + page]);
    const secs = page === "war" ? M.war : page === "changelog" ? M.changelog : page === "report" ? M.report : sectionsOf(M.md(key));
    const toc = secs.map((s, i) => ({ id: `${page}-s${i}`, label: s.title, l3: s.level === 3 }));
    return { body, toc };
  }
  function sectionsOf(md) { const o = []; md.split("\n").forEach(l => { const h = l.match(/^(#{2,3}) (.+)$/); if (h) o.push({ level: h[1].length, title: h[2].replace(/[`*]/g, "").trim() }); }); return o; }

  function casesPage() {
    const cats = [...new Set(M.cases.map(c => c.cat))];
    const chip = (k, v, label, n) => `<button class="chip" type="button" data-f="${k}" data-v="${esc(v)}" aria-pressed="${v === "all"}">${esc(label)}<span class="n">${n}</span></button>`;
    const body = crumbs([["#cat-penalty", "제재와 판정"], [null, "사례별 판정집"]]) + head("제재와 판정", "사례별 판정집", "정상적인 약탈은 처벌하지 않습니다. 피해자가 화가 났다는 사실만으로 위반이 되지 않습니다. 항목을 눌러 판정 근거와 권장 제재를 펼치세요.",
      `<div class="chips" role="group" aria-label="분류 필터">${chip("cat", "all", "전체", M.cases.length)}${cats.map(c => chip("cat", c, c, M.cases.filter(x => x.cat === c).length)).join("")}</div>
       <div class="chips" role="group" aria-label="판정 필터">${chip("v", "all", "모든 판정", M.cases.length)}${["ok", "no", "mid"].map(v => chip("v", v, pillOf(v), M.cases.filter(x => x.verdict === v).length)).join("")}</div>${copyMdBtn("CASES")}`, M.updated("CASES")) + "<!--TOC-->" +
      `<p class="filter-count" id="caseCount" aria-live="polite">${M.cases.length}건</p><ol class="case-list" id="caseList">${M.cases.map(c => `<li class="case" id="case-${c.no}" data-cat="${esc(c.cat)}" data-v="${c.verdict}">
        <button type="button" aria-expanded="false" aria-controls="cb-${c.no}"><span class="k">사례 ${pad(c.no)}</span><span class="case-t"><b>${inl(c.title)}</b><span class="cat">${esc(c.cat)}</span></span><span class="pill ${c.verdict}">${esc(c.verdictText || pillOf(c.verdict))}</span>${ICON.chev}</button>
        <div class="case-body" id="cb-${c.no}"><dl>${["상황", "관련 규칙", "판정", "근거", "권장 제재", "확인 사항"].filter(k => c.f[k]).map(k => `<dt>${k}</dt><dd class="cf">${inl(c.f[k])}</dd>`).join("")}</dl>
        <div class="case-tools"><button class="mini" type="button" data-link="case-${c.no}">${ICON.link}<span class="lbl">이 사례 링크 복사</span></button></div></div></li>`).join("")}</ol>` + docFooter(["#cases"]);
    const toc = cats.map(c => ({ id: "case-" + M.cases.find(x => x.cat === c).no, label: c }));
    return { body, toc };
  }

  function faqPage() {
    const cats = [...new Set(M.faq.map(f => f.cat))];
    const body = crumbs([[null, "자주 묻는 질문"]]) + head("도움말", "자주 묻는 질문", "신규 유저를 위한 안내입니다. 효력은 서버 규칙에 있으며, 답변의 조항 번호를 누르면 해당 규칙으로 이동합니다.", copyMdBtn("FAQ"), M.updated("FAQ")) + "<!--TOC-->" +
      cats.map((c, ci) => `<section class="faq-group" id="faq-g${ci}" aria-labelledby="fg-${ci}"><h2 id="fg-${ci}">${esc(c)}</h2><ol class="case-list">${M.faq.filter(f => f.cat === c).map(f => `
        <li class="case" id="faq-${f.id}"><button type="button" aria-expanded="false" aria-controls="fa-${f.id}"><span class="k">Q</span><span class="case-t"><b>${inl(f.q)}</b></span>${ICON.chev}</button><div class="case-body" id="fa-${f.id}"><p class="cf">${inl(f.a)}</p></div></li>`).join("")}</ol></section>`).join("") + docFooter(["#faq"]);
    return { body, toc: cats.map((c, i) => ({ id: "faq-g" + i, label: c })) };
  }

  function noticePage() {
    const body = crumbs([["#cat-guide", "이용 안내"], [null, "공지"]]) + head("이용 안내", "공지", "운영 공지와 규칙 시행 안내.", copyMdBtn("NOTICE"), M.updated("NOTICE")) + "<!--TOC-->" +
      (M.notices.length ? M.notices.map((n, i) => `<article class="art" id="notice-${i + 1}" aria-labelledby="nt-${i}"><div class="art-head"><time class="art-no" datetime="${esc(n.date)}">${esc(n.date)}</time><h2 id="nt-${i}">${esc(n.title)}</h2><div class="art-tools"><button class="mini" type="button" data-link="notice-${i + 1}">${ICON.link}<span class="lbl">링크</span></button></div></div><div class="art-body"><div class="prose" data-md-notice="${i}"></div></div></article>`).join("") : `<p class="empty-note">등록된 공지가 없습니다.</p>`) + docFooter(["#notice"]);
    return { body, toc: M.notices.map((n, i) => ({ id: "notice-" + (i + 1), label: n.date + " " + n.title })) };
  }

  function afterDocs(r) {
    const content = $("#content");
    $$("[data-md-art]", content).forEach(el => { const a = M.artByKey(el.dataset.mdArt); el.innerHTML = mdHtml(a.md); enhance(el); });
    $$("[data-md='preamble']", content).forEach(el => { el.innerHTML = mdHtml(M.rules.preamble.replace(/^# .+\n/, "")); enhance(el); });
    $$("[data-md='note']", content).forEach(el => { el.innerHTML = mdHtml(chapterOf(r.chapter).note); enhance(el); });
    $$("[data-md-notice]", content).forEach(el => { el.innerHTML = mdHtml(M.notices[+el.dataset.mdNotice].md); enhance(el); });
    $$("[data-md-doc]", content).forEach(el => {
      el.innerHTML = mdHtml(M.md(el.dataset.mdDoc).replace(/^# .+\n/, "")); enhance(el, { headPrefix: r.page });
      if (r.page === "penalty") penaltyTables(el);
    });
    $$(".cf", content).forEach(el => enhance(el));
    if (r.page === "admin" && WH.renderAdmin) WH.renderAdmin($("#adminRoot"));

    // 사이드바: 그룹 펼침 + 거르기
    $$("#sideTree .grp-btn").forEach(b => b.addEventListener("click", () => {
      const g = b.closest(".grp"), open = !g.classList.contains("open"); g.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
    }));
    const activeLeaf = $("#side .leaf.active, #side .grp-link.active");
    if (activeLeaf) requestAnimationFrame(() => { const side = $("#side"); const top = activeLeaf.offsetTop - side.clientHeight / 3; if (top > 0) side.scrollTop = top; });
    $("#sideFilter").addEventListener("input", e => {
      const q = e.target.value.trim().toLowerCase();
      $$("#sideTree > .grp").forEach(g => {
        let any = false;
        $$(".grp-body > li", g).forEach(li => {
          const own = (li.querySelector(".leaf") || li).textContent.toLowerCase();
          let subHit = false;
          $$(".sub a", li).forEach(a => { const hit = !q || a.textContent.toLowerCase().includes(q) || a.dataset.art === q.replace(/\D/g, ""); a.classList.toggle("hidden", !hit); subHit = subHit || (q && hit); });
          const hit = !q || own.includes(q) || subHit;
          li.classList.toggle("hidden", !hit); any = any || hit;
          const sub = $(".sub", li); if (sub) sub.classList.toggle("open", q ? subHit : !!li.querySelector(".leaf.active"));
        });
        const name = g.querySelector(".grp-link").textContent.toLowerCase();
        g.classList.toggle("hidden", !!q && !any && !name.includes(q));
        if (q) g.classList.toggle("open", any);
      });
    });

    // 판정집·FAQ
    const filt = { cat: "all", v: "all" };
    $$("[data-f]", content).forEach(b => b.addEventListener("click", () => {
      filt[b.dataset.f] = b.dataset.v;
      $$(`[data-f="${b.dataset.f}"]`, content).forEach(x => x.setAttribute("aria-pressed", x === b));
      let n = 0;
      $$("#caseList .case").forEach(li => { const on = (filt.cat === "all" || li.dataset.cat === filt.cat) && (filt.v === "all" || li.dataset.v === filt.v); li.hidden = !on; n += on; });
      const cc = $("#caseCount"); if (cc) cc.textContent = n + "건";
    }));
    $$(".case > button", content).forEach(b => b.addEventListener("click", () => {
      const li = b.parentElement, open = !li.classList.contains("open"); li.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
    }));
    trackReading();
  }

  /* 제재표: 기본 단계로 1·2·3차를 계산해 열을 더하고, 분류 필터와 모바일 카드 표시를 붙인다 */
  function penaltyTables(el) {
    const groups = [];
    $$("table", el).forEach(t => {
      const headCells = [...(t.tHead?.rows[0]?.cells || [])].map(c => c.textContent.trim());
      if (headCells[0] !== "코드" || headCells[3] !== "기본") return;
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
        const st = n => `${Math.min(7, n)}단계`;
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
      $("table.pen-rows", el).closest(".tw").previousElementSibling.before(bar);
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
      $$(".toc a[data-toc], .toc-inline a").forEach(a => { const on = a.getAttribute("href") === "#" + id; a.classList.toggle("reading", on); if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      $$(".sub a").forEach(a => a.classList.toggle("reading", "rule-" + a.dataset.art === id));
    };
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) set(vis[0].target.id);
    }, { rootMargin: "-120px 0px -65% 0px" });
    targets.forEach(t => io.observe(t));
    set(targets[0].id);
    cleanup.push(() => io.disconnect());
  }

  /* ───────── 위임 이벤트 ───────── */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-link],[data-toggle],[data-expand],[data-copy-md],[data-top],[data-open-search],[data-side-toggle],.code-copy,.toc a,.toc-inline a");
    if (!t) return;
    if (t.matches("[data-link]")) copy(linkOf(t.dataset.link), "링크를 복사했어요");
    else if (t.matches(".code-copy")) { const pre = t.closest(".code").querySelector("pre"); copy(pre.innerText.replace(/\n$/, ""), "복사했어요"); }
    else if (t.matches("[data-toggle]")) {
      const art = t.closest(".art"), c = !art.classList.contains("collapsed");
      art.classList.toggle("collapsed", c); t.setAttribute("aria-expanded", !c); $(".lbl", t).textContent = c ? "펼치기" : "접기";
    } else if (t.matches("[data-expand]")) {
      const on = t.dataset.expand === "1";
      $$("#content .art").forEach(a => { a.classList.toggle("collapsed", !on); const b = $("[data-toggle]", a); if (b) { b.setAttribute("aria-expanded", on); $(".lbl", b).textContent = on ? "접기" : "펼치기"; } });
      $$("#content details.fold").forEach(d => { d.open = on; });
      $$("#content .case").forEach(c => { c.classList.toggle("open", on); const b = c.querySelector(":scope > button"); if (b) b.setAttribute("aria-expanded", on); });
      toast(on ? "모든 항목을 펼쳤어요" : "모든 항목을 접었어요");
    } else if (t.matches("[data-copy-md]")) copy(M.md(t.dataset.copyMd), `${t.dataset.copyMd}.md 를 복사했어요`);
    else if (t.matches("[data-top]")) scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    else if (t.matches("[data-open-search]")) openSearch();
    else if (t.matches("[data-side-toggle]")) {
      const off = !document.body.classList.contains("side-off"); document.body.classList.toggle("side-off", off);
      try { localStorage.setItem("wolhwa-side", off ? "off" : "on"); } catch {}
      toast(off ? "사이드바를 접었어요" : "사이드바를 펼쳤어요");
    } else if (t.matches(".toc a,.toc-inline a")) {
      const id = t.getAttribute("href").slice(1);
      const rr = route("#" + id);
      if (document.getElementById(id) && rr && rr.page === state.page) { e.preventDefault(); jump(id, true); if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id); const d = t.closest("details"); if (d) d.open = false; }
    }
  });
  try { if (localStorage.getItem("wolhwa-side") === "off") document.body.classList.add("side-off"); } catch {}

  /* ───────── 검색 ───────── */
  let INDEX = [], palFilter = "all", palSel = 0, palItems = [];
  const PAL_CATS = [["all", "전체"], ["규칙", "규칙"], ["제재", "제재"], ["사례", "사례"], ["FAQ", "FAQ"], ["전쟁", "전쟁"], ["안내", "안내·공지"], ["카테고리", "카테고리"]];
  function buildIndex() {
    INDEX = [
      ...M.articles.map(a => ({ type: "규칙", num: a.sub ? null : a.no, key: a.key, title: `${a.label} ${a.title}`, sub: `제${a.chapter}장 ${chapterOf(a.chapter).title}${a.draft ? " · 관리자 확인 필요" : ""}`, text: a.text, href: "#rule-" + a.key })),
      ...M.penalty.map(p => ({ type: "제재", code: p.code, title: `${p.code} ${p.what.replace(/[🚨*]/g, "").trim()}`, sub: `${p.group} · ${p.clause} · 기본 ${p.base}`, text: WH.plain(p.extra), href: "#pen-" + p.code.toLowerCase() })),
      ...M.cases.map(c => ({ type: "사례", title: `사례 ${c.no}. ${c.title}`, sub: `${c.cat} · ${pillOf(c.verdict)}`, text: c.text, href: "#case-" + c.no })),
      ...M.faq.map(f => ({ type: "FAQ", title: f.q, sub: f.cat, text: f.text, href: "#faq-" + f.id })),
      ...M.war.map((s, i) => ({ type: "전쟁", title: s.title, sub: "전쟁·약탈 세부 절차", text: s.text, href: "#war-s" + i })),
      ...M.report.map((s, i) => ({ type: "안내", title: s.title, sub: "신고·문의 안내", text: s.text, href: "#report-s" + i })),
      ...M.notices.map((n, i) => ({ type: "안내", title: n.title, sub: "공지 · " + n.date, text: WH.plain(n.md), href: "#notice-" + (i + 1) })),
      ...M.changelog.map((s, i) => ({ type: "안내", title: s.title, sub: "규칙 변경 이력", text: s.text, href: "#changelog-s" + i })),
      ...categories().map(c => ({ type: "카테고리", title: c.name, sub: c.docs.length ? `문서 ${c.docs.length}개` : "준비 중", text: c.desc + " " + c.docs.map(d => d.title + " " + (d.desc || "")).join(" "), href: "#cat-" + c.id })),
    ];
    INDEX.forEach(it => { it.hay = (it.title + " " + it.sub + " " + it.text).toLowerCase(); it.tl = it.title.toLowerCase(); });
  }
  function search(q, filter = palFilter) {
    const pool = INDEX.filter(it => filter === "all" || it.type === filter);
    q = q.trim();
    if (!q) return filter === "all" ? pool.filter(it => [14, 15, 16, 17, 18, 30, 33, 60].includes(it.num)) : pool.slice(0, 15);
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
        if (it.type === "카테고리") s += 2;
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
    const start = Math.max(0, at - 40); txt = (start ? "…" : "") + txt.slice(start, start + 140) + (txt.length > start + 140 ? "…" : "");
    return hl(txt, terms);
  }
  function hl(text, terms) {
    let h = esc(text);
    terms.filter(t => t.length).sort((a, b) => b.length - a.length).forEach(t => { h = h.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`); });
    return h;
  }
  function resultHtml(items, q, withSnippet) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let lastType = "", html = "";
    items.forEach((it, i) => {
      if (q.trim() && it.type !== lastType) { html += `<div class="pal-group" role="presentation">${esc(it.type)}</div>`; lastType = it.type; }
      html += `<a href="${it.href}" role="option" id="opt-${i}" class="${i === 0 ? "sel" : ""}" aria-selected="${i === 0}"><span class="ti">${hl(it.title, terms)}</span><span class="sn">${esc(it.sub)}${withSnippet && q.trim() ? " · " + snippet(it, q) : ""}</span></a>`;
    });
    return html;
  }
  function drawResults() {
    const q = $("#palInput").value;
    palItems = search(q); palSel = 0;
    // 묶음 표시를 위해 같은 종류끼리 모으되, 처음 나온 순서를 지킨다
    if (q.trim()) { const order = [...new Set(palItems.map(i => i.type))]; palItems.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)); }
    const box = $("#palResults");
    if (!palItems.length) {
      box.innerHTML = q.trim() ? `<div class="pal-empty"><b>"${esc(q)}"</b>에 맞는 결과가 없어요.<br>다른 단어나 조 번호(예: 15)로 찾아보세요.${palFilter !== "all" ? " 카테고리를 '전체'로 바꿔 보세요." : ""}<br><a href="#faq">자주 묻는 질문</a> · <a href="#report">신고·문의 안내</a></div>`
        : `<div class="pal-empty">조 번호, 제재 코드, 단어로 찾을 수 있어요. 예: <b>33</b>, <b>W-7</b>, <b>엔더 상자</b></div>`;
    } else {
      box.innerHTML = (q.trim() ? "" : `<div class="pal-group">자주 찾는 조항</div>`) + resultHtml(palItems, q, true);
    }
    $("#palInput").setAttribute("aria-activedescendant", palItems.length ? "opt-0" : "");
    $("#palCount").textContent = q.trim() ? `${palItems.length}건` : "";
    $$("#palChips .chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.c === palFilter));
  }
  let lastFocus = null;
  function openSearch(prefill) {
    const p = $("#palette"); lastFocus = document.activeElement;
    p.hidden = false; requestAnimationFrame(() => p.classList.add("open")); document.body.classList.add("no-scroll");
    const inp = $("#palInput"); if (prefill != null) inp.value = prefill; drawResults(); setTimeout(() => inp.focus(), 30);
  }
  function closeSearch() {
    const p = $("#palette"); if (p.hidden) return;
    p.classList.remove("open"); document.body.classList.remove("no-scroll");
    setTimeout(() => { p.hidden = true; }, reduce ? 0 : 160);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function moveSel(links, d, inputEl) {
    if (!links.length) return;
    palSel = (palSel + d + links.length) % links.length;
    links.forEach((a, i) => { a.classList.toggle("sel", i === palSel); a.setAttribute("aria-selected", i === palSel); });
    links[palSel].scrollIntoView({ block: "nearest" });
    inputEl.setAttribute("aria-activedescendant", links[palSel].id);
  }
  function follow(href, q) { WH.lastQuery = q; if (location.hash === href) go(); else location.hash = href; }
  function setupSearch() {
    $("#palChips").innerHTML = PAL_CATS.map(([k, l]) => `<button type="button" class="chip" data-c="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("");
    $("#palChips").addEventListener("click", e => { const c = e.target.closest(".chip"); if (!c) return; palFilter = c.dataset.c; drawResults(); $("#palInput").focus(); });
    $("#palInput").addEventListener("input", drawResults);
    $("#palInput").addEventListener("keydown", e => {
      const links = $$("#palResults a[role=option]");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveSel(links, e.key === "ArrowDown" ? 1 : -1, e.target); }
      else if (e.key === "Enter") { e.preventDefault(); const a = links[palSel]; if (a) { const q = e.target.value.trim(); closeSearch(); follow(a.getAttribute("href"), q); } }
      else if (e.key === "Tab") { // 대화상자 안에서 포커스 순환
        const f = $$("#palette button, #palette input, #palette a[href]").filter(x => x.offsetParent);
        if (!f.length) return; const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    $("#palResults").addEventListener("click", e => { const a = e.target.closest("a"); if (a) { e.preventDefault(); const q = $("#palInput").value.trim(); closeSearch(); follow(a.getAttribute("href"), q); } });
    $("#palClose").addEventListener("click", closeSearch);
    $("#palette").addEventListener("click", e => { if (e.target.id === "palette") closeSearch(); });
    $("#searchBtn").addEventListener("click", () => openSearch());
    $("#tabSearch").addEventListener("click", () => openSearch());
    document.addEventListener("keydown", e => {
      const a = document.activeElement, typing = /INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        const hs = $("#homeSearch"); if (hs && hs.getBoundingClientRect().bottom > 0 && hs.getBoundingClientRect().top < innerHeight) hs.focus(); else openSearch();
      } else if (e.key === "Escape") { closeSearch(); closeDrawer(); }
    });
  }
  /* 홈 검색창 자동완성 */
  function setupAutocomplete(input, box) {
    if (!input) return;
    let sel = -1, items = [];
    const close = () => { box.hidden = true; input.setAttribute("aria-expanded", "false"); sel = -1; };
    const draw = () => {
      const q = input.value.trim();
      if (!q) { close(); return; }
      items = search(q, "all").slice(0, 7);
      box.innerHTML = items.length
        ? items.map((it, i) => `<a href="${it.href}" role="option" id="ac-${i}" aria-selected="false"><span class="ty">${esc(it.type)}</span><span class="ti">${hl(it.title, q.toLowerCase().split(/\s+/))}</span><span class="sn">${esc(it.sub)}</span></a>`).join("") + `<button type="button" class="ac-all">"${esc(q)}" 전체 결과 보기 ${ICON.arrow}</button>`
        : `<div class="pal-empty">"${esc(q)}"에 맞는 문서가 없어요. 조 번호나 다른 단어로 찾아보세요.</div>`;
      box.hidden = false; input.setAttribute("aria-expanded", "true"); sel = -1;
    };
    const pick = i => { const a = box.querySelectorAll("a")[i]; if (a) { close(); follow(a.getAttribute("href"), input.value.trim()); } };
    input.addEventListener("input", draw);
    input.addEventListener("focus", () => { if (input.value.trim()) draw(); });
    input.addEventListener("keydown", e => {
      const links = [...box.querySelectorAll("a")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (box.hidden) draw(); if (!links.length) return;
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => { a.classList.toggle("sel", i === sel); a.setAttribute("aria-selected", i === sel); });
        input.setAttribute("aria-activedescendant", "ac-" + sel);
      } else if (e.key === "Enter") { e.preventDefault(); if (sel >= 0) pick(sel); else if (links.length) pick(0); else if (input.value.trim()) openSearch(input.value); }
      else if (e.key === "Escape") { e.stopPropagation(); close(); input.blur(); }
    });
    box.addEventListener("mousedown", e => e.preventDefault());
    box.addEventListener("click", e => {
      const a = e.target.closest("a"); if (a) { e.preventDefault(); pick([...box.querySelectorAll("a")].indexOf(a)); return; }
      if (e.target.closest(".ac-all")) { const q = input.value; close(); openSearch(q); }
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  /* ───────── 전체 메뉴(서랍) ───────── */
  function drawerHtml() {
    return `<a class="d-home" href="#home">${ICON.chev}홈</a>` + categories().map(c => `<section class="d-grp"><a class="d-cat" href="#cat-${esc(c.id)}"><span class="grp-ico">${ICON[c.icon] || ICON.info}</span>${esc(c.name)}<span class="d-n">${c.docs.length || "준비 중"}</span></a>${c.docs.length ? `<ul>${c.docs.map(d => `<li><a href="${esc(d.href)}">${esc(d.title)}</a></li>`).join("")}</ul>` : ""}</section>`).join("") +
      (document.body.classList.contains("is-admin") ? `<section class="d-grp"><a class="d-cat" href="#admin"><span class="grp-ico">${ICON.shield}</span>규칙 편집</a></section>` : "");
  }
  function openDrawer() {
    const d = $("#drawer"); $("#drawerBody").innerHTML = drawerHtml(); markNav(route(location.hash) || { page: "home" });
    $("#scrim").hidden = false; d.setAttribute("aria-hidden", "false"); d.inert = false;
    requestAnimationFrame(() => document.body.classList.add("drawer-open"));
    $("#menuBtn").setAttribute("aria-expanded", "true");
    setTimeout(() => { const act = $("#drawerBody a.active") || $("#drawerClose"); act.focus({ preventScroll: false }); }, 60);
  }
  function closeDrawer() {
    if (!document.body.classList.contains("drawer-open")) return;
    document.body.classList.remove("drawer-open");
    const d = $("#drawer"); d.setAttribute("aria-hidden", "true"); d.inert = true;
    $("#menuBtn").setAttribute("aria-expanded", "false");
    setTimeout(() => { $("#scrim").hidden = true; }, reduce ? 0 : 220);
  }
  $("#drawer").inert = true;
  $("#menuBtn").addEventListener("click", () => document.body.classList.contains("drawer-open") ? closeDrawer() : openDrawer());
  $("#tabMenu").addEventListener("click", openDrawer);
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", closeDrawer);
  $("#drawerBody").addEventListener("click", e => { const a = e.target.closest("a"); if (a && a.getAttribute("href") === location.hash) closeDrawer(); });

  /* ───────── 테마 ───────── */
  const root = document.documentElement;
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const paintTheme = () => { const d = isDark(); $("#themeBtn").setAttribute("aria-label", d ? "라이트 모드로 바꾸기" : "다크 모드로 바꾸기"); $(".theme-label").textContent = d ? "라이트" : "다크"; };
  try { const t = localStorage.getItem("wolhwa-theme"); if (t) root.dataset.theme = t; } catch {}
  paintTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintTheme);
  $("#themeBtn").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.classList.add("theming"); root.dataset.theme = next; setTimeout(() => root.classList.remove("theming"), 320);
    try { localStorage.setItem("wolhwa-theme", next); } catch {}
    paintTheme(); toast(next === "dark" ? "다크 모드" : "라이트 모드");
  });

  /* ───────── 스크롤: 진행 표시, 헤더 그림자, 맨 위로 ───────── */
  function onScroll() {
    const h = document.documentElement.scrollHeight - innerHeight;
    $("#progress").style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    $("#top").classList.toggle("scrolled", scrollY > 8);
    $("#toTop").classList.toggle("show", scrollY > 700);
  }
  let scT = false;
  addEventListener("scroll", () => { if (scT) return; scT = true; requestAnimationFrame(() => { onScroll(); scT = false; }); }, { passive: true });
  $("#toTop").addEventListener("click", () => { scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); $("#view").focus({ preventScroll: true }); });

  /* ───────── 푸터 ───────── */
  function footer() {
    const s = M.site, last = M.latestEdit();
    $("#foot").innerHTML = `<div class="wrap">
      <div class="foot-top">
        <div class="foot-brand"><b>${esc(s.name)} <span>${esc(s.hanja)}</span></b><p>${esc(s.tagline)}</p></div>
        <nav class="foot-links" aria-label="바닥글 메뉴"><a href="#rules">서버 규칙</a><a href="#penalty">제재 기준표</a><a href="#cases">판정집</a><a href="#faq">자주 묻는 질문</a><a href="#report">신고·문의</a><a href="#notice">공지</a><a href="#changelog">변경 이력</a></nav>
      </div>
      <div class="foot-cols">
        <div><h2>서버 정보</h2><dl><dt>상태</dt><dd data-srv-mini>확인 중</dd>${s.status && s.status.address ? `<dt>주소</dt><dd>${esc(s.status.address)}</dd>` : ""}${s.server.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
        <div><h2>운영 안내</h2><dl>${s.support.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
      </div>
      <div class="foot-bottom"><span>규칙 ${esc(s.rulesVersion)} · 개정일 <time datetime="${esc(s.revisedAt)}">${esc(s.revisedAt)}</time>${last ? ` · 운영진 최근 수정 ${esc(last.slice(0, 10))}` : ""}</span><span>© ${esc(s.name)}(${esc(s.hanja)}) 운영진 · Minecraft는 Mojang Studios의 상표이며 이 사이트는 Mojang과 관계가 없습니다.</span></div>
    </div>`;
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
    view.innerHTML = `<div class="wrap load-error"><h1>문서를 불러오지 못했어요</h1><p>${esc(err.message)} · 잠시 뒤 새로고침해 주세요.</p></div>`;
  });
})();

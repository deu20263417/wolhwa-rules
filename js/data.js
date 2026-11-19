/* 월화 규칙 데이터 계층
   - data/*.md 와 data/site.json 을 읽어 구조화한다.
   - 관리자 수정본(db)이 있으면 원본 대신 사용한다 (admin.js 가 setOverride 호출).
   - 화면 코드는 이 모듈이 만든 WH.model 만 읽는다. */
(function () {
  const DOC_KEYS = ["RULES", "WAR_RULES", "PENALTY", "CASES", "FAQ", "CHANGELOG", "NOTICE", "REPORT"];
  const raw = {};        // 파일 원본
  const override = {};   // 관리자 수정본 {md, updatedAt}

  const src = k => (override[k] && override[k].md) || raw[k] || "";
  const refs = t => [...new Set([...(t || "").matchAll(/제(\d+)조(?:의(\d+))?/g)].map(m => m[2] ? m[1] + "-" + m[2] : m[1]))];
  const plain = md => (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ").trim();

  function parseRules(md) {
    const lines = md.split("\n");
    const chapters = []; let ch = null, art = null; const pre = [];
    const flush = () => { if (art) { art.md = art.md.trim(); art.text = plain(art.md); } };
    for (const line of lines) {
      const c = line.match(/^## 제(\d+)장 (.+)$/);
      if (c) { flush(); art = null; ch = { no: +c[1], title: c[2].trim(), note: "", articles: [] }; chapters.push(ch); continue; }
      const a = line.match(/^### 제(\d+)조(?:의(\d+))? \((.+?)\)(.*)$/);
      if (a && ch) {
        flush();
        const rest = a[4] || "";
        const tags = [...rest.matchAll(/`\[([^\]]+)\]`/g)].map(m => m[1]);
        const key = a[2] ? a[1] + "-" + a[2] : a[1];
        art = { no: +a[1], sub: a[2] ? +a[2] : 0, key, label: "제" + a[1] + "조" + (a[2] ? "의" + a[2] : ""), title: a[3].trim(), tags, draft: tags.some(t => t.includes("관리자 확인")), severe: rest.includes("🚨"), ban: rest.includes("⛔"), chapter: ch.no, md: "" };
        ch.articles.push(art); continue;
      }
      if (/^---\s*$/.test(line)) { continue; }
      if (art) art.md += line + "\n";
      else if (ch) ch.note += line + "\n";
      else pre.push(line);
    }
    flush();
    chapters.forEach(c => { c.note = c.note.trim(); });
    return { chapters, preamble: pre.join("\n").trim() };
  }

  function parsePenalty(md) {
    const rows = []; let group = "";
    md.split("\n").forEach(line => {
      const g = line.match(/^### (.+)$/); if (g) { group = g[1].trim(); return; }
      const r = line.match(/^\| ([A-Z]-\d+) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|\s*$/);
      if (r) rows.push({ code: r[1], what: r[2].trim(), clause: r[3].trim(), base: r[4].trim(), extra: r[5].trim(), group, refs: refs(r[3]), severe: r[2].includes("🚨") });
    });
    return rows;
  }

  function parseCases(md) {
    const cases = []; let cat = "";
    md.split("\n").forEach(line => {
      const h2 = line.match(/^## (.+)$/); if (h2) { cat = h2[1].trim(); return; }
      const h3 = line.match(/^### 사례 (\d+)\. (.+)$/); if (h3) { cases.push({ no: +h3[1], title: h3[2].trim(), cat, f: {} }); return; }
      const f = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
      if (f && cases.length) cases[cases.length - 1].f[f[1]] = f[2].trim();
    });
    cases.forEach(c => {
      const v = c.f["판정"] || "";
      c.verdict = v.startsWith("✅") ? "ok" : v.startsWith("⛔") ? "no" : "mid";
      c.verdictText = v.replace(/^[✅⛔⚖️️🚨\s]+/u, "").trim();
      c.refs = refs(c.f["관련 규칙"]);
      c.text = plain(Object.values(c.f).join(" "));
    });
    return cases;
  }

  function parseFaq(md) {
    const items = []; let cat = "", cur = null;
    md.split("\n").forEach(line => {
      const h = line.match(/^## (.+)$/); if (h) { cat = h[1].trim(); cur = null; return; }
      const q = line.match(/^\*\*Q\. (.+)\*\*\s*$/); if (q) { cur = { q: q[1].trim(), a: "", cat }; items.push(cur); return; }
      if (cur && line.trim() && !/^---/.test(line)) cur.a += (cur.a ? " " : "") + line.trim();
    });
    items.forEach((it, i) => { it.id = i + 1; it.refs = refs(it.a); it.text = plain(it.a); });
    return items;
  }

  function sections(md) {
    // 제목(##, ###) 단위로 나눈 검색용 조각
    const out = []; let cur = null;
    md.split("\n").forEach(line => {
      const h = line.match(/^(#{2,3}) (.+)$/);
      if (h) { cur = { level: h[1].length, title: h[2].replace(/[`*]/g, "").trim(), body: "" }; out.push(cur); return; }
      if (cur) cur.body += line + "\n";
    });
    out.forEach((s, i) => { s.index = i; s.text = plain(s.body); });
    return out;
  }

  function parseNotices(md) {
    const out = []; let cur = null;
    md.split("\n").forEach(line => {
      const h = line.match(/^## (\d{4}-\d{2}-\d{2}) · (.+)$/);
      if (h) { cur = { date: h[1], title: h[2].trim(), md: "" }; out.push(cur); return; }
      if (cur) cur.md += line + "\n";
    });
    return out;
  }

  function build() {
    const rules = parseRules(src("RULES"));
    const articles = rules.chapters.flatMap(c => c.articles);
    const penalty = parsePenalty(src("PENALTY"));
    const cases = parseCases(src("CASES"));
    const faq = parseFaq(src("FAQ"));
    const byArt = {};
    articles.forEach(a => { byArt[a.key] = { pen: [], cases: [] }; });
    penalty.forEach(p => p.refs.forEach(n => byArt[n] && byArt[n].pen.push(p)));
    cases.forEach(c => c.refs.forEach(n => byArt[n] && byArt[n].cases.push(c)));
    WH.model = {
      site: WH.site,
      rules, articles, byArt, penalty, cases, faq,
      war: sections(src("WAR_RULES")),
      changelog: sections(src("CHANGELOG")),
      notices: parseNotices(src("NOTICE")),
      report: sections(src("REPORT")),
      artByKey: k => articles.find(a => a.key === String(k)),
      md: k => src(k),
      overridden: k => !!(override[k] && override[k].md),
      overrideInfo: k => override[k] || null,
      wiki: WH.wiki,
      updated: k => (override[k] && override[k].updatedAt && override[k].updatedAt.slice(0, 10)) || (WH.meta.files && WH.meta.files[k + ".md"]) || WH.site.revisedAt,
      latestEdit: () => Object.values(override).map(o => o.updatedAt).filter(Boolean).sort().pop() || null,
    };
    return WH.model;
  }

  async function load() {
    const get = async (p, json) => {
      const r = await fetch(p, { cache: "no-cache" });
      if (!r.ok) throw new Error(p + " " + r.status);
      return json ? r.json() : r.text();
    };
    const opt = p => get(p, true).catch(() => null);
    const [site, wiki, meta, ...docs] = await Promise.all([get("data/site.json", true), opt("data/wiki.json"), opt("data/meta.json"), ...DOC_KEYS.map(k => get("data/" + k + ".md"))]);
    WH.site = site; WH.wiki = wiki || { categories: [] }; WH.meta = meta || { files: {} };
    DOC_KEYS.forEach((k, i) => { raw[k] = docs[i]; });
    return build();
  }

  window.WH = window.WH || {};
  Object.assign(WH, {
    DOC_KEYS, load, build, plain,
    rawDoc: k => raw[k] || "",
    setOverride(k, o) { if (o && o.md) override[k] = o; else delete override[k]; },
  });
})();

// 규칙 데이터 검증: 배포 전에 형식 오류와 깨진 조항 참조를 잡는다.
// 사용: node scripts/validate.mjs   (오류가 있으면 종료 코드 1)
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = f => readFileSync(new URL("../data/" + f, import.meta.url), "utf8");
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);

// site.json
let site;
try { site = JSON.parse(read("site.json")); } catch (e) { err("site.json: JSON 형식 오류 " + e.message); }
if (site) for (const k of ["name", "rulesVersion", "revisedAt", "server", "support", "warTimeline", "keyNumbers"]) if (!(k in site)) err(`site.json: '${k}' 항목이 없음`);

// RULES
const rules = read("RULES.md");
const keys = new Set(); let lastCh = 0, lastNo = 0, lastSub = 0, chCount = 0;
for (const line of rules.split("\n")) {
  const c = line.match(/^## 제(\d+)장 (.+)$/);
  if (c) { chCount++; if (+c[1] !== lastCh + 1) err(`RULES: 제${c[1]}장 번호가 이어지지 않음 (앞: 제${lastCh}장)`); lastCh = +c[1]; continue; }
  if (/^### 제/.test(line)) {
    const a = line.match(/^### 제(\d+)조(?:의(\d+))? \((.+?)\)/);
    if (!a) { err("RULES: 조 제목 형식 오류 → " + line); continue; }
    const n = +a[1], sub = a[2] ? +a[2] : 0, key = sub ? `${n}-${sub}` : `${n}`;
    if (keys.has(key)) err(`RULES: 제${a[1]}조${sub ? "의" + sub : ""} 중복`);
    if (!sub && n !== lastNo + 1) err(`RULES: 제${n}조 번호가 이어지지 않음 (앞: 제${lastNo}조)`);
    if (sub && (n !== lastNo || sub !== (lastSub || 1) + 1)) err(`RULES: 제${n}조의${sub} 위치 오류`);
    if (!sub) { lastNo = n; lastSub = 0; } else lastSub = sub;
    keys.add(key);
  }
}
if (chCount === 0) err("RULES: 장(## 제N장)이 없음");

// 모든 문서의 조항 참조
const docs = ["RULES.md", "WAR_RULES.md", "PENALTY.md", "CASES.md", "FAQ.md", "CHANGELOG.md", "NOTICE.md", "REPORT.md"];
for (const f of docs) {
  if (!existsSync(new URL("../data/" + f, import.meta.url))) { err(`${f}: 파일 없음`); continue; }
  const t = read(f);
  for (const m of t.matchAll(/제(\d+)조(?:의(\d+))?/g)) {
    const k = m[2] ? `${m[1]}-${m[2]}` : m[1];
    if (!keys.has(k)) err(`${f}: 없는 조항 참조 '${m[0]}'`);
  }
}

// PENALTY
const pen = read("PENALTY.md"); const codes = new Set();
for (const m of pen.matchAll(/^\| ([A-Z]-\d+) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|\s*$/gm)) {
  if (codes.has(m[1])) err(`PENALTY: 코드 ${m[1]} 중복`); codes.add(m[1]);
  if (!/제\d+조/.test(m[3])) err(`PENALTY: ${m[1]} 조항 칸에 조 번호 없음`);
  if (!/\d단계|\+1단계/.test(m[4])) err(`PENALTY: ${m[1]} 기본 단계 형식 오류 '${m[4]}'`);
}
if (codes.size === 0) err("PENALTY: 처벌표 행이 없음");

// CASES
const cases = read("CASES.md"); let lastCase = 0;
const blocks = cases.split(/^### 사례 /m).slice(1);
for (const b of blocks) {
  const h = b.match(/^(\d+)\. (.+)/); if (!h) { err("CASES: 사례 제목 형식 오류"); continue; }
  if (+h[1] !== lastCase + 1) err(`CASES: 사례 ${h[1]} 번호가 이어지지 않음`); lastCase = +h[1];
  for (const f of ["상황", "관련 규칙", "판정", "근거", "권장 제재"]) if (!b.includes(`- **${f}**:`)) err(`CASES: 사례 ${h[1]}에 '${f}' 없음`);
  const v = (b.match(/- \*\*판정\*\*: (.)/) || [])[1];
  if (v && !"✅⛔⚖".includes(v)) err(`CASES: 사례 ${h[1]} 판정 기호 오류 (✅ ⛔ ⚖️ 중 하나)`);
}

// FAQ
const faq = read("FAQ.md"); const qs = [...faq.matchAll(/^\*\*Q\. .+\*\*\s*$/gm)];
if (!qs.length) err("FAQ: 질문(**Q. ...**)이 없음");

// NOTICE
for (const m of read("NOTICE.md").matchAll(/^## (.+)$/gm)) if (!/^\d{4}-\d{2}-\d{2} · .+/.test(m[1])) err(`NOTICE: 제목 형식 오류 '${m[1]}' (YYYY-MM-DD · 제목)`);

// wiki.json: 카테고리 주소가 실제로 있는지
try {
  const wiki = JSON.parse(read("wiki.json")); const ids = new Set(); const pages = new Set(["#rules", "#war", "#penalty", "#cases", "#faq", "#changelog", "#notice", "#report"]);
  const chs = chCount;
  for (const c of wiki.categories || []) {
    if (!c.id || !/^[a-z]+$/.test(c.id)) err(`wiki.json: 카테고리 id 형식 오류 '${c.id}' (영문 소문자)`);
    if (ids.has(c.id)) err(`wiki.json: 카테고리 id 중복 '${c.id}'`); ids.add(c.id);
    if (!Array.isArray(c.docs)) { if (!["chapters", "faq"].includes(c.docs)) err(`wiki.json: ${c.id} docs 형식 오류`); continue; }
    if (!c.docs.length) warn(`wiki.json: '${c.name}' 카테고리는 문서가 없어 '준비 중'으로 표시됨`);
    for (const d of c.docs) {
      const h = d.href || ""; let m;
      const ok = pages.has(h) || ((m = h.match(/^#ch-(\d+)$/)) && +m[1] >= 1 && +m[1] <= chs) || ((m = h.match(/^#rule-(\d+(?:-\d+)?)$/)) && keys.has(m[1])) || /^#faq-g\d+$/.test(h) || /^#(war|penalty|report|changelog|notice)-s?\d+$/.test(h) || /^#case-\d+$/.test(h) || /^#cat-[a-z]+$/.test(h);
      if (!ok) err(`wiki.json: '${c.name}'의 '${d.title}' 주소 오류 '${h}'`);
    }
  }
} catch (e) { err("wiki.json: JSON 형식 오류 " + e.message); }

// 관리자 확인 필요 조항 안내
const drafts = [...rules.matchAll(/^### (제\d+조(?:의\d+)?) \((.+?)\).*관리자 확인 필요/gm)].map(m => m[1]);
if (drafts.length) warn(`관리자 확인이 필요한 조항 ${drafts.length}개: ${drafts.join(", ")}`);

console.log(`장 ${chCount} · 조 ${keys.size} · 제재 ${codes.size} · 사례 ${blocks.length} · FAQ ${qs.length}`);
warns.forEach(w => console.log("주의: " + w));
if (errors.length) { errors.forEach(e => console.error("오류: " + e)); process.exit(1); }
console.log("검증 통과");

// Cloudflare Pages 빌드에서는(대시보드 빌드 명령이 이 파일일 때) 이어서 _site 빌드까지 한다.
if (process.env.CF_PAGES && !process.env.WH_BUILDING) {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: new URL("..", import.meta.url), stdio: "inherit", env: { ...process.env, WH_BUILDING: "1" } });
}

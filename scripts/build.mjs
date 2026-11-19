// 배포용 빌드: 규칙 데이터 검증 → 문서별 최종 수정일 기록 → 공개할 파일만 _site 로 복사
// 사용: node scripts/build.mjs   (Cloudflare Pages 빌드 명령, GitHub Actions 공통)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// 1. 검증 (실패하면 여기서 멈춘다)
execFileSync(process.execPath, ["scripts/validate.mjs"], { cwd: root, stdio: "inherit", env: { ...process.env, WH_BUILDING: "1" } });

// 2. 문서별 최종 수정일 (git 기록이 없으면 기존 값 유지)
const metaPath = join(root, "data/meta.json");
let meta = { files: {} };
try { meta = JSON.parse(readFileSync(metaPath, "utf8")); } catch {}
const docs = ["RULES", "WAR_RULES", "PENALTY", "CASES", "FAQ", "CHANGELOG", "NOTICE", "REPORT"].map(k => k + ".md");
let shallow = false;
try { shallow = run("git", ["rev-parse", "--is-shallow-repository"]) === "true"; } catch {}
for (const f of docs) {
  try {
    const d = run("git", ["log", "-1", "--format=%cs", "--", "data/" + f]);
    if (d && !shallow) meta.files[f] = d;
    else if (d && !meta.files[f]) meta.files[f] = d;
  } catch { /* git 없음 */ }
}
meta.builtAt = new Date().toISOString();
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log("수정일:", Object.entries(meta.files).map(([k, v]) => `${k} ${v}`).join(", "));

// 3. 공개 파일만 _site 로
const out = join(root, "_site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const p of ["index.html", "robots.txt", "_headers", ".nojekyll", "css", "js", "data", "img", "fonts", "vendor"]) {
  if (existsSync(join(root, p))) cpSync(join(root, p), join(out, p), { recursive: true });
}
console.log("빌드 완료 → _site");

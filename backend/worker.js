/**
 * 월화 서버 상태 API (Cloudflare Workers, 선택 사항)
 *
 * 홈페이지 → 이 Worker → 공개 상태 조회(mcsrvstat.us) → 마인크래프트 서버
 * - 결과를 60초 캐시해서 조회 서비스와 서버에 부담을 주지 않는다.
 * - 허용한 홈페이지 주소(ALLOWED_ORIGINS)에서만 CORS를 연다.
 * - 같은 IP의 과도한 요청은 429로 막는다 (캐시 적중은 제외).
 * - RCON 비밀번호나 관리자 권한은 쓰지 않는다. 서버 주소만 환경변수로 받는다.
 *
 * 환경변수 (wrangler.toml [vars] 또는 Cloudflare 대시보드)
 *   MC_ADDRESS       예: play.example.com 또는 1.2.3.4:25565
 *   MC_EDITION       java | bedrock (기본 java)
 *   ALLOWED_ORIGINS  예: https://wolhwa.pages.dev,https://user.github.io
 *   CACHE_SECONDS    기본 60
 *   MAINTENANCE      "1"이면 점검 중으로 응답
 *   MAINTENANCE_NOTE 점검 안내 문구
 */
const hits = new Map(); // 인스턴스별 간단한 요청 제한 (정확한 제한은 Cloudflare Rate Limiting 규칙 권장)

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
    if (request.method !== "GET" || url.pathname !== "/status") return json({ error: "not_found" }, 404, cors);
    if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "origin_not_allowed" }, 403, {});

    if (env.MAINTENANCE === "1") return json({ online: false, maintenance: true, note: env.MAINTENANCE_NOTE || "" }, 200, cors, 30);
    if (!env.MC_ADDRESS) return json({ error: "address_not_configured" }, 503, cors, 30);

    const ttl = Math.max(30, +env.CACHE_SECONDS || 60);
    const cache = caches.default;
    const key = new Request("https://cache.wolhwa/status/" + encodeURIComponent(env.MC_ADDRESS));
    const cached = await cache.match(key);
    if (cached) return withCors(cached, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const now = Date.now(), w = hits.get(ip) || [];
    const recent = w.filter(t => now - t < 60000); recent.push(now); hits.set(ip, recent);
    if (recent.length > 20) return json({ error: "rate_limited" }, 429, cors);

    const base = env.MC_EDITION === "bedrock" ? "https://api.mcsrvstat.us/bedrock/3/" : "https://api.mcsrvstat.us/3/";
    let body;
    try {
      const r = await fetch(base + encodeURIComponent(env.MC_ADDRESS), { headers: { "User-Agent": "wolhwa-status/1.0" }, cf: { cacheTtl: ttl } });
      if (!r.ok) throw new Error("upstream " + r.status);
      const d = await r.json();
      body = {
        online: !!d.online,
        players: d.players ? { online: d.players.online || 0, max: d.players.max || 0 } : null,
        version: d.version || "",
        motd: { clean: (d.motd && d.motd.clean) || [] },
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return json({ error: "upstream_unavailable" }, 502, cors, 15);
    }
    const res = json(body, 200, {}, ttl);
    ctx.waitUntil(cache.put(key, res.clone()));
    return withCors(res, cors);
  },
};

function json(obj, status, extra = {}, maxAge = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store", ...extra },
  });
}
function withCors(res, cors) {
  const r = new Response(res.body, res);
  Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

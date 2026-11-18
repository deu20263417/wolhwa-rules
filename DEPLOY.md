# 월화 규칙 홈페이지 배포 안내

이 홈페이지는 빌드가 필요 없는 정적 사이트입니다. 규칙 페이지는 어떤 무료 정적 호스팅에서도 24시간 열립니다. 서버 상태 표시만 외부 조회에 의존하며, 조회가 실패해도 규칙 페이지는 정상 동작합니다.

## 1. 자동 배포 구조

```
data/*.md 수정 → GitHub에 push → Actions가 규칙 데이터 검증 → 통과하면 배포 → 홈페이지 갱신
```

- 검증 스크립트: `node scripts/validate.mjs`
  - 장·조 번호 순서, 없는 조항 참조, 제재 코드 중복, 사례 필수 항목, 공지 날짜 형식을 확인합니다.
  - 오류가 있으면 배포하지 않습니다.
- 배포 전에 내 컴퓨터에서 확인: `python3 -m http.server 8000` 후 `http://localhost:8000`

## 2. 호스팅 선택

| 순위 | 서비스 | 설정 | 비고 |
|---|---|---|---|
| 1 | Cloudflare Pages | GitHub 저장소 연결 → Framework: None → Build command: `node scripts/validate.mjs` → Output directory: `/` | `_headers`의 보안·캐시 헤더가 적용됩니다. 주소: `프로젝트명.pages.dev` |
| 2 | GitHub Pages | 저장소 Settings → Pages → Source: **GitHub Actions** | `.github/workflows/deploy.yml`이 검증 후 배포합니다. 주소: `계정명.github.io/저장소명` |
| 3 | Netlify | 저장소 연결 → Build command: `node scripts/validate.mjs` → Publish directory: `.` | `_headers` 적용 |

세 서비스 모두 무료 플랜에서 HTTPS가 자동 적용됩니다. 과금이 생기는 설정(유료 도메인, 유료 플랜, 사용량 초과 과금)은 켜지 마세요.

### 무료 플랜에서 알아둘 점
- **24시간 접속 가능 ≠ 24시간 무중단 보장**입니다. 무료 플랜에는 가용성 보장(SLA)이 없습니다.
- 정적 사이트는 잠들지 않지만, 월간 빌드 횟수·대역폭 한도가 있습니다. 규칙 사이트 규모에서는 넘기 어렵습니다.
- 서비스 약관이나 무료 범위는 바뀔 수 있으니 1년에 한 번 확인하세요.

## 3. 서버 상태 연동

`data/site.json`의 `status`를 채우면 홈과 푸터에 서버 상태가 표시됩니다.

```json
"status": {
  "address": "play.example.com",
  "edition": "java",
  "endpoint": "",
  "refreshSec": 60,
  "maintenance": false,
  "maintenanceNote": ""
}
```

| 방법 | 설정 | 장점 | 단점 |
|---|---|---|---|
| A. 공개 조회 서비스 (기본) | `address`만 입력 | 서버에 아무것도 설치하지 않음 | 외부 서비스(mcsrvstat.us)에 의존, 수 분 단위 캐시 |
| B. Cloudflare Worker | `backend/`를 배포하고 `endpoint`에 `https://wolhwa-status.계정.workers.dev/status` 입력 | 허용한 사이트에서만 호출, 60초 캐시, 요청 제한 | Cloudflare 계정 필요 |
| C. 서버 플러그인 | Paper/Spigot에서 상태를 JSON으로 내보내는 플러그인 설치 후 `endpoint` 지정 | 가장 정확하고 빠름 | 서버 포트 공개와 보안 설정 필요 |

- 점검할 때는 `maintenance: true`와 `maintenanceNote`만 바꿔 push 하면 됩니다.
- Java판 서버는 `server.properties`의 `enable-status=true`(기본값)여야 조회됩니다.
- **RCON 비밀번호, 관리자 권한, API 키는 이 저장소에 절대 넣지 마세요.** 이 사이트는 어떤 비밀 값도 필요하지 않습니다.

### Worker 배포 (방법 B)
```
cd backend
npx wrangler login
# wrangler.toml 의 MC_ADDRESS, ALLOWED_ORIGINS 입력
npx wrangler deploy
```

## 4. 운영진 편집 기능

`#admin` 편집 화면은 Claude 아티팩트로 게시한 사본에서만 동작합니다(소유자·편집 권한자 확인과 저장소가 그 환경에 있기 때문). GitHub 기반 배포에서는 `data/*.md`를 고쳐 push 하는 것이 편집 방법이며, 저장소 권한이 곧 편집 권한입니다.

## 5. 배포 후 확인할 것

- [ ] `https://` 주소로 열린다
- [ ] 휴대폰 데이터(외부 네트워크)로 열린다
- [ ] `#rule-33`처럼 규칙 주소로 바로 열린다
- [ ] `data/NOTICE.md`를 고쳐 push 하면 몇 분 안에 공지가 바뀐다
- [ ] 서버 상태가 표시된다 (주소를 넣은 경우)

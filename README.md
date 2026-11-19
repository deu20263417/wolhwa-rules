# 월화(月花) 공식 위키

**홈페이지: https://wolhwa.pages.dev/**  (보조 주소: https://deu20263417.github.io/wolhwa-rules/)

다크 판타지 게임 포털과 문서 사이트를 합친 규칙 홈페이지입니다. 빌드 없이 정적 파일만으로 동작합니다.

## 실행

```
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

`index.html`을 파일로 직접 열면 규칙 데이터(fetch)를 읽지 못합니다. 꼭 웹 서버로 여세요.

## 구조

```
index.html        화면 뼈대 (헤더, 검색창, 모바일 탭)
css/style.css     디자인 (라이트·다크 테마 토큰, 3단 레이아웃, 반응형)
js/data.js        규칙 데이터 읽기·해석 (마크다운 → 장/조/제재/사례/FAQ)
js/app.js         라우팅, 화면, 통합 검색, 목차, 테마
js/status.js      서버 상태 표시 (공개 조회 또는 백엔드)
js/admin.js       운영진 편집 (Claude 아티팩트 사본에서만, 권한자 전용)
data/*.md         규칙 원문 6종 + 공지(NOTICE.md) + 신고 안내(REPORT.md)
data/site.json    서버 정보, 서버 상태 설정, 홈 화면 수치, 전쟁 진행 단계
data/wiki.json    위키 카테고리와 문서 목록 (홈·사이드바·메뉴가 이 파일을 읽음)
data/meta.json    문서별 최종 수정일 (빌드 때 git 기록으로 자동 갱신)
fonts/pretendard/ 본문 글꼴 Pretendard (OFL, 사이트에 직접 포함)
vendor/           marked (마크다운 변환, MIT)
img/              키 비주얼(WebP 3종 + JPG), 파비콘
backend/          서버 상태 Worker (선택)
scripts/          validate.mjs(규칙 데이터 검증), build.mjs(검증 + 수정일 + _site 빌드)
.github/workflows GitHub Pages 자동 배포
_headers          Cloudflare Pages 보안 헤더(CSP, HSTS 등)·캐시
DEPLOY.md         배포와 서버 연동 안내
```

규칙 내용은 `data/` 폴더만 고치면 됩니다. 디자인 코드는 건드릴 필요가 없습니다.

## 규칙 문서 작성 형식

화면이 아래 형식을 읽어서 구조를 만듭니다. 형식이 바뀌면 해당 항목이 표시되지 않습니다.

| 파일 | 형식 |
|---|---|
| RULES.md | `## 제N장 제목`, `### 제N조 (제목)` |
| PENALTY.md | 표 한 줄: `\| 코드 \| 위반 \| 조항 \| 기본 \| 부가 조치 \|` |
| CASES.md | `### 사례 N. 제목` + `- **상황**: ...` 등 |
| FAQ.md | `## 분류` + `**Q. 질문**` 다음 줄에 답 |
| NOTICE.md | `## YYYY-MM-DD · 제목` (최신이 위) |

본문에 "제N조"라고 쓰면 자동으로 해당 조항 링크가 됩니다. 제재표와 판정집의 조항 칸에 적힌 조 번호를 보고 각 조항 아래에 "제재 기준"과 "관련 사례"가 붙습니다.

## 주소 (고유 URL)

| 주소 | 내용 |
|---|---|
| `#rules`, `#ch-4` | 전체 규칙, 제4장 |
| `#rule-33` | 제33조 |
| `#penalty`, `#pen-w-7` | 제재 기준, 코드 W-7 |
| `#cases`, `#case-12` | 판정집, 사례 12 |
| `#faq`, `#faq-3` | FAQ |
| `#rule-21-2` | 제21조의2 |
| `#war`, `#changelog`, `#notice`, `#report` | 전쟁 세부, 변경 이력, 공지, 신고·문의 |
| `#admin` | 운영진 편집 (권한자만) |

## 운영진 편집

Claude 아티팩트로 게시된 페이지에서는 소유자와 편집 권한자(Editor)에게만 상단 "관리" 메뉴가 보입니다. 저장한 수정본은 모든 방문자에게 바로 적용되고, 원본 `data/*.md`는 그대로 남아 "원본으로 되돌리기"로 복구할 수 있습니다. 저장소 규칙도 편집 권한자만 쓰기로 묶여 있어 화면을 우회해도 일반 방문자는 수정할 수 없습니다.

다른 웹 호스팅에 올리면 이 편집 기능은 꺼지고(권한 확인 수단이 없으므로) 원본 파일만 표시됩니다.

## 단축키

- `/` 또는 `Ctrl/⌘ + K`: 통합 검색
- 검색창에서 `↑` `↓` 이동, `Enter` 열기, `Esc` 닫기

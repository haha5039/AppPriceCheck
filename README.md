# AppPriceCheck

> 전 세계 108개 이상 국가의 App Store 및 Google Play 앱/인앱결제 가격을 실시간으로 비교하는 플랫폼

**라이브 데모**: [https://haha5039.github.io/AppPriceCheck/](https://haha5039.github.io/AppPriceCheck/)

---

## 주요 기능

- **108+ 국가 실시간 조회**: 미주, 유럽, 아시아·태평양, 중동, 아프리카 전 세계 스토어프런트 가격 수집
- **듀얼 스토어 지원**: Apple App Store과 Google Play Store 모두 지원
- **앱 이름 검색**: 이름으로 App Store 검색 (⌘K 또는 검색 모달)
- **실시간 USD 환산**: ExchangeRate-API / Frankfurter(ECB) 환율 연동
- **인앱결제(IAP) 비교**: 구독, 게임 아이템 등 국가별 IAP 가격 비교
- **앱 가격 비교**: 두 앱의 국가별 가격을 나란히 비교
- **가격 분포 차트**: Canvas 기반 시각화 + 마우스 오버 툴팁
- **CSV 내보내기**: 전체 가격 데이터를 CSV 파일로 다운로드
- **테이블 복사**: 정렬된 가격 데이터를 클립보드에 텍스트로 복사
- **공유 기능**: URL 기반 결과 공유 (Web Share API / 클립보드)
- **최근 검색 기록**: localStorage에 최근 검색 저장
- **다크/라이트 테마**: 사용자 테마 설정 저장
- **키보드 단축키**: `⌘K` 검색, `⌘⇧K` 이름 검색, `ESC` 닫기
- **반응형 디자인**: 모바일/데스크톱 최적화

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vanilla HTML5, CSS3 (Glassmorphism, 다크/라이트 테마), JavaScript ES6+ |
| Backend | Node.js, Express, Axios |
| 데이터 API | Apple iTunes Lookup API, iTunes Search API, Google Play Web Scraping |
| 스트리밍 | Server-Sent Events (SSE), 비동기 병렬 워커 풀 |
| 배포 | GitHub Pages + GitHub Actions |

## 빠른 시작

```bash
git clone https://github.com/haha5039/AppPriceCheck.git
cd AppPriceCheck
npm install
node server.js
# http://localhost:3000 접속
```

## 프로젝트 구조

```
├── index.html          # 메인 페이지 (SEO, 구조화 데이터 포함)
├── app.js              # 프론트엔드 로직 (SSE, 테이블, 차트, 비교)
├── style.css           # 스타일 (다크/라이트 테마, 반응형)
├── server.js           # Express 서버 (SSE 프록시, 검색 API, 캐시)
├── favicon.svg         # SVG 파비콘
├── public/             # GitHub Pages 정적 파일
└── package.json
```

## API 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/rates` | USD 기준 환율 조회 |
| `GET /api/countries` | 지원 국가 목록 |
| `GET /api/search?q=...` | 앱 이름 검색 (iTunes Search API) |
| `GET /api/prices-stream/:appId` | SSE: 국가별 앱 가격 스트리밍 |
| `GET /api/iap-stream/:appId` | SSE: 인앱결제 가격 스트리밍 |
| `GET /api/google-prices-stream/:packageId` | SSE: Google Play 가격 스트리밍 |

## 라이선스

MIT License

## 면책 조항

본 서비스는 독립적인 가격 비교 도구이며, Apple Inc. 또는 Google LLC와 공식적인 연관이 없습니다. 국가별 부가가치세(VAT) 포함 여부 및 계정 지역 제한에 따라 실제 결제 금액은 다를 수 있습니다.

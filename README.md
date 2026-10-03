# AppPriceCheck

> 전 세계 108개 이상 국가의 App Store 및 Google Play 앱/인앱결제 가격을 실시간으로 비교하는 플랫폼

**라이브 데모**: [https://haha5039.github.io/AppPriceCheck/](https://haha5039.github.io/AppPriceCheck/)

---

## 주요 기능

- **108+ 국가 실시간 조회**: 미주, 유럽, 아시아·태평양, 중동, 아프리카 전 세계 스토어프런트 가격 수집
- **듀얼 스토어 지원**: Apple App Store과 Google Play Store 모두 지원
- **스토어 자동 감지**: URL 또는 앱/패키지 ID만 붙여넣으면 스토어를 자동으로 구분 (선택 버튼 불필요)
- **앱 이름 검색**: 이름으로 App Store 검색 (⌘K 또는 검색 모달)
- **실시간 USD 환산**: ExchangeRate-API / Frankfurter(ECB) 환율 연동
- **인앱결제(IAP) 비교**: 구독, 게임 아이템 등 국가별 IAP 가격 비교
- **앱 가격 비교**: 두 앱의 국가별 가격을 나란히 비교
- **가격 분포 차트**: Canvas 기반 시각화 + 마우스 오버 툴팁
- **CSV 내보내기**: 전체 가격 데이터를 CSV 파일로 다운로드
- **테이블 복사**: 정렬된 가격 데이터를 클립보드에 텍스트로 복사
- **공유 기능**: URL 기반 결과 공유 (Web Share API / 클립보드)
- **최근 검색 기록**: localStorage에 최근 검색 저장
- **조회 이력 패널**: 이전 조회 대비 최저가 변동(▼/▲/동일)과 최저가 국가, 평균가를 보여주는 최근 조회 이력
- **최저가 추이 그래프**: 같은 앱을 여러 번 조회하면 각 줄에 최저가 변동 스파크라인 표시
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

## 테스트

```bash
npm test
```

`node:test` 기반 테스트가 서버/클라이언트 파서 일관성(현지 가격, Google Play IAP 최저/최고 분리, App Store IAP 쌍 추출), 브라우저용 Google Play 페이지 파서(관련 앱 offerId 제외, 가용성 추정, 스토어프런트 부재 감지), 그리고 조회 이력의 정렬·변동 계산을 검증합니다. GitHub Actions 배포 파이프라인에서 `npm test`를 먼저 통과해야 배포됩니다.

## 프로젝트 구조

```
├── index.html          # 메인 페이지 (SEO, 구조화 데이터 포함)
├── app.js              # 프론트엔드 로직 (SSE, 테이블, 차트, 비교)
├── style.css           # 스타일 (다크/라이트 테마, 반응형)
├── server.js           # Express 서버 (SSE 프록시, 검색 API, 캐시)
├── test/                  # 파서 단위 테스트 (node:test)
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

본 서비스는 독립적인 가격 비교 도구이며, Apple Inc. 또는 Google LLC와 공식적인 연관이 없습니다. 국가별 부가가치세(VAT) 포함 여부 및 계정 지역 제한에 따라 실제 결제 금액은 다를 수 있습니다. Google Play 가용성은 공개 스토어프런트 페이지 기반 추정치로, 스토어프런트가 없는 국가는 제외 처리되며 지역 제한 앱은 실제 기기에서 확인이 필요합니다.


## 오류 처리와 조회 이력

- 검색을 바꾸면 이전 가격·IAP·비교 요청을 취소합니다. 스트림 완료 후 재연결하지 않으며, 재연결된 국가는 기존 행을 갱신합니다.
- 결과 상단에서 실제 조회 국가 수, 성공·미판매/미지원·실패 수를 확인하고 실패 국가만 재조회할 수 있습니다. IAP 조회 실패도 별도로 표시하고 재시도할 수 있습니다.
- 환율이 없는 금액은 `환산 불가`로 표시하고 통계에서 제외합니다. 확인된 가격이 0인 경우만 무료로 처리합니다.
- 신규 이력(`schemaVersion: 2`)은 표시 통화와 PPP 적용 여부, 비교 가능한 국가 범위(`coverage`)를 함께 저장합니다. 국가 조회가 실패하거나 환산가를 확인하지 못한 조회는 이력에 기록하지 않습니다. 같은 앱·스토어·통화·PPP 방식·국가 범위끼리 비교하며, 단위 또는 국가 범위가 없는 기존 이력은 보존하되 추이 계산에서 제외합니다.
- GitHub Pages의 이름 검색은 iTunes JSONP를 사용합니다. 가격 조회 범위는 App Store 108개국, Google Play 주요 국가이며 IAP 공개 페이지는 일부 국가를 조회합니다. 외부 공개 페이지·프록시 응답에 따라 결과가 제한될 수 있습니다.

### API 추가 옵션

가격 및 IAP 스트림의 `countries=us,kr` 옵션으로 지원 국가 일부만 조회할 수 있습니다. `refresh=1`은 해당 요청의 캐시를 우회합니다. 잘못된 검색어 타입, 앱 ID, 국가 코드에는 HTTP 400을 반환합니다.

IAP의 국가별 `data` 이벤트는 기존 `country`, `iaps`와 함께 `fetchStatus`(`ok`, `empty`, `unavailable`, `request-failed`)를 제공합니다. 완료 이벤트의 `completed`는 처리 국가 수이며 `failed`는 실패 국가 수입니다.

### 검증과 정적 자산

`npm test`는 파서, 가격·이력 계산, 검색 완료·취소·재연결·교차 실행, 정적 조회, 실제 HTTP 라우트의 입력 검증·실패 캐시·연결 취소를 외부 응답 모의 테스트로 검증합니다. 테스트는 강제 종료 옵션 없이 종료됩니다.

`npm run check:assets`는 루트와 `public/`의 대응 자산 일치 여부를 검사하며 `npm test` 및 CI에 포함됩니다. 프런트엔드와 서버 자산을 수정한 경우 대응 파일도 동기화해야 합니다. 로컬 개발은 `npm run dev`로 Node의 파일 변경 감지를 사용할 수 있습니다.

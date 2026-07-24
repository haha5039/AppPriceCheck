# 📱 AppPriceCheck (앱스토어 국가별 가격 비교)

> ** 전 세계 108개국 App Store 앱 및 인앱결제(IAP) 가격 실시간 비교 플랫폼**  
> **라이브 데모**: [https://haha5039.github.io/AppPriceCheck/](https://haha5039.github.io/AppPriceCheck/)

---

## 🌟 주요 기능

- **🌍 108+ 국가 실시간 조회**: 미주, 유럽, 아시아·태평양, 중동, 아프리카 전 세계 App Store 스토어프런트 가격 수집
- **💱 실시간 USD 환산**: European Central Bank 및 [ExchangeRate-API](https://open.er-api.com/) 연동으로 최신 환율 기준 USD 비교
- **🛒 무료 앱 & 인앱결제(IAP) 조회**: 구독(ChatGPT Plus 등), 게임 아이템(마인크래프트 코인 등) 국가별 가격 비교 지원
- **🔍 최저가 / 최고가 / 평균 요약**: 가장 저렴한 국가와 비싼 국가, 미국 대비 할인율(% vs US) 한눈에 제공
- **⚡ 듀얼 모드 (Dual-Mode)**:
  - **Local Server**: Express + SSE(Server-Sent Events) 스트리밍 프록시
  - **GitHub Pages**: 서버 없는 Pure Client-Side JSONP 수집 엔진

---

## 📸 주요 스크린샷 및 화면

| 마인크래프트 (유료 앱) 국가별 가격 비교 | ChatGPT (무료 앱 + IAP) 구독 비교 |
|-----------------------------------|-----------------------------------|
| 🇮🇳 인도: **$0.30** (최저가, -95.7% vs US)<br>🇵🇱 폴란드: **$10.53** (최고가) | 🇵🇰 파키스탄: **$17.64 USD**<br>🇺🇸 미국: **$19.99 USD**<br>🇭🇺 헝가리: **$28.10 USD** |

---

## 🚀 빠른 시작 (Local Server)

### 1. 저장소 클론
```bash
git clone https://github.com/haha5039/AppPriceCheck.git
cd AppPriceCheck
```

### 2. 패키지 설치 및 실행
```bash
npm install
node server.js
```

### 3. 브라우저 접속
```
http://localhost:3000
```

---

## 🛠️ 기술 스택 및 아키텍처

| 영역 | 사용 기술 |
|------|-----------|
| **Frontend** | Vanilla HTML5, Modern CSS (Glassmorphism, Dark Theme), JavaScript (ES6+) |
| **Backend** | Node.js, Express, Axios |
| **Data APIs** | Apple iTunes Lookup API (JSONP & REST), Open Exchange Rates API |
| **Streaming** | Server-Sent Events (SSE) / Async Parallel Worker Pool (15 Parallel Concurrency) |
| **Deployment** | GitHub Pages + GitHub Actions (`.github/workflows/static.yml`) |

---

## 📄 라이선스 & 디스클레이머 (Disclaimer)

- **License**: MIT License
- **Disclaimer**: 본 서비스는 독립적인 가격 비교 도구이며, **Apple Inc.** 또는 공식 **App Store**와 공식적인 연관이 없습니다. 국가별 부가가치세(VAT) 포함 여부 및 계정 지역 제한에 따라 실제 결제 금액은 다를 수 있습니다.

# 🌐 방장 용용이 - 구글 애드센스(Google AdSense) & 글로벌 SEO/다국어(i18n) 통합 명세서

본 문서는 **방장 용용이 (Bangjang Tools - bangjang.net)** 프로젝트에 적용된 구글 애드센스 광고 수익화 시스템, 글로벌 검색엔진 최적화(SEO) 마크업, 실시간 다국어 지원(i18n) 아키텍처 및 운영 가이드를 상세히 설명합니다.

---

## 1. 💰 구글 애드센스 (Google AdSense) 시스템

### 1.1 광고 슬롯 구성 및 배치 원칙
- **대시보드 메인 배너 (`index.html`)**: 상단 히어로 섹션 아래 반응형 리더보드/빅배너 배치.
- **도구별 우측 사이드바 (`tool-*.html`)**: 사용자의 작업 흐름을 방해하지 않으면서 최적의 시선 흐름을 유도하는 300x250 직사각형 반응형 광고 슬롯 탑재.
- **CLS (누적 레이아웃 이동) 방지**: 고정 최소 높이(`min-height: 250px`)와 부드러운 스켈레톤 스타일을 적용하여 광고 로드 전후 레이아웃이 흔들리는 현상을 차단했습니다.
- **스폰서 라벨 명시**: 구글 애드센스 운영 정책을 준수하기 위해 모든 광고 영역 상단에 `스폰서 광고 (Sponsor)` 라벨을 표기했습니다.

### 1.2 실제 광고 단위(Ad Unit) 교체 가이드
구글 애드센스 승인 완료 후 발급받은 실제 광고 코드로 교체하는 방법:

1. **전체 HTML 상단 Head 스크립트 수정**:
   ```html
   <!-- 변경 전 (샘플 퍼블리셔 ID) -->
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000" crossorigin="anonymous"></script>

   <!-- 변경 후 (실제 본인의 애드센스 게시자 ID 입력) -->
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456" crossorigin="anonymous"></script>
   ```

2. **광고 슬롯 태그 교체 (`.adsense-placeholder` 내부)**:
   ```html
   <div class="adsense-slot-container adsense-sidebar-slot">
       <span class="adsense-label" data-i18n="label.sponsor">스폰서 광고</span>
       <!-- 아래에 발급받은 ins 광고 코드 삽입 -->
       <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="ca-pub-1234567890123456"
            data-ad-slot="9876543210"
            data-ad-format="auto"
            data-full-width-responsive="true"></ins>
       <script>
            (adsbygoogle = window.adsbygoogle || []).push({});
       </script>
   </div>
   ```

### 1.3 애드센스 승인 필수 요소 (정책 준수)
- **개인정보처리방침 (Privacy Policy)**: 쿠키 사용, 서드파티 광고 네트워크(Google)의 맞춤 광고 정책 설명 및 모달 팝업 구축 완료.
- **이용약관 (Terms of Service)**: 서비스의 목적, 무료 유틸리티 정책, 면책 규정 명시.
- **전체 페이지 하단 글로벌 푸터**: 전 페이지에 저작권 및 약관 바로가기 링크 완비.

---

## 2. 🌍 글로벌 SEO (검색엔진 최적화) 아키텍처

### 2.1 글로벌 메타 태그 표준
전체 12개 페이지에 아래와 같은 완벽한 메타 데이터가 구조화되어 있습니다.
- `title` 및 `meta[name="description"]`: 검색엔진 결과에 노출되는 매력적인 스니펫.
- `meta[name="keywords"]`: 한국어 및 글로벌 검색 키워드 타겟팅.
- `link[rel="canonical"]`: 중복 콘텐츠 색인 방지 표준 URL 지정.
- `link[rel="alternate"][hreflang="ko"]`, `[hreflang="en"]`, `[hreflang="x-default"]`: 다국어 사용자 및 검색 로봇 맞춤 색인.
- `og:*` (Open Graph) 및 `twitter:*`: 페이스북, 카카오톡, 트위터 링크 공유 시 고품질 카드 썸네일 노출.

### 2.2 Schema.org JSON-LD 구조화 데이터 (`WebApplication`)
구글 검색엔진이 페이지를 단순 웹문서가 아닌 **'무료 웹 애플리케이션'**으로 인식하도록 구조화 데이터를 제공합니다.
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "QR 코드 생성기 (QR Code Generator)",
  "url": "https://bangjang.net/qr-code.html",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "All",
  "description": "Generate custom QR codes with logo insertion and color styling directly in browser.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

### 2.3 검색 로봇 및 사이트맵
- [`robots.txt`](file:///c:/Users/user/Desktop/vibe/tools/robots.txt): 모든 크롤러 접근 허용 (`User-agent: * Allow: /`) 및 Sitemap 명시.
- [`sitemap.xml`](file:///c:/Users/user/Desktop/vibe/tools/sitemap.xml): 12개 전체 도구 페이지의 우선순위(`priority`), 변경주기(`changefreq`), xhtml 다국어 링크 매핑 완비.

---

## 3. 🌐 다국어 번역 엔진 (`assets/js/i18n.js`)

### 3.1 작동 원리
1. **언어 자동 감지**: 첫 방문 시 사용자의 브라우저 언어(`navigator.language`)를 감지하여 한국어(`ko`)가 아닐 경우 영문(`en`)으로 자동 전환.
2. **상단 GNB 원클릭 전환**: [KO / EN] 토글 버튼을 클릭하면 즉시 모든 DOM 요소의 텍스트가 번역 딕셔너리에 따라 치환됨.
3. **영속성 유지**: 사용자가 선택한 언어는 `localStorage.getItem('preferred_lang')`에 안전하게 저장되어 다음 방문 시에도 유지.

### 3.2 신규 번역 텍스트 추가 방법
`assets/js/i18n.js`의 `translations` 객체에 키-값을 추가하고 HTML 태그에 `data-i18n="키이름"`을 지정합니다:
```javascript
// assets/js/i18n.js
const translations = {
    ko: {
        'my_new_feature': '새로운 기능 이름'
    },
    en: {
        'my_new_feature': 'New Feature Name'
    }
};
```
```html
<!-- HTML 태그 -->
<button data-i18n="my_new_feature">새로운 기능 이름</button>
```

---

## 4. 🚀 검색엔진 등록 및 운영 팁

1. **Google Search Console 등록**:
   - [Google Search Console](https://search.google.com/search-console)에 접속하여 `https://bangjang.net` 속성을 추가합니다.
   - Sitemaps 메뉴에 `https://bangjang.net/sitemap.xml`을 제출합니다.
2. **Naver Search Advisor 등록**:
   - [네이버 서치어드바이저](https://searchadvisor.naver.com/)에 사이트를 등록하고 사이트맵을 제출합니다.
3. **Bing Webmaster Tools 등록**:
   - 글로벌 트래픽 유입을 위해 Bing 웹마스터 도구에 사이트맵을 등록합니다.

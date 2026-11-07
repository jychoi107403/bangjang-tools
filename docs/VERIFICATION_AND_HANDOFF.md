# tools.bangjang.net 검증 및 수정 현황 (인수인계 문서)

**최종 업데이트 일시:** 2026-11-07  
**프로젝트 경로:** `C:\Users\user\Desktop\vibe\tools`  
**배포 도메인:** `https://tools.bangjang.net`

---

## 1. 완료 및 실서버 반영 내역 (전체 13종 도구 100% 정식 오픈 완료)

1. **`assets/js/i18n.js` 문법 오류 수정 및 전체 도구 다국어 키 보강**
   - `en` 사전 `619번 줄` 뒤의 누락된 쉼표(`,`)를 추가하여 전 페이지 `SyntaxError`를 해결했습니다.
   - `batch.*`, `vtrim.*`, `v2gif.*`, `pdf2word.*` 한국어(`ko`) 및 영어(`en`) 번역 키를 모두 완비했습니다.
2. **`assets/js/tool-image-compress.js` 다국어 안전 호출 방어 로직 적용**
   - `window.i18n.t(...)` 호출부를 안전 헬퍼 함수 `t(key, fallback)`로 감싸서 이미지 용량 줄이기 도구가 안정적으로 작동하도록 보강했습니다.
3. **`assets/js/tool-site-audit.js` 만료 프록시 정리**
   - 만료된 `thingproxy.freeboard.io` 도메인을 프록시 배열에서 제거했습니다.
4. **Google AdSense 실제 게시자 ID (`ca-pub-1774804957511077`) 및 `ads.txt` 반영**
   - 전체 14개 HTML 파일에 실제 게시자 ID 및 `<meta name="google-adsense-account">` 태그를 적용하고 루트 `ads.txt`를 생성했습니다.
5. **신규 실무 도구 3종 100% 브라우저 로컬 구현 및 정식 오픈 (`NEW` 배지 전환)**
   - **[영상 구간 → GIF (`video-trim-gif.html` / `assets/js/tool-video-trim-gif.js`)]:** 타임라인 시작/종료 슬라이더, 현재 위치 지정, 구간 반복 재생, FPS·해상도·배속 설정 및 `gifshot` 인코딩 구현.
   - **[영상 → GIF (`video-to-gif.html` / `assets/js/tool-video-to-gif.js`)]:** 3종 용량·화질 프리셋(표준 균형 / 고화질 우선 / 최소 용량 압축), 역재생 옵션, 원본 vs GIF 나란히 비교 뷰어 및 자동 변환 구현.
   - **[PDF → Word (`pdf-to-word.html` / `assets/js/tool-pdf-to-word.js`)]:** `PDF.js` 좌표·폰트 크기 기반 문단/제목 추출 + 실시간 편집 에디터 + `JSZip` 표준 OpenXML(`.docx`) 직접 패키징 엔진 구현.

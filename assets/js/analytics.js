/**
 * ============================================================================
 * assets/js/analytics.js - 방장 용용이 통합 Google Analytics 4 (GA4) 추적 모듈
 * ============================================================================
 * [측정 ID]: G-8XG8LX6GDN (방장 용용이 웹도구 / https://tools.bangjang.net)
 *
 * [설계 및 보안 원칙]
 * 1. 개인정보 보호 최우선: 사용자가 업로드한 파일명, 이미지 데이터, 변환 텍스트,
 *    입력한 URL 원문 등 민감한 정보는 절대 GA4로 전송하지 않습니다.
 * 2. 오직 익명화된 통계 지표(도구 ID, 파일 확장자, 용량 구간, 소요 시간, 버튼 유형 등)만 수집합니다.
 * 3. 기존 도구 코드에 영향을 주지 않도록 모든 추적 로직은 try-catch로 안전하게 격리됩니다.
 *
 * [자동 수집 이벤트 목록]
 * - tool_view            : 도구 진입 (도구 ID, 카테고리, 언어, 기기 유형, 유입 도메인)
 * - tool_file_upload     : 파일 선택 / 드래그앤드롭 / 클립보드 붙여넣기 (개수, 확장자, 용량 구간)
 * - tool_action_start    : 핵심 변환/압축/생성/진단 버튼 실행 시작
 * - tool_action_complete : 작업 완료 (명시적 호출 시 소요 시간 및 결과 지표 포함)
 * - tool_download        : 파일 다운로드 / ZIP 저장 / 클립보드 복사
 * - tool_error           : 도구 처리 중 오류 또는 런타임 예외 발생
 * - nav_click            : GNB / 사이드바 / 홈 카드 내 도구 이동 클릭
 * - language_change      : 언어 전환 (ko <-> en)
 * - modal_open           : 도움말 / 개인정보처리방침 / 이용약관 모달 열람
 * - outbound_click       : 외부 사이트 링크 클릭
 * - scroll_depth         : 페이지 스크롤 깊이 (25%, 50%, 75%, 90%)
 * - engaged_time         : 활성 탭 기준 유효 체류 시간 (15초, 30초, 60초, 180초)
 * - web_vitals_basic     : 페이지 로딩 시간(load_ms) 및 첫 콘텐츠 렌더링(fcp_ms)
 */

(function () {
    'use strict';

    const GA_MEASUREMENT_ID = 'G-8XG8LX6GDN';

    /**
     * 페이지 파일명 기반 도구 메타데이터 사전
     * - 현재 URL에서 어떤 도구를 사용 중인지 자동으로 분류합니다.
     */
    const TOOL_META_MAP = {
        'index.html':             { id: 'home',              category: 'portal', name: '메인 홈' },
        '':                       { id: 'home',              category: 'portal', name: '메인 홈' },
        'image-compress.html':    { id: 'image_compress',    category: 'image',  name: '이미지 용량 줄이기' },
        'image-edit.html':        { id: 'image_edit',        category: 'image',  name: '이미지 편집' },
        'image-split.html':       { id: 'image_split',       category: 'image',  name: '사진 분할' },
        'remove-bg.html':         { id: 'remove_bg',         category: 'image',  name: '배경 제거·바꾸기' },
        'mosaic.html':            { id: 'mosaic',            category: 'image',  name: '사진 모자이크' },
        'qr-code.html':           { id: 'qr_code',           category: 'image',  name: 'QR 코드 생성' },
        'batch-rename.html':      { id: 'batch_rename',      category: 'image',  name: '파일명 일괄 변경' },
        'video-trim-gif.html':    { id: 'video_trim_gif',    category: 'video',  name: '영상 구간 → GIF' },
        'video-to-gif.html':      { id: 'video_to_gif',      category: 'video',  name: '영상 → GIF' },
        'screen-record-gif.html': { id: 'screen_record_gif', category: 'video',  name: '화면녹화 → GIF' },
        'blog-formatter.html':    { id: 'blog_formatter',    category: 'blog',   name: '블로그 본문 정리' },
        'pdf-to-word.html':       { id: 'pdf_to_word',       category: 'blog',   name: 'PDF → Word' },
        'site-audit.html':        { id: 'site_audit',        category: 'site',   name: '웹사이트 이미지 진단' }
    };

    /**
     * 현재 페이지의 도구 정보를 반환합니다.
     */
    function getCurrentToolMeta() {
        const path = window.location.pathname || '/';
        const fileName = path.split('/').pop() || 'index.html';
        return TOOL_META_MAP[fileName] || { id: fileName.replace('.html', '') || 'unknown', category: 'other', name: fileName };
    }

    /**
     * 바이트 용량을 익명화된 구간 문자열로 변환합니다. (개인정보/파일 식별 방지)
     */
    function getSizeBucket(bytes) {
        if (!bytes || isNaN(bytes) || bytes <= 0) return '0';
        const kb = bytes / 1024;
        const mb = kb / 1024;
        if (kb < 100) return '<100KB';
        if (mb < 1) return '100KB-1MB';
        if (mb < 5) return '1MB-5MB';
        if (mb < 20) return '5MB-20MB';
        if (mb < 100) return '20MB-100MB';
        return '100MB+';
    }

    /**
     * 파일 목록에서 파일명은 제외하고 확장자(또는 MIME 서브타입)만 안전하게 추출합니다.
     */
    function extractSafeFileTypes(fileList) {
        const types = new Set();
        for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i];
            if (!f) continue;
            if (f.type && f.type.includes('/')) {
                types.add(f.type.split('/')[1].toLowerCase().slice(0, 16));
            } else if (f.name && f.name.includes('.')) {
                types.add(f.name.split('.').pop().toLowerCase().slice(0, 10));
            } else {
                types.add('unknown');
            }
        }
        return Array.from(types).slice(0, 5).join(',') || 'unknown';
    }

    /**
     * 현재 기기 유형 판별 (mobile / tablet / desktop)
     */
    function getDeviceType() {
        const w = window.innerWidth || 1200;
        if (w <= 768) return 'mobile';
        if (w <= 1024) return 'tablet';
        return 'desktop';
    }

    /**
     * 유입 경로 도메인만 안전하게 추출 (쿼리스트링/개인경로 제외)
     */
    function getReferrerDomain() {
        try {
            if (!document.referrer) return 'direct';
            const url = new URL(document.referrer);
            if (url.hostname === window.location.hostname) return 'internal';
            return url.hostname;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * GA4 gtag 이벤트 안전 전송 함수
     */
    function sendEvent(eventName, params = {}) {
        try {
            if (typeof window.gtag !== 'function') return;
            const tool = getCurrentToolMeta();
            const lang = document.documentElement.lang || localStorage.getItem('app_lang') || 'ko';

            const payload = Object.assign({
                tool_id: tool.id,
                tool_category: tool.category,
                page_lang: lang,
                device_type: getDeviceType()
            }, params);

            window.gtag('event', eventName, payload);
        } catch (e) {
            // 통계 전송 오류가 사용자 기능에 영향을 주지 않도록 무시
        }
    }

    /**
     * 1. 도구 진입 이벤트 (tool_view)
     */
    function trackToolView() {
        const tool = getCurrentToolMeta();
        sendEvent('tool_view', {
            tool_name: tool.name,
            referrer_domain: getReferrerDomain(),
            screen_width: window.innerWidth || 0
        });
    }

    /**
     * 2. 파일 업로드 자동 추적 (파일 선택 / 드래그앤드롭 / 클립보드 붙여넣기)
     */
    function initFileUploadTracking() {
        function reportFiles(files, method) {
            if (!files || files.length === 0) return;
            let totalBytes = 0;
            for (let i = 0; i < files.length; i++) {
                totalBytes += (files[i] && files[i].size) ? files[i].size : 0;
            }
            sendEvent('tool_file_upload', {
                upload_method: method,
                file_count: files.length,
                file_types: extractSafeFileTypes(files),
                size_bucket: getSizeBucket(totalBytes)
            });
        }

        // 파일 선택 (<input type="file">)
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length > 0) {
                reportFiles(target.files, 'file_picker');
            }
        }, true);

        // 드래그앤드롭
        document.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                reportFiles(e.dataTransfer.files, 'drag_drop');
            }
        }, true);

        // 클립보드 이미지/파일 붙여넣기
        document.addEventListener('paste', (e) => {
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
                reportFiles(e.clipboardData.files, 'clipboard_paste');
            }
        }, true);
    }

    /**
     * 3. 네비게이션, 언어전환, 모달, 실행/다운로드 버튼, 외부 링크 자동 추적
     */
    function initClickTracking() {
        // 중복 클릭 폭주 방지용 타임스탬프
        let lastActionKey = '';
        let lastActionTime = 0;

        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;

            // (A) 언어 전환 버튼 (KO / EN)
            const langBtn = target.closest('.lang-btn');
            if (langBtn) {
                const newLang = langBtn.getAttribute('data-lang') || 'unknown';
                sendEvent('language_change', { target_lang: newLang });
                return;
            }

            // (B) 도움말 / 개인정보처리방침 / 이용약관 모달 열기
            if (target.closest('.btn-help-trigger')) {
                sendEvent('modal_open', { modal_type: 'help' });
                return;
            }
            if (target.closest('.btn-privacy-trigger')) {
                sendEvent('modal_open', { modal_type: 'privacy' });
                return;
            }
            if (target.closest('.btn-terms-trigger')) {
                sendEvent('modal_open', { modal_type: 'terms' });
                return;
            }

            // (C) 내부 도구 이동 네비게이션 (GNB / 사이드바 / 홈 대시보드 카드)
            const navLink = target.closest('a.gnb-sublink, a.nav-item, a.tool-card, a.dashboard-tool-card, a.quick-tool-card');
            if (navLink) {
                const href = navLink.getAttribute('href') || '';
                const targetTool = TOOL_META_MAP[href.split('/').pop()] || { id: href };
                let locationArea = 'other';
                if (navLink.closest('.gnb-bar, header')) locationArea = 'gnb';
                else if (navLink.closest('.sidebar')) locationArea = 'sidebar';
                else locationArea = 'home_card';

                sendEvent('nav_click', {
                    nav_location: locationArea,
                    target_tool_id: targetTool.id
                });
                return;
            }

            // (D) 외부 링크 클릭 추적
            const anyLink = target.closest('a[href]');
            if (anyLink) {
                const href = anyLink.getAttribute('href') || '';
                if (href.startsWith('http://') || href.startsWith('https://')) {
                    try {
                        const url = new URL(href);
                        if (url.hostname !== window.location.hostname) {
                            sendEvent('outbound_click', { outbound_domain: url.hostname });
                        }
                    } catch (err) { /* 무시 */ }
                }
                // <a download> 직접 클릭
                if (anyLink.hasAttribute('download')) {
                    const dlName = anyLink.getAttribute('download') || '';
                    const ext = dlName.includes('.') ? dlName.split('.').pop().toLowerCase() : 'file';
                    sendEvent('tool_download', { download_method: 'anchor', output_format: ext });
                }
            }

            // (E) 주요 실행/다운로드/복사 버튼 클릭 자동 감지
            const btn = target.closest('button, [role="button"]');
            if (!btn || btn.disabled) return;

            const btnId = (btn.id || '').toLowerCase();
            const btnClass = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();
            const trackAttr = btn.getAttribute('data-track-action');
            const now = Date.now();

            // 500ms 내 동일 버튼 중복 방지
            const key = btnId || trackAttr || btnClass.slice(0, 40);
            if (key && key === lastActionKey && (now - lastActionTime) < 500) return;

            // 다운로드/저장/복사 버튼 감지
            if (/download|save-all|export|zip/.test(btnId) || /download/.test(btnClass)) {
                lastActionKey = key; lastActionTime = now;
                const method = /zip|all/.test(btnId) ? 'zip_batch' : 'button_download';
                sendEvent('tool_download', {
                    download_method: method,
                    button_id: btnId || 'download_btn'
                });
                return;
            }

            if (/copy/.test(btnId)) {
                lastActionKey = key; lastActionTime = now;
                sendEvent('tool_download', {
                    download_method: 'clipboard_copy',
                    button_id: btnId
                });
                return;
            }

            // 핵심 도구 실행 버튼 감지 (변환, 압축, 생성, 적용, 녹화, 진단 등)
            if (trackAttr || /compress|convert|generate|apply|start|record|split|remove|rename|audit|analyze|encode|format|mosaic|blur/.test(btnId)) {
                lastActionKey = key; lastActionTime = now;
                sendEvent('tool_action_start', {
                    action_name: trackAttr || btnId
                });
            }
        }, true);
    }

    /**
     * 4. 스크롤 깊이 추적 (25%, 50%, 75%, 90%)
     */
    function initScrollTracking() {
        const thresholds = [25, 50, 75, 90];
        const fired = new Set();
        let ticking = false;

        function checkScroll() {
            ticking = false;
            const docHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body ? document.body.scrollHeight : 0
            );
            const winHeight = window.innerHeight || 0;
            const scrollable = docHeight - winHeight;
            if (scrollable <= 100) return;

            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            const percent = Math.min(100, Math.round((scrollTop / scrollable) * 100));

            thresholds.forEach((mark) => {
                if (percent >= mark && !fired.has(mark)) {
                    fired.add(mark);
                    sendEvent('scroll_depth', { percent_scrolled: mark });
                }
            });
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(checkScroll);
            }
        }, { passive: true });
    }

    /**
     * 5. 활성 탭 기준 유효 체류 시간 추적 (15초, 30초, 60초, 180초)
     */
    function initEngagedTimeTracking() {
        const milestones = [15, 30, 60, 180];
        const fired = new Set();
        let activeSeconds = 0;

        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            activeSeconds += 5;

            milestones.forEach((sec) => {
                if (activeSeconds >= sec && !fired.has(sec)) {
                    fired.add(sec);
                    sendEvent('engaged_time', { engaged_seconds: sec });
                }
            });

            if (fired.size === milestones.length) {
                window.clearInterval(timer);
            }
        }, 5000);
    }

    /**
     * 6. 페이지 성능 지표 (로딩 속도 & FCP) 추적
     */
    function initPerformanceTracking() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                try {
                    const navEntries = performance.getEntriesByType('navigation');
                    const paintEntries = performance.getEntriesByType('paint');
                    const nav = navEntries && navEntries[0];
                    const fcp = paintEntries && paintEntries.find(p => p.name === 'first-contentful-paint');

                    const loadMs = nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0;
                    const fcpMs = fcp ? Math.round(fcp.startTime) : 0;

                    if (loadMs > 0 || fcpMs > 0) {
                        sendEvent('web_vitals_basic', {
                            page_load_ms: Math.max(0, loadMs),
                            fcp_ms: Math.max(0, fcpMs)
                        });
                    }
                } catch (e) { /* 무시 */ }
            }, 300);
        });
    }

    /**
     * 7. 런타임 오류 자동 수집 (개인정보 제외, 오류 유형만 기록)
     */
    function initErrorTracking() {
        let errorCount = 0;
        const MAX_ERRORS_PER_PAGE = 5;

        window.addEventListener('error', (e) => {
            if (errorCount >= MAX_ERRORS_PER_PAGE) return;
            errorCount++;
            sendEvent('tool_error', {
                error_type: 'runtime_error',
                error_source: e.filename ? e.filename.split('/').pop().slice(0, 40) : 'inline',
                error_line: e.lineno || 0
            });
        });

        window.addEventListener('unhandledrejection', () => {
            if (errorCount >= MAX_ERRORS_PER_PAGE) return;
            errorCount++;
            sendEvent('tool_error', {
                error_type: 'promise_rejection'
            });
        });
    }

    /**
     * 전역 공개 API: 개별 도구 모듈에서도 필요 시 직접 호출 가능
     */
    window.BangjangAnalytics = {
        measurementId: GA_MEASUREMENT_ID,
        sendEvent,
        trackActionStart(actionName, extra = {}) {
            sendEvent('tool_action_start', Object.assign({ action_name: actionName }, extra));
        },
        trackActionComplete(actionName, durationMs = 0, extra = {}) {
            sendEvent('tool_action_complete', Object.assign({
                action_name: actionName,
                duration_ms: Math.round(durationMs || 0)
            }, extra));
        },
        trackDownload(filename = '', method = 'blob_download', extra = {}) {
            const ext = (filename && filename.includes('.'))
                ? filename.split('.').pop().toLowerCase().slice(0, 10)
                : 'unknown';
            sendEvent('tool_download', Object.assign({
                download_method: method,
                output_format: ext
            }, extra));
        },
        trackError(errorType = 'tool_error', extra = {}) {
            sendEvent('tool_error', Object.assign({ error_type: errorType }, extra));
        }
    };

    // DOM 준비 시 모든 자동 추적기 초기화
    function initAll() {
        trackToolView();
        initFileUploadTracking();
        initClickTracking();
        initScrollTracking();
        initEngagedTimeTracking();
        initPerformanceTracking();
        initErrorTracking();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();

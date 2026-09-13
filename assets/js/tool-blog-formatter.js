/**
 * ====================================================================
 * tool-blog-formatter.js - 블로그 본문 자동 정리 & 스마트 줄바꿈 엔진
 * ====================================================================
 * 
 * 주요 기능:
 * 1. 실시간 본문 원문 글자 수 및 해시태그 개수 카운팅
 * 2. 한글 어절(단어) 단위 스마트 줄바꿈 (Word Wrap) & 줄 너비(30%~100%) 실시간 연동
 * 3. 560px 기준 종이 뷰포트 실시간 중앙정렬 미리보기
 * 4. 해시태그 자동 정규화 및 취합
 * 5. UTF-8 TXT 파일 즉시 다운로드 & 클립보드 원클릭 복사
 * 6. FAQ 아코디언 인터랙션
 */

class BlogFormatterTool {
    constructor() {
        // DOM 요소 캐싱
        this.inputContent = document.getElementById('blog-input-content');
        this.inputHashtags = document.getElementById('blog-input-hashtags');
        this.counterContent = document.getElementById('blog-content-counter');
        this.counterHashtags = document.getElementById('blog-hashtag-counter');

        this.checkSmartWrap = document.getElementById('check-smart-wrap');
        this.sliderLineWidth = document.getElementById('slider-line-width');
        this.valLineWidth = document.getElementById('val-line-width');

        this.previewContainer = document.getElementById('blog-preview-container');
        this.paperSheet = document.getElementById('blog-paper-sheet');
        this.paperContent = document.getElementById('blog-paper-content');
        this.paperHashtags = document.getElementById('blog-paper-hashtags');
        this.paperEmpty = document.getElementById('blog-paper-empty');

        this.btnDownloadTxt = document.getElementById('btn-download-txt');
        this.btnCopyText = document.getElementById('btn-copy-text');
        this.statusMsg = document.getElementById('blog-status-msg');

        this.faqItems = document.querySelectorAll('.blog-faq-item');

        // 상태 변수
        this.state = {
            content: '',
            hashtags: '',
            smartWrap: true,
            lineWidthPercent: 90,
            formattedText: '',
            parsedTags: []
        };

        this.init();
    }

    /**
     * 초기화 함수
     */
    init() {
        this.bindEvents();
        this.updatePreview();
    }

    /**
     * 이벤트 리스너 바인딩
     */
    bindEvents() {
        // 1. 본문 원문 입력 시 실시간 포맷팅
        if (this.inputContent) {
            this.inputContent.addEventListener('input', () => {
                this.state.content = this.inputContent.value;
                this.updateContentCounter();
                this.updatePreview();
            });
        }

        // 2. 해시태그 입력 시 실시간 파싱
        if (this.inputHashtags) {
            this.inputHashtags.addEventListener('input', () => {
                this.state.hashtags = this.inputHashtags.value;
                this.updateHashtagCounter();
                this.updatePreview();
            });
        }

        // 3. 짧은 줄 정리 체크박스 토글
        if (this.checkSmartWrap) {
            this.checkSmartWrap.addEventListener('change', (e) => {
                this.state.smartWrap = e.target.checked;
                this.updatePreview();
            });
        }

        // 4. 줄 너비 슬라이더 조절
        if (this.sliderLineWidth) {
            this.sliderLineWidth.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.state.lineWidthPercent = val;
                if (this.valLineWidth) {
                    this.valLineWidth.textContent = `${val}%`;
                }
                this.updatePreview();
            });
        }

        // 5. TXT 다운로드 버튼
        if (this.btnDownloadTxt) {
            this.btnDownloadTxt.addEventListener('click', () => {
                this.downloadFormattedTxt();
            });
        }

        // 6. 클립보드 복사 버튼
        if (this.btnCopyText) {
            this.btnCopyText.addEventListener('click', () => {
                this.copyFormattedText();
            });
        }

        // 7. FAQ 아코디언 토글
        this.faqItems.forEach(item => {
            const btn = item.querySelector('.blog-faq-question');
            if (btn) {
                btn.addEventListener('click', () => {
                    const isActive = item.classList.contains('active');
                    this.faqItems.forEach(i => i.classList.remove('active'));
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }

    /**
     * 본문 원문 글자 수 실시간 계산
     */
    updateContentCounter() {
        if (!this.counterContent) return;
        const text = this.state.content;
        const totalChars = text.length;
        const nonSpaceChars = text.replace(/\s/g, '').length;

        this.counterContent.textContent = `${totalChars.toLocaleString()}자 · 공백·줄바꿈 포함 (공백제외 ${nonSpaceChars.toLocaleString()}자)`;
    }

    /**
     * 해시태그 키워드 파싱 및 개수 계산
     */
    updateHashtagCounter() {
        this.state.parsedTags = this.parseHashtags(this.state.hashtags);
        if (this.counterHashtags) {
            this.counterHashtags.textContent = `${this.state.parsedTags.length}개 / 최대 100개`;
        }
    }

    /**
     * 해시태그 파싱 알고리즘
     * 공백, 쉼표, 줄바꿈, # 기호를 기준으로 분리하고 정규화
     */
    parseHashtags(rawInput) {
        if (!rawInput || !rawInput.trim()) return [];

        // 쉼표, 공백, 줄바꿈, 세미콜론 등으로 분리
        const tokens = rawInput.split(/[\s,;\n\r]+/);
        const tags = [];
        const seen = new Set();

        for (let token of tokens) {
            let clean = token.replace(/^[#＃]+/, '').trim();
            // 특수문자 일부 정리 (한글, 영문, 숫자, 언더스코어 허용)
            clean = clean.replace(/[^\w\uAC00-\uD7A3\u3131-\u318E\u4E00-\u9FFF]/g, '');

            if (clean.length > 0 && clean.length <= 50 && !seen.has(clean)) {
                seen.add(clean);
                tags.push(`#${clean}`);
                if (tags.length >= 100) break; // 최대 100개
            }
        }

        return tags;
    }

    /**
     * 한글 어절(단어) 단위 스마트 줄바꿈 (Word Wrap) 엔진
     */
    formatTextWithSmartWrap(text, smartWrap, widthPercent) {
        if (!text) return '';

        if (!smartWrap) {
            // 짧은 줄 정리가 꺼져 있으면 원본 줄바꿈 그대로 반환
            return text;
        }

        // 기준 폭 560px에서 100%일 때 한글 기준 약 36자
        // widthPercent(30%~100%)에 비례하여 줄당 최대 글자 수 산출
        const maxCharsPerLine = Math.max(10, Math.round(36 * (widthPercent / 100)));

        // 줄바꿈 단위로 문단 분리
        const lines = text.split('\n');
        const formattedLines = [];

        for (let line of lines) {
            const trimmedLine = line.trim();

            // 빈 줄(문단 구분)은 그대로 유지
            if (!trimmedLine) {
                formattedLines.push('');
                continue;
            }

            // URL이나 단일 긴 어절 감지
            if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
                formattedLines.push(trimmedLine);
                continue;
            }

            // 단어(어절) 단위 분리
            const words = trimmedLine.split(/\s+/);
            let currentLine = '';

            for (let word of words) {
                if (!currentLine) {
                    currentLine = word;
                } else {
                    // 현재 줄에 다음 단어를 붙였을 때 최대 글자수를 초과하는지 검사
                    const testLine = `${currentLine} ${word}`;
                    if (testLine.length <= maxCharsPerLine) {
                        currentLine = testLine;
                    } else {
                        // 초과하면 현재 줄을 push하고 다음 줄로 넘김
                        formattedLines.push(currentLine);
                        currentLine = word;
                    }
                }
            }

            if (currentLine) {
                formattedLines.push(currentLine);
            }
        }

        return formattedLines.join('\n');
    }

    /**
     * 실시간 중앙정렬 미리보기 업데이트
     */
    updatePreview() {
        const rawContent = this.state.content.trim();
        this.state.parsedTags = this.parseHashtags(this.state.hashtags);

        if (!rawContent) {
            // 빈 상태 (Empty State)
            if (this.paperEmpty) this.paperEmpty.style.display = 'block';
            if (this.paperContent) this.paperContent.style.display = 'none';
            if (this.paperHashtags) this.paperHashtags.style.display = 'none';

            if (this.btnDownloadTxt) this.btnDownloadTxt.disabled = true;
            if (this.btnCopyText) this.btnCopyText.disabled = true;
            if (this.statusMsg) this.statusMsg.textContent = '본문을 입력해 주세요.';
            return;
        }

        // 스마트 줄바꿈 적용
        this.state.formattedText = this.formatTextWithSmartWrap(
            this.state.content,
            this.state.smartWrap,
            this.state.lineWidthPercent
        );

        // 미리보기 종이 폭 조절 (30% ~ 100%)
        if (this.paperSheet) {
            const targetWidth = Math.round(560 * (this.state.lineWidthPercent / 100));
            this.paperSheet.style.maxWidth = `${targetWidth}px`;
        }

        // 본문 렌더링
        if (this.paperEmpty) this.paperEmpty.style.display = 'none';
        if (this.paperContent) {
            this.paperContent.style.display = 'block';
            this.paperContent.textContent = this.state.formattedText;
        }

        // 해시태그 렌더링
        if (this.paperHashtags) {
            if (this.state.parsedTags.length > 0) {
                this.paperHashtags.style.display = 'block';
                this.paperHashtags.textContent = this.state.parsedTags.join(' ');
            } else {
                this.paperHashtags.style.display = 'none';
            }
        }

        // 버튼 활성화 및 상태 텍스트 갱신
        if (this.btnDownloadTxt) this.btnDownloadTxt.disabled = false;
        if (this.btnCopyText) this.btnCopyText.disabled = false;

        const totalFormattedChars = this.state.formattedText.length;
        if (this.statusMsg) {
            this.statusMsg.textContent = `정리 완료 (총 ${totalFormattedChars.toLocaleString()}자)`;
        }
    }

    /**
     * 최종 취합된 텍스트 생성 (본문 + 해시태그)
     */
    getFinalCombinedText() {
        let result = this.state.formattedText;
        if (this.state.parsedTags.length > 0) {
            result += `\n\n${this.state.parsedTags.join(' ')}`;
        }
        return result;
    }

    /**
     * UTF-8 TXT 파일 다운로드
     */
    downloadFormattedTxt() {
        const finalContent = this.getFinalCombinedText();
        if (!finalContent.trim()) {
            alert('저장할 본문 내용이 없습니다.');
            return;
        }

        // 파일명 생성: blog_formatted_YYYYMMDD_HHMMSS.txt
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const filename = `blog_formatted_${yyyy}${mm}${dd}_${hh}${min}.txt`;

        // UTF-8 BOM(\uFEFF) 추가하여 메모장 및 한글에서 인코딩 깨짐 방지
        const blob = new Blob(['\uFEFF' + finalContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 클립보드 원클릭 복사
     */
    async copyFormattedText() {
        const finalContent = this.getFinalCombinedText();
        if (!finalContent.trim()) {
            alert('복사할 본문 내용이 없습니다.');
            return;
        }

        try {
            await navigator.clipboard.writeText(finalContent);
            
            // 버튼 피드백
            const originalHTML = this.btnCopyText.innerHTML;
            this.btnCopyText.innerHTML = '<i data-lucide="check" style="color:#10b981;"></i> <span>복사 완료!</span>';
            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                this.btnCopyText.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        } catch (err) {
            // 폴백: prompt 창으로 복사 지원
            console.error('클립보드 복사 실패:', err);
            prompt('아래 내용을 복사하세요 (Ctrl+C):', finalContent);
        }
    }
}

// DOM 로드 완료 시 인스턴스 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.blogFormatterTool = new BlogFormatterTool();
});

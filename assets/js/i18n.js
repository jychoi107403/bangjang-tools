/**
 * ====================================================================
 * i18n.js - 방장 용용이 글로벌 다국어(한국어 ↔ English) 번역 엔진
 * ====================================================================
 * - 접속자의 브라우저 언어를 자동 감지하여 영문권 사용자에게 영어 UI 제공
 * - 상단 GNB 언어 전환 버튼(KO/EN)을 통해 실시간으로 언어 변경 및 LocalStorage 저장
 * - data-i18n, data-i18n-placeholder, data-i18n-title 속성을 자동으로 번역
 */

const I18N_DICTIONARY = {
    ko: {
        // 브랜드 및 공통
        "brand.title": "방장 용용이",
        "brand.subtitle": "무료 실무 도구",
        "nav.all_tools": "모든 도구",
        "nav.image_tools": "이미지 도구",
        "nav.video_tools": "영상 도구",
        "nav.blog_tools": "블로그 도구",
        "nav.image_tools_badge": "6개 도구",
        "nav.video_tools_badge": "3개 도구",
        "nav.blog_tools_badge": "2개 도구",
        
        // 도구 목록
        "tool.image_edit": "이미지 편집",
        "tool.image_split": "사진 분할",
        "tool.remove_bg": "배경 제거·바꾸기",
        "tool.mosaic": "사진 모자이크",
        "tool.qr_code": "QR 코드 생성",
        "tool.batch_rename": "파일명 일괄 변경",
        "tool.video_trim_gif": "영상 구간 → GIF",
        "tool.video_to_gif": "영상 → GIF",
        "tool.screen_record_gif": "화면녹화 → GIF",
        "tool.blog_formatter": "블로그 본문 정리",
        "tool.pdf_to_word": "PDF → Word",

        // 공통 버튼 및 라벨
        "btn.help": "도움말",
        "btn.confirm": "확인",
        "btn.close": "닫기",
        "btn.download": "다운로드",
        "btn.reset": "초기화",
        "btn.apply": "적용하기",
        "btn.save": "저장하기",
        "btn.copy": "복사",
        "btn.copied": "복사 완료!",
        "label.sponsor": "스폰서 광고",
        "label.security_notice": "내 파일은 내 기기에서 (100% 로컬 처리)",
        "label.security_desc": "선택한 파일은 외부 서버에 업로드되지 않고 브라우저에서 안전하게 처리됩니다.",
        "footer.terms": "이용약관",
        "footer.privacy": "개인정보처리방침",
        "footer.contact": "문의 및 제휴",
        
        // 메인 대시보드
        "home.hero_title": "복잡한 작업도 3초 만에, 무료 실무 도구 모음",
        "home.hero_desc": "서버 업로드 없는 100% 브라우저 로컬 처리로 소중한 개인정보와 업무 파일을 안전하게 보호합니다.",
        "home.stat_free": "100% 무료",
        "home.stat_client": "100% 로컬 실행",
        "home.stat_limit": "무제한 사용",
        "home.cat_image_title": "이미지 도구",
        "home.cat_image_desc": "자르기, 필터, 배경 제거, 모자이크, 분할, QR코드 및 파일명 일괄 변경",
        "home.cat_video_title": "영상 도구",
        "home.cat_video_desc": "영상 구간 자르기, 비디오/화면녹화 즉시 GIF 변환",
        "home.cat_blog_title": "블로그 & 문서 도구",
        "home.cat_blog_desc": "블로그 폰트/줄바꿈 정리 및 PDF 문서 변환"
    },
    en: {
        // 브랜드 및 공통
        "brand.title": "Bangjang Tools",
        "brand.subtitle": "Free Online Utilities",
        "nav.all_tools": "All Tools",
        "nav.image_tools": "Image Tools",
        "nav.video_tools": "Video Tools",
        "nav.blog_tools": "Blog & Docs",
        "nav.image_tools_badge": "6 Tools",
        "nav.video_tools_badge": "3 Tools",
        "nav.blog_tools_badge": "2 Tools",
        
        // 도구 목록
        "tool.image_edit": "Image Editor",
        "tool.image_split": "Image Splitter",
        "tool.remove_bg": "Remove / Change BG",
        "tool.mosaic": "Photo Mosaic & Blur",
        "tool.qr_code": "QR Code Generator",
        "tool.batch_rename": "Batch File Renamer",
        "tool.video_trim_gif": "Video Trim → GIF",
        "tool.video_to_gif": "Video → GIF",
        "tool.screen_record_gif": "Screen Record → GIF",
        "tool.blog_formatter": "Blog Text Formatter",
        "tool.pdf_to_word": "PDF → Word",

        // 공통 버튼 및 라벨
        "btn.help": "Guide",
        "btn.confirm": "OK",
        "btn.close": "Close",
        "btn.download": "Download",
        "btn.reset": "Reset",
        "btn.apply": "Apply",
        "btn.save": "Save",
        "btn.copy": "Copy",
        "btn.copied": "Copied!",
        "label.sponsor": "Sponsored Ad",
        "label.security_notice": "100% Client-Side Privacy (Local Processing)",
        "label.security_desc": "Your files are processed directly in your browser and never uploaded to any server.",
        "footer.terms": "Terms of Service",
        "footer.privacy": "Privacy Policy",
        "footer.contact": "Contact Us",
        
        // 메인 대시보드
        "home.hero_title": "Smart & Free Online Productivity Tools",
        "home.hero_desc": "Fast, privacy-focused browser tools. Zero server uploads, completely free without limits.",
        "home.stat_free": "100% Free",
        "home.stat_client": "100% Local Run",
        "home.stat_limit": "No Limits",
        "home.cat_image_title": "Image Tools",
        "home.cat_image_desc": "Crop, filter, AI background remover, blur, grid split, QR code, and batch rename",
        "home.cat_video_title": "Video Tools",
        "home.cat_video_desc": "Trim videos, convert video clips & screen recordings directly to GIF",
        "home.cat_blog_title": "Blog & Document Tools",
        "home.cat_blog_desc": "Format blog post layouts and convert PDF documents"
    }
};

class I18nManager {
    constructor() {
        this.currentLang = this.getInitialLanguage();
        this.init();
    }

    /**
     * 초기 언어 결정: LocalStorage > 브라우저 언어 > 기본값(ko)
     */
    getInitialLanguage() {
        const saved = localStorage.getItem('app_lang');
        if (saved && (saved === 'ko' || saved === 'en')) {
            return saved;
        }
        // 브라우저 언어 확인 (영어권인 경우 en 기본 제공)
        const userLang = navigator.language || navigator.userLanguage || 'ko';
        if (userLang.startsWith('en')) {
            return 'en';
        }
        return 'ko';
    }

    /**
     * 초기화 및 이벤트 리스너 등록
     */
    init() {
        document.documentElement.lang = this.currentLang;
        document.addEventListener('DOMContentLoaded', () => {
            this.applyTranslations();
            this.updateSwitcherUI();
        });
    }

    /**
     * 언어 변경
     */
    setLanguage(lang) {
        if (lang !== 'ko' && lang !== 'en') return;
        this.currentLang = lang;
        localStorage.setItem('app_lang', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
        this.updateSwitcherUI();
        
        // Lucide 아이콘 다시 렌더링
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 현재 번역 텍스트 가져오기
     */
    t(key, fallback = '') {
        const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.ko;
        return dict[key] || fallback || key;
    }

    /**
     * DOM 전체 번역 적용
     */
    applyTranslations() {
        const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.ko;
        
        // 1. data-i18n 일반 텍스트
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        // 2. data-i18n-placeholder 속성
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });

        // 3. data-i18n-title 속성
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key]) {
                el.title = dict[key];
            }
        });
    }

    /**
     * 언어 전환 버튼 UI 상태 동기화
     */
    updateSwitcherUI() {
        const buttons = document.querySelectorAll('.lang-btn');
        buttons.forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            if (lang === this.currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// 전역 인스턴스 생성 및 노출
window.i18n = new I18nManager();

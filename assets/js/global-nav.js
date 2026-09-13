/**
 * ============================================================================
 * assets/js/global-nav.js - 공통 반응형 모바일 네비게이션 인터랙션
 * ============================================================================
 * [기능]:
 * 1. 모바일 햄버거 메뉴(☰) 클릭 시 좌측 사이드바 슬라이드 오픈
 * 2. 딤드 배경(Backdrop) 또는 닫기(X) 버튼 클릭 시 사이드바 닫기
 * 3. 메뉴 링크 클릭 시 사이드바 자동 닫기 및 부드러운 화면 전환
 */

(function () {
    function initGlobalNav() {
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        let backdrop = document.querySelector('.sidebar-backdrop');

        // 딤드 오버레이가 DOM에 없으면 자동 생성
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            document.body.appendChild(backdrop);
        }

        // 사이드바 상단 닫기 버튼이 없으면 자동 생성
        if (sidebar && !sidebar.querySelector('.sidebar-mobile-close')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'sidebar-mobile-close';
            closeBtn.setAttribute('aria-label', '메뉴 닫기');
            closeBtn.innerHTML = '&times;';
            sidebar.insertBefore(closeBtn, sidebar.firstChild);

            closeBtn.addEventListener('click', closeSidebar);
        }

        function openSidebar() {
            if (sidebar) sidebar.classList.add('mobile-open');
            if (backdrop) backdrop.classList.add('active');
            document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
        }

        function closeSidebar() {
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (backdrop) backdrop.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar && sidebar.classList.contains('mobile-open')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeSidebar);
        }

        // ESC 키 입력 시 닫기
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
                closeSidebar();
            }
        });

        // 모바일에서 메뉴 항목 클릭 시 사이드바 닫기
        const navItems = document.querySelectorAll('.sidebar .nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });

        // 화면 크기가 데스크톱으로 전환되면 모바일 상태 자동 해제
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && sidebar && sidebar.classList.contains('mobile-open')) {
                closeSidebar();
            }
        });

        // ====================================================================
        // 도움말 모달 팝업 제어
        // ====================================================================
        const helpBtn = document.querySelector('.btn-help-trigger');
        const helpModal = document.querySelector('.help-modal-backdrop');
        const closeHelpBtns = document.querySelectorAll('.btn-close-modal, .btn-modal-confirm');

        function openHelpModal() {
            if (helpModal) {
                helpModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeHelpModal() {
            if (helpModal) {
                helpModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openHelpModal();
            });
        }

        closeHelpBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeHelpModal();
            });
        });

        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    closeHelpModal();
                }
            });
        }

        // ESC 키로 도움말 모달 닫기
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && helpModal && helpModal.classList.contains('active')) {
                closeHelpModal();
            }
        });

        // ====================================================================
        // 상단 GNB 드롭다운 메뉴 제어 (보였다 안보였다 기능)
        // ====================================================================
        const gnbDropdownItems = document.querySelectorAll('.gnb-dropdown-item');

        gnbDropdownItems.forEach(item => {
            const btn = item.querySelector('.gnb-tab-btn');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = item.classList.contains('open');

                    // 다른 열린 드롭다운 닫기
                    gnbDropdownItems.forEach(other => {
                        if (other !== item) other.classList.remove('open');
                    });

                    if (isOpen) {
                        item.classList.remove('open');
                    } else {
                        item.classList.add('open');
                    }
                });
            }
        });

        // 외부 영역 클릭 시 열려있는 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.gnb-dropdown-item')) {
                gnbDropdownItems.forEach(item => item.classList.remove('open'));
            }
        });

        // ESC 키 입력 시 드롭다운 닫기
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                gnbDropdownItems.forEach(item => item.classList.remove('open'));
            }
        });

        // ====================================================================
        // 언어 전환 버튼 (KO / EN) 제어
        // ====================================================================
        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetLang = btn.getAttribute('data-lang');
                if (window.i18n) {
                    window.i18n.setLanguage(targetLang);
                }
            });
        });

        // ====================================================================
        // 개인정보처리방침 및 이용약관 모달 제어 (애드센스 승인 요건)
        // ====================================================================
        const privacyTriggers = document.querySelectorAll('.btn-privacy-trigger');
        const termsTriggers = document.querySelectorAll('.btn-terms-trigger');
        const legalModal = document.querySelector('#legal-modal');
        const legalTitle = document.querySelector('#legal-modal-title');
        const legalBody = document.querySelector('#legal-modal-body');
        const closeLegalBtns = document.querySelectorAll('.btn-close-legal, .btn-legal-confirm');

        const LEGAL_TEXTS = {
            privacy: {
                title: "개인정보처리방침 (Privacy Policy)",
                content: `
                    <p>방장 용용이(이하 "서비스")는 이용자의 개인정보를 매우 소중하게 생각하며, 관련 법령을 철저히 준수합니다.</p>
                    <h3>1. 처리하는 데이터 및 100% 로컬 처리 원칙</h3>
                    <p>본 서비스에서 제공하는 모든 이미지 편집, 배경 제거, QR 코드 생성, 파일명 변경, 모자이크 등의 기능은 <strong>외부 서버로 파일을 전송하지 않고 사용자의 웹 브라우저(클라이언트) 내부에서 100% 처리</strong>됩니다.</p>
                    <h3>2. 쿠키 및 광고 네트워크(Google AdSense) 안내</h3>
                    <p>본 사이트는 서비스 개선 및 맞춤형 광고 게재를 위해 Google AdSense를 이용하며, Google을 포함한 제3자 공급업체는 쿠키를 사용하여 사용자의 웹사이트 방문 기록을 바탕으로 광고를 게재할 수 있습니다.</p>
                    <h3>3. 이용자의 권리</h3>
                    <p>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.</p>
                `
            },
            terms: {
                title: "서비스 이용약관 (Terms of Service)",
                content: `
                    <p>방장 용용이 웹사이트의 모든 실무 도구는 <strong>누구나 제한 없이 100% 무료</strong>로 이용하실 수 있습니다.</p>
                    <h3>1. 서비스의 목적</h3>
                    <p>본 서비스는 사용자의 업무 효율성과 창작 활동을 지원하기 위해 무료로 제공되는 생산성 유틸리티 도구 모음입니다.</p>
                    <h3>2. 저작권 및 파일 소유권</h3>
                    <p>사용자가 도구를 통해 편집, 생성, 변환한 모든 이미지와 파일의 소유권 및 저작권은 100% 사용자 본인에게 귀속됩니다.</p>
                    <h3>3. 면책 조항</h3>
                    <p>본 서비스는 최상의 안정성을 목표로 하지만, 이용자의 기기 환경이나 브라우저 특성으로 인해 발생하는 예기치 못한 데이터 손실에 대해 법적 책임을 지지 않으므로 중요 파일은 작업 전 백업을 권장합니다.</p>
                `
            }
        };

        function openLegalModal(type) {
            if (!legalModal) return;
            const data = LEGAL_TEXTS[type] || LEGAL_TEXTS.privacy;
            if (legalTitle) legalTitle.textContent = data.title;
            if (legalBody) legalBody.innerHTML = data.content;
            legalModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLegalModal() {
            if (!legalModal) return;
            legalModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        privacyTriggers.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openLegalModal('privacy');
            });
        });

        termsTriggers.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openLegalModal('terms');
            });
        });

        closeLegalBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeLegalModal();
            });
        });

        if (legalModal) {
            legalModal.addEventListener('click', (e) => {
                if (e.target === legalModal) {
                    closeLegalModal();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalNav);
    } else {
        initGlobalNav();
    }
})();




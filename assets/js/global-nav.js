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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalNav);
    } else {
        initGlobalNav();
    }
})();



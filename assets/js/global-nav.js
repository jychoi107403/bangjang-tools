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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalNav);
    } else {
        initGlobalNav();
    }
})();

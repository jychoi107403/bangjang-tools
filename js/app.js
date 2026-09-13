/**
 * ============================================================================
 * app.js - 전체 애플리케이션 초기화 및 전역 네비게이션 인터랙션
 * ============================================================================
 * 
 * [주요 역할]
 * 1. Lucide 아이콘 초기화 (페이지 내 모든 아이콘 렌더링)
 * 2. 각 서브 모듈 초기화:
 *    - ImageEditor: 기존 이미지 편집 모듈 (캡처 및 인라인/모달 편집)
 *    - ClipboardManager: 전역 클립보드 붙여넣기 감지 모듈
 *    - Exporter: 이미지 내보내기/저장 모듈
 *    - ImageSplitter: 신규 사진 분할 (4분할 등) 모듈
 * 3. 좌측 사이드바 탭 전환:
 *    - [이미지 편집] 클릭 -> #view-image-edit 표시
 *    - [사진 분할] 클릭 -> #view-image-split 표시
 *    - 기타 메뉴 -> 준비 중 알림 표시
 * 4. 기타 글로벌 버튼(전체 삭제, 모달 열기 등) 이벤트 연결
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. 아이콘 렌더링 (Lucide Icons)
    // ------------------------------------------------------------------------
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // ------------------------------------------------------------------------
    // 2. 모듈 초기화
    // ------------------------------------------------------------------------
    // 기존 이미지 편집 모듈 초기화
    if (window.ImageEditor) {
        ImageEditor.init();
    }
    if (window.ClipboardManager) {
        ClipboardManager.init();
    }
    if (window.Exporter) {
        Exporter.init();
    }

    // 신규 사진 분할 모듈 초기화
    if (window.ImageSplitter) {
        ImageSplitter.init();
    }

    // ------------------------------------------------------------------------
    // 3. 뷰(화면) 전환 함수 정의
    // ------------------------------------------------------------------------
    /**
     * 특정 도구 화면으로 전환하는 함수
     * @param {string} toolName - 'image-edit' 또는 'image-split'
     */
    function switchView(toolName) {
        const viewImageEdit = document.getElementById('view-image-edit');
        const viewImageSplit = document.getElementById('view-image-split');
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

        // 사이드바 active 클래스 갱신
        navItems.forEach(item => {
            if (item.getAttribute('data-tool') === toolName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        if (toolName === 'image-edit') {
            // [이미지 편집] 화면 표시
            if (viewImageEdit) viewImageEdit.style.display = 'contents';
            if (viewImageSplit) viewImageSplit.style.display = 'none';
        } else if (toolName === 'image-split') {
            // [사진 분할] 화면 표시
            if (viewImageEdit) viewImageEdit.style.display = 'none';
            if (viewImageSplit) viewImageSplit.style.display = 'contents';

            // 사진 분할 캔버스 리렌더링 (화면이 보일 때 크기 재계산)
            if (window.ImageSplitter && typeof ImageSplitter.renderCanvas === 'function') {
                setTimeout(() => {
                    ImageSplitter.renderCanvas();
                }, 50);
            }
        }

        // 아이콘 재생성
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ------------------------------------------------------------------------
    // 4. 왼쪽 사이드바 네비게이션 탭 인터랙션
    // ------------------------------------------------------------------------
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tool = item.getAttribute('data-tool');
            
            if (tool === 'image-edit') {
                switchView('image-edit');
            } else if (tool === 'image-split') {
                switchView('image-split');
            } else {
                const toolName = item.querySelector('span') ? item.querySelector('span').textContent.trim() : '도구';
                alert(`'${toolName}' 기능은 현재 준비 중입니다.\n현재는 [이미지 편집] 및 [사진 분할] 기능을 이용하실 수 있습니다.`);
            }
        });
    });

    // ------------------------------------------------------------------------
    // 5. 홈 버튼 클릭 시 [이미지 편집] 기본 뷰로 이동
    // ------------------------------------------------------------------------
    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
        btnHome.addEventListener('click', () => {
            switchView('image-edit');
        });
    }

    // ------------------------------------------------------------------------
    // 6. [이미지 편집] 상단 툴바 전체 삭제 버튼
    // ------------------------------------------------------------------------
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (window.ImageEditor) {
                ImageEditor.clearAll();
            }
        });
    }

    // ------------------------------------------------------------------------
    // 7. [이미지 편집] 하단 [선택 사진 정밀 편집] 버튼 클릭 시 모달 열기
    // ------------------------------------------------------------------------
    const btnDetailEdit = document.getElementById('btn-detail-edit');
    if (btnDetailEdit) {
        btnDetailEdit.addEventListener('click', () => {
            if (window.ImageEditor && ImageEditor.selectedId) {
                const item = ImageEditor.images.find(img => img.id === ImageEditor.selectedId);
                if (item && window.ModalEditor) {
                    ModalEditor.open(item);
                }
            }
        });
    }

    console.log('방장 용용이 - 무료 실무 도구가 성공적으로 시작되었습니다.');
});

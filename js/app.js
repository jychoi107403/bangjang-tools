/**
 * ============================================================================
 * app.js - 전체 애플리케이션 초기화 및 전역 네비게이션 인터랙션
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 아이콘 렌더링
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // 2. 모듈 초기화
    ImageEditor.init();
    ClipboardManager.init();
    Exporter.init();

    // 3. 상단 툴바 전체 삭제 버튼
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            ImageEditor.clearAll();
        });
    }

    // 4. 하단 [선택 사진 정밀 편집] 버튼 클릭 시 모달 열기
    const btnDetailEdit = document.getElementById('btn-detail-edit');
    if (btnDetailEdit) {
        btnDetailEdit.addEventListener('click', () => {
            if (ImageEditor.selectedId) {
                const item = ImageEditor.images.find(img => img.id === ImageEditor.selectedId);
                if (item && window.ModalEditor) {
                    ModalEditor.open(item);
                }
            }
        });
    }

    // 5. 왼쪽 사이드바 네비게이션 탭 인터랙션
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tool = item.getAttribute('data-tool');
            if (tool === 'image-edit') {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            } else {
                const toolName = item.querySelector('span') ? item.querySelector('span').textContent : '도구';
                alert(`'${toolName}' 기능은 현재 준비 중입니다.\n현재는 [이미지 편집] 기능을 이용하실 수 있습니다.`);
            }
        });
    });

    // 6. 홈 버튼
    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
        btnHome.addEventListener('click', () => {
            const editNav = document.querySelector('[data-tool="image-edit"]');
            if (editNav) {
                navItems.forEach(n => n.classList.remove('active'));
                editNav.classList.add('active');
            }
        });
    }

    console.log('방장 용용이 - 무료 실무 도구가 성공적으로 시작되었습니다.');
});

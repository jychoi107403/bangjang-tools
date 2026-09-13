/**
 * ============================================================================
 * app.js - 전체 애플리케이션 초기화 및 공통 인터랙션 스크립트
 * ============================================================================
 * 
 * [주요 역할]
 * 1. Lucide 아이콘 초기화 (페이지 내 모든 벡터 아이콘 렌더링)
 * 2. 각 서브 모듈 초기화:
 *    - ImageEditor: 이미지 편집 모듈 (캡처 붙여넣기 및 인라인/모달 정밀 편집)
 *    - ClipboardManager: 전역 클립보드 붙여넣기 감지 모듈
 *    - Exporter: 이미지 내보내기/저장 모듈
 *    - ImageSplitter: 사진 분할 (4분할 등) 모듈
 * 3. 공통 버튼 이벤트(전체 삭제, 정밀 편집 모달 등) 바인딩
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. 아이콘 렌더링 (Lucide Icons)
    // ------------------------------------------------------------------------
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // ------------------------------------------------------------------------
    // 2. 모듈별 안전 초기화 (해당 모듈 객체가 로드된 페이지에서만 동작)
    // ------------------------------------------------------------------------
    // 이미지 편집 모듈 초기화
    if (window.ImageEditor && typeof ImageEditor.init === 'function') {
        ImageEditor.init();
    }
    if (window.ClipboardManager && typeof ClipboardManager.init === 'function') {
        ClipboardManager.init();
    }
    if (window.Exporter && typeof Exporter.init === 'function') {
        Exporter.init();
    }

    // 사진 분할 모듈 초기화
    if (window.ImageSplitter && typeof ImageSplitter.init === 'function') {
        ImageSplitter.init();
    }

    // ------------------------------------------------------------------------
    // 3. [이미지 편집] 상단 툴바 전체 삭제 버튼
    // ------------------------------------------------------------------------
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (window.ImageEditor && typeof ImageEditor.clearAll === 'function') {
                ImageEditor.clearAll();
            }
        });
    }

    // ------------------------------------------------------------------------
    // 4. [이미지 편집] 하단 [선택 사진 정밀 편집] 버튼 클릭 시 모달 열기
    // ------------------------------------------------------------------------
    const btnDetailEdit = document.getElementById('btn-detail-edit');
    if (btnDetailEdit) {
        btnDetailEdit.addEventListener('click', () => {
            if (window.ImageEditor && ImageEditor.selectedId) {
                const item = ImageEditor.images.find(img => img.id === ImageEditor.selectedId);
                if (item && window.ModalEditor && typeof ModalEditor.open === 'function') {
                    ModalEditor.open(item);
                }
            }
        });
    }

    console.log('방장 용용이 - 무료 실무 도구가 성공적으로 로드되었습니다.');
});

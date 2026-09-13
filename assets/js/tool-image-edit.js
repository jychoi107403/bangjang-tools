/**
 * ============================================================================
 * assets/js/tool-image-edit.js - [이미지 편집] 전용 독립 ES 모듈
 * ============================================================================
 * [핵심 기능]
 * 1. 이미지 선택 시 상단 목록 바로 아래에 [대형 작업 뷰어] 표시
 * 2. 우측 [선택 사진 실시간 편집] 패널 연동:
 *    - 회전(좌/우 90°), 반전(좌우/상하) 즉각 반영
 *    - 밝기, 대비, 채도 슬라이더 실시간 조절
 *    - 자르기(Crop) 영역 드래그 지정 및 비율별(1:1, 4:3, 16:9, 자유) 크롭
 *    - 캔버스 직접 드래그 모자이크(Mosaic) 브러시 기능
 *    - 원본 복구 기능
 * 3. 우측 [전체 일괄 설정] 패널 연동:
 *    - 세로 크기 맞춤 (800px 등 전체 사진 자동 비례 리사이징)
 *    - 전체 밝기 및 테두리(두께, 색상)
 *    - 9방향 워터마크 로고 합성 (너비, 농도, 여백, 위치)
 *    - EXIF 메타데이터 100% 자동 제거 및 순차 다운로드
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 상태 변수 정의 (격리된 모듈 스코프)
// ----------------------------------------------------------------------------

/** 등록된 이미지 목록 배열 */
let images = [];

/** 현재 선택되어 하단 뷰어 및 우측 패널에서 편집 중인 이미지 ID */
let selectedId = null;

// [개별 편집 모드 상태]
let isCropMode = false;           // 자르기 모드 활성화 여부
let cropRatio = 'free';           // 'free' | '1:1' | '4:3' | '16:9'
let cropRect = { x: 0, y: 0, w: 0, h: 0 }; // 캔버스 기준 자르기 좌표
let isCroppingDrag = false;       // 자르기 드래그 중 여부
let cropDragStart = { x: 0, y: 0 };

let isMosaicMode = false;         // 모자이크 브러시 모드 활성화 여부
let isMosaicDrawing = false;      // 모자이크 드로잉 중 여부
let mosaicBlockSize = 20;         // 모자이크 블록 크기 (px)

// [우측 전체 일괄 설정 상태]
let isHeightFit = false;          // 세로 크기 맞춤 여부
let targetHeightPx = 800;         // 맞춤 세로 픽셀 (기본 800px)
let globalBrightness = 100;       // 전체 밝기 % (50 ~ 150)
let borderPx = 0;                 // 테두리 두께 (px)
let borderColor = '#000000';      // 테두리 색상

// [워터마크 설정 상태]
let useWatermark = false;         // 워터마크 적용 여부
let watermarkType = 'image';      // 'image' | 'text'
let watermarkImg = null;          // 워터마크 Image 객체
let watermarkWidth = 300;         // 로고 너비 (px)
let watermarkPosition = 'bottom-right'; // 9방향 위치
let watermarkOpacity = 70;        // 농도 %
let watermarkMargin = 30;         // 여백 px

// [내보내기 설정 상태]
let exportFormat = 'jpeg';        // 'jpeg' | 'png' | 'webp'
let jpgQuality = 90;              // JPG 품질 % (30 ~ 100)

// [대화면 정밀 모달 상태]
let modalTargetItem = null;
let modalCanvas = null;
let modalCtx = null;

// ----------------------------------------------------------------------------
// 2. 초기화 (DOM 로드 후 바인딩)
// ----------------------------------------------------------------------------
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindViewerEvents();
    bindPhotoEditSideControls();
    bindBatchSettingsUI();
    bindModalEditor();
}

// ----------------------------------------------------------------------------
// 3. 붙여넣기(Ctrl+V) & 파일 추가 & 드래그앤드롭
// ----------------------------------------------------------------------------

/** 클립보드 붙여넣기 이벤트 바인딩 */
function bindPasteEvents() {
    window.addEventListener('paste', async (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' && document.activeElement.type === 'text') return;

        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await addImageFromFile(file, `캡처_이미지_${Date.now()}`);
                }
            }
        }
    });

    const btnPaste = document.getElementById('btn-paste');
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    let found = false;
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        for (const type of types) {
                            const blob = await item.getType(type);
                            const file = new File([blob], `붙여넣기_${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
                            await addImageFromFile(file);
                            found = true;
                        }
                    }
                    if (!found) alert('클립보드에 복사된 이미지가 없습니다.\nWin + Shift + S로 캡처 후 다시 눌러주세요.');
                } else {
                    alert('Ctrl + V 키를 눌러 캡처 이미지를 붙여넣어 주세요.');
                }
            } catch (err) {
                alert('Ctrl + V 단축키를 사용하여 화면에 바로 붙여넣어 주세요.');
            }
        });
    }
}

/** 파일 선택 창 및 전체 삭제 바인딩 */
function bindFileInputEvents() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            for (const file of files) {
                await addImageFromFile(file);
            }
            fileInput.value = '';
        });
    }

    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (images.length === 0) return;
            if (confirm('등록된 모든 이미지를 삭제하시겠습니까?')) {
                images = [];
                selectedId = null;
                updateGalleryUI();
                closeViewer();
            }
        });
    }
}

/** 드래그 앤 드롭 업로드 바인딩 */
function bindDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'dragend'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        for (const file of files) {
            await addImageFromFile(file);
        }
    });
}

/**
 * 파일 객체로부터 이미지 객체 생성 및 배열에 등록
 */
async function addImageFromFile(file, customName = '') {
    if (images.length >= 30) {
        alert('최대 30장까지만 추가할 수 있습니다.');
        return;
    }
    if (file.size > 25 * 1024 * 1024) {
        alert(`'${file.name}' 파일이 25MB를 초과하여 추가할 수 없습니다.`);
        return;
    }

    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        // 작업용 캔버스 생성 및 초기 드로잉
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const name = customName ? `${customName}.png` : file.name;

        const newImageItem = {
            id,
            name,
            originalImg: img,
            currentCanvas: canvas,
            width: img.naturalWidth,
            height: img.naturalHeight,
            // 개별 사진 보정 상태
            brightness: 100,
            contrast: 100,
            saturate: 100
        };

        images.push(newImageItem);
        updateGalleryUI();

        // 새로 추가된 사진을 자동으로 선택하여 아래쪽 대형 뷰어로 노출
        selectImage(id);
    } catch (err) {
        console.error('이미지 로드 오류:', err);
    }
}

// ----------------------------------------------------------------------------
// 4. 갤러리 UI 렌더링 & 선택 관리
// ----------------------------------------------------------------------------

/** 상단 썸네일 그리드 UI 갱신 */
function updateGalleryUI() {
    const emptyState = document.getElementById('empty-state');
    const imageGrid = document.getElementById('image-grid');
    const badge = document.getElementById('image-count-badge');

    if (badge) badge.textContent = `${images.length} / 30장`;

    if (images.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (imageGrid) imageGrid.style.display = 'none';
        closeViewer();
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (imageGrid) {
        imageGrid.style.display = 'grid';
        imageGrid.innerHTML = '';

        images.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `image-card ${item.id === selectedId ? 'selected' : ''}`;
            card.setAttribute('data-id', item.id);

            card.innerHTML = `
                <div class="image-thumb-wrap">
                    <span class="image-order-badge">${index + 1}</span>
                    <button class="btn-card-delete" title="삭제"><i data-lucide="trash-2"></i></button>
                    <img class="image-thumb" src="${item.currentCanvas.toDataURL('image/jpeg', 0.8)}" alt="${item.name}">
                </div>
                <div class="image-info-bar">
                    <span class="image-name" title="${item.name}">${item.name}</span>
                    <span class="image-dimensions">${item.width}×${item.height}</span>
                </div>
            `;

            // 단일 클릭: 하단 대형 뷰어 노출 & 우측 실시간 편집 활성화
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-card-delete')) return;
                selectImage(item.id);
            });

            // 더블 클릭: 대화면 정밀 모달 편집창 열기
            card.addEventListener('dblclick', (e) => {
                if (e.target.closest('.btn-card-delete')) return;
                openModalEditor(item);
            });

            // 개별 삭제 버튼
            const btnDel = card.querySelector('.btn-card-delete');
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                images = images.filter(img => img.id !== item.id);
                if (selectedId === item.id) {
                    selectedId = images.length > 0 ? images[0].id : null;
                    if (selectedId) selectImage(selectedId);
                    else closeViewer();
                }
                updateGalleryUI();
            });

            imageGrid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * 특정 이미지 선택 처리
 * - 하단 대형 뷰어 활성화 및 캔버스 렌더링
 * - 우측 사이드바 컨트롤 값 동기화
 */
function selectImage(id) {
    selectedId = id;
    const item = images.find(img => img.id === id);
    if (!item) return;

    // 상단 갤러리 선택 스타일 갱신
    document.querySelectorAll('.image-card').forEach(card => {
        if (card.getAttribute('data-id') === id) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    // 1. 하단 뷰어 패널 노출 & 정보 업데이트
    const viewerPanel = document.getElementById('viewer-panel');
    const photoNameEl = document.getElementById('viewer-photo-name');
    const photoDimEl = document.getElementById('viewer-photo-dim');

    if (viewerPanel) {
        viewerPanel.style.display = 'flex';
        if (photoNameEl) photoNameEl.textContent = item.name;
        if (photoDimEl) photoDimEl.textContent = `${item.width} × ${item.height} px`;
        
        // 캔버스 렌더링
        renderViewerCanvas(item);
    }

    // 2. 우측 사이드바 컨트롤 활성화 및 값 동기화
    syncSidebarWithSelectedItem(item);

    // 모드 초기화
    disableCropMode();
    disableMosaicMode();
}

/** 하단 뷰어 닫기 (선택 해제) */
function closeViewer() {
    selectedId = null;
    const viewerPanel = document.getElementById('viewer-panel');
    if (viewerPanel) viewerPanel.style.display = 'none';

    document.querySelectorAll('.image-card').forEach(card => card.classList.remove('selected'));

    const noPhotoMsg = document.getElementById('no-photo-selected-msg');
    const editControls = document.getElementById('photo-edit-controls');
    const badgeName = document.getElementById('badge-selected-photo-name');

    if (noPhotoMsg) noPhotoMsg.style.display = 'block';
    if (editControls) editControls.style.display = 'none';
    if (badgeName) badgeName.textContent = '선택 없음';
}

/**
 * 하단 대형 뷰어 캔버스에 이미지 렌더링 (필터 효과 포함)
 */
function renderViewerCanvas(item) {
    const canvas = document.getElementById('viewer-main-canvas');
    if (!canvas || !item) return;

    canvas.width = item.currentCanvas.width;
    canvas.height = item.currentCanvas.height;
    const ctx = canvas.getContext('2d');

    // 개별 색상 필터 적용 (밝기, 대비, 채도)
    ctx.save();
    ctx.filter = `brightness(${item.brightness}%) contrast(${item.contrast}%) saturate(${item.saturate}%)`;
    ctx.drawImage(item.currentCanvas, 0, 0);
    ctx.restore();
}

/** 우측 사이드바의 입력 컨트롤들을 선택된 이미지의 현재 상태로 맞춤 */
function syncSidebarWithSelectedItem(item) {
    const noPhotoMsg = document.getElementById('no-photo-selected-msg');
    const editControls = document.getElementById('photo-edit-controls');
    const badgeName = document.getElementById('badge-selected-photo-name');

    if (noPhotoMsg) noPhotoMsg.style.display = 'none';
    if (editControls) editControls.style.display = 'flex';
    if (badgeName) badgeName.textContent = item.name;

    // 슬라이더 값 동기화
    const rangeB = document.getElementById('range-side-brightness');
    const valB = document.getElementById('val-side-brightness');
    if (rangeB) {
        rangeB.value = item.brightness;
        if (valB) valB.textContent = `${item.brightness}%`;
    }

    const rangeC = document.getElementById('range-side-contrast');
    const valC = document.getElementById('val-side-contrast');
    if (rangeC) {
        rangeC.value = item.contrast;
        if (valC) valC.textContent = `${item.contrast}%`;
    }

    const rangeS = document.getElementById('range-side-saturate');
    const valS = document.getElementById('val-side-saturate');
    if (rangeS) {
        rangeS.value = item.saturate;
        if (valS) valS.textContent = `${item.saturate}%`;
    }
}

// ----------------------------------------------------------------------------
// 5. 우측 [선택 사진 실시간 편집] 도구 이벤트 바인딩
// ----------------------------------------------------------------------------
function bindPhotoEditSideControls() {
    // 1. 회전 및 반전 버튼
    const btnRotL = document.getElementById('btn-side-rot-left');
    const btnRotR = document.getElementById('btn-side-rot-right');
    const btnFlipH = document.getElementById('btn-side-flip-h');
    const btnFlipV = document.getElementById('btn-side-flip-v');

    if (btnRotL) btnRotL.addEventListener('click', () => rotateCurrentImage(-90));
    if (btnRotR) btnRotR.addEventListener('click', () => rotateCurrentImage(90));
    if (btnFlipH) btnFlipH.addEventListener('click', () => flipCurrentImage(true, false));
    if (btnFlipV) btnFlipV.addEventListener('click', () => flipCurrentImage(false, true));

    // 2. 색상 보정 슬라이더 실시간 바인딩
    const rangeB = document.getElementById('range-side-brightness');
    const valB = document.getElementById('val-side-brightness');
    if (rangeB) {
        rangeB.addEventListener('input', (e) => {
            const item = getSelectedImage();
            if (!item) return;
            item.brightness = parseInt(e.target.value, 10);
            if (valB) valB.textContent = `${item.brightness}%`;
            renderViewerCanvas(item);
        });
    }

    const rangeC = document.getElementById('range-side-contrast');
    const valC = document.getElementById('val-side-contrast');
    if (rangeC) {
        rangeC.addEventListener('input', (e) => {
            const item = getSelectedImage();
            if (!item) return;
            item.contrast = parseInt(e.target.value, 10);
            if (valC) valC.textContent = `${item.contrast}%`;
            renderViewerCanvas(item);
        });
    }

    const rangeS = document.getElementById('range-side-saturate');
    const valS = document.getElementById('val-side-saturate');
    if (rangeS) {
        rangeS.addEventListener('input', (e) => {
            const item = getSelectedImage();
            if (!item) return;
            item.saturate = parseInt(e.target.value, 10);
            if (valS) valS.textContent = `${item.saturate}%`;
            renderViewerCanvas(item);
        });
    }

    // 3. 자르기 비율 버튼 및 실행/취소
    const ratioBtns = document.querySelectorAll('.btn-crop-ratio');
    ratioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ratioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cropRatio = btn.getAttribute('data-ratio');
            enableCropMode();
        });
    });

    const btnApplyCrop = document.getElementById('btn-side-apply-crop');
    const btnCancelCrop = document.getElementById('btn-side-cancel-crop');
    if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCrop);
    if (btnCancelCrop) btnCancelCrop.addEventListener('click', disableCropMode);

    // 4. 모자이크 브러시 크기 슬라이더
    const rangeM = document.getElementById('range-side-mosaic-size');
    const valM = document.getElementById('val-side-mosaic-size');
    if (rangeM) {
        rangeM.addEventListener('input', (e) => {
            mosaicBlockSize = parseInt(e.target.value, 10);
            if (valM) valM.textContent = `${mosaicBlockSize}px`;
        });
    }

    // 5. 원본 사진으로 복구 버튼
    const btnReset = document.getElementById('btn-side-reset-photo');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const item = getSelectedImage();
            if (!item) return;
            if (confirm('이 사진의 모든 편집을 취소하고 원본으로 복구하시겠습니까?')) {
                resetImageToOriginal(item);
            }
        });
    }
}

/** 현재 선택된 이미지 객체 반환 */
function getSelectedImage() {
    return images.find(img => img.id === selectedId);
}

/**
 * 선택된 이미지 90도 회전
 */
function rotateCurrentImage(angle) {
    const item = getSelectedImage();
    if (!item) return;

    // 필터 효과가 적용된 상태를 새 캔버스에 영구 반영하여 회전
    const bakedCanvas = getBakedCanvas(item);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = bakedCanvas.height;
    newCanvas.height = bakedCanvas.width;
    const ctx = newCanvas.getContext('2d');

    ctx.translate(newCanvas.width / 2, newCanvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(bakedCanvas, -bakedCanvas.width / 2, -bakedCanvas.height / 2);

    item.currentCanvas = newCanvas;
    item.width = newCanvas.width;
    item.height = newCanvas.height;
    // 필터는 캔버스에 구워졌으므로 기본 100%로 리셋
    item.brightness = 100;
    item.contrast = 100;
    item.saturate = 100;

    syncSidebarWithSelectedItem(item);
    updateGalleryUI();
    renderViewerCanvas(item);
}

/**
 * 선택된 이미지 좌우/상하 반전
 */
function flipCurrentImage(h, v) {
    const item = getSelectedImage();
    if (!item) return;

    const bakedCanvas = getBakedCanvas(item);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = bakedCanvas.width;
    newCanvas.height = bakedCanvas.height;
    const ctx = newCanvas.getContext('2d');

    ctx.translate(h ? newCanvas.width : 0, v ? newCanvas.height : 0);
    ctx.scale(h ? -1 : 1, v ? -1 : 1);
    ctx.drawImage(bakedCanvas, 0, 0);

    item.currentCanvas = newCanvas;
    item.brightness = 100;
    item.contrast = 100;
    item.saturate = 100;

    syncSidebarWithSelectedItem(item);
    updateGalleryUI();
    renderViewerCanvas(item);
}

/**
 * 색상 필터가 포함된 상태를 단일 캔버스로 렌더링 (Bake)
 */
function getBakedCanvas(item) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = item.currentCanvas.width;
    tempCanvas.height = item.currentCanvas.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.filter = `brightness(${item.brightness}%) contrast(${item.contrast}%) saturate(${item.saturate}%)`;
    ctx.drawImage(item.currentCanvas, 0, 0);
    return tempCanvas;
}

/** 원본 이미지로 되돌리기 */
function resetImageToOriginal(item) {
    const canvas = document.createElement('canvas');
    canvas.width = item.originalImg.naturalWidth;
    canvas.height = item.originalImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(item.originalImg, 0, 0);

    item.currentCanvas = canvas;
    item.width = canvas.width;
    item.height = canvas.height;
    item.brightness = 100;
    item.contrast = 100;
    item.saturate = 100;

    syncSidebarWithSelectedItem(item);
    updateGalleryUI();
    renderViewerCanvas(item);
}

// ----------------------------------------------------------------------------
// 6. 하단 뷰어 이벤트 바인딩 (자르기 드래그 & 모자이크 브러시)
// ----------------------------------------------------------------------------
function bindViewerEvents() {
    const btnClose = document.getElementById('btn-viewer-close');
    if (btnClose) btnClose.addEventListener('click', closeViewer);

    const btnCrop = document.getElementById('btn-viewer-crop-mode');
    const btnMosaic = document.getElementById('btn-viewer-mosaic-mode');

    if (btnCrop) {
        btnCrop.addEventListener('click', () => {
            if (isCropMode) disableCropMode();
            else enableCropMode();
        });
    }

    if (btnMosaic) {
        btnMosaic.addEventListener('click', () => {
            if (isMosaicMode) disableMosaicMode();
            else enableMosaicMode();
        });
    }

    // 캔버스 영역 마우스 드래그 (자르기 박스 및 모자이크 드로잉)
    const canvasArea = document.getElementById('viewer-canvas-area');
    const mainCanvas = document.getElementById('viewer-main-canvas');
    const cropBox = document.getElementById('crop-overlay-box');

    if (canvasArea && mainCanvas) {
        mainCanvas.addEventListener('mousedown', (e) => {
            const item = getSelectedImage();
            if (!item) return;

            const rect = mainCanvas.getBoundingClientRect();
            const scaleX = mainCanvas.width / rect.width;
            const scaleY = mainCanvas.height / rect.height;
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;

            if (isMosaicMode) {
                isMosaicDrawing = true;
                applyMosaicAtPoint(item, clientX * scaleX, clientY * scaleY);
            } else if (isCropMode) {
                isCroppingDrag = true;
                cropDragStart = { x: clientX, y: clientY };
                cropRect = { x: clientX, y: clientY, w: 0, h: 0 };
                updateCropBoxOverlay(clientX, clientY, 0, 0);
            }
        });

        window.addEventListener('mousemove', (e) => {
            const item = getSelectedImage();
            if (!item || (!isMosaicDrawing && !isCroppingDrag)) return;

            const rect = mainCanvas.getBoundingClientRect();
            const scaleX = mainCanvas.width / rect.width;
            const scaleY = mainCanvas.height / rect.height;
            const clientX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const clientY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

            if (isMosaicDrawing && isMosaicMode) {
                applyMosaicAtPoint(item, clientX * scaleX, clientY * scaleY);
            } else if (isCroppingDrag && isCropMode) {
                let w = clientX - cropDragStart.x;
                let h = clientY - cropDragStart.y;
                let x = w < 0 ? clientX : cropDragStart.x;
                let y = h < 0 ? clientY : cropDragStart.y;
                w = Math.abs(w);
                h = Math.abs(h);

                // 비율 고정 계산
                if (cropRatio === '1:1') {
                    const minDim = Math.min(w, h);
                    w = minDim;
                    h = minDim;
                } else if (cropRatio === '4:3') {
                    h = w * (3 / 4);
                } else if (cropRatio === '16:9') {
                    h = w * (9 / 16);
                }

                cropRect = { x, y, w, h, scaleX, scaleY };
                updateCropBoxOverlay(x, y, w, h);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isMosaicDrawing) {
                isMosaicDrawing = false;
                updateGalleryUI();
            }
            if (isCroppingDrag) {
                isCroppingDrag = false;
            }
        });
    }
}

/** 자르기 오버레이 박스 위치 및 크기 업데이트 */
function updateCropBoxOverlay(x, y, w, h) {
    const cropBox = document.getElementById('crop-overlay-box');
    if (cropBox) {
        cropBox.style.display = w > 5 && h > 5 ? 'block' : 'none';
        cropBox.style.left = `${x}px`;
        cropBox.style.top = `${y}px`;
        cropBox.style.width = `${w}px`;
        cropBox.style.height = `${h}px`;
    }
}

/** 자르기 모드 활성화 */
function enableCropMode() {
    isCropMode = true;
    disableMosaicMode();

    const btnCrop = document.getElementById('btn-viewer-crop-mode');
    if (btnCrop) btnCrop.classList.add('active');

    const tip = document.getElementById('viewer-status-tip');
    if (tip) tip.textContent = '캔버스 위에서 자를 영역을 마우스로 드래그하세요. 완료 후 [자르기 적용]을 누르세요.';

    const cropBox = document.getElementById('crop-overlay-box');
    if (cropBox) cropBox.style.display = 'none';
}

/** 자르기 모드 해제 */
function disableCropMode() {
    isCropMode = false;
    const btnCrop = document.getElementById('btn-viewer-crop-mode');
    if (btnCrop) btnCrop.classList.remove('active');

    const cropBox = document.getElementById('crop-overlay-box');
    if (cropBox) cropBox.style.display = 'none';

    const tip = document.getElementById('viewer-status-tip');
    if (tip) tip.textContent = '오른쪽 패널에서 회전·반전·색상 보정·자르기를 실시간으로 조작할 수 있습니다.';
}

/** 자르기 실행 */
function applyCrop() {
    const item = getSelectedImage();
    const mainCanvas = document.getElementById('viewer-main-canvas');
    if (!item || !mainCanvas || !cropRect || cropRect.w <= 5 || cropRect.h <= 5) {
        alert('먼저 캔버스에서 자를 영역을 드래그하여 지정해주세요.');
        return;
    }

    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = item.currentCanvas.width / rect.width;
    const scaleY = item.currentCanvas.height / rect.height;

    const realX = Math.round(cropRect.x * scaleX);
    const realY = Math.round(cropRect.y * scaleY);
    const realW = Math.round(cropRect.w * scaleX);
    const realH = Math.round(cropRect.h * scaleY);

    const bakedCanvas = getBakedCanvas(item);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = realW;
    newCanvas.height = realH;
    const ctx = newCanvas.getContext('2d');

    ctx.drawImage(bakedCanvas, realX, realY, realW, realH, 0, 0, realW, realH);

    item.currentCanvas = newCanvas;
    item.width = realW;
    item.height = realH;
    item.brightness = 100;
    item.contrast = 100;
    item.saturate = 100;

    disableCropMode();
    syncSidebarWithSelectedItem(item);
    updateGalleryUI();
    renderViewerCanvas(item);
}

/** 모자이크 모드 활성화 */
function enableMosaicMode() {
    isMosaicMode = true;
    disableCropMode();

    const btnMosaic = document.getElementById('btn-viewer-mosaic-mode');
    if (btnMosaic) btnMosaic.classList.add('active');

    const mainCanvas = document.getElementById('viewer-main-canvas');
    if (mainCanvas) mainCanvas.style.cursor = 'crosshair';

    const tip = document.getElementById('viewer-status-tip');
    if (tip) tip.textContent = '모자이크 모드: 가리고 싶은 영역을 마우스로 클릭하거나 드래그하여 문지르세요.';
}

/** 모자이크 모드 해제 */
function disableMosaicMode() {
    isMosaicMode = false;
    const btnMosaic = document.getElementById('btn-viewer-mosaic-mode');
    if (btnMosaic) btnMosaic.classList.remove('active');

    const mainCanvas = document.getElementById('viewer-main-canvas');
    if (mainCanvas) mainCanvas.style.cursor = 'default';
}

/**
 * 특정 좌표 중심 반경에 모자이크 픽셀화 적용
 */
function applyMosaicAtPoint(item, targetX, targetY) {
    const canvas = item.currentCanvas;
    const ctx = canvas.getContext('2d');

    const radius = mosaicBlockSize * 2;
    const startX = Math.max(0, Math.floor(targetX - radius));
    const startY = Math.max(0, Math.floor(targetY - radius));
    const endX = Math.min(canvas.width, Math.ceil(targetX + radius));
    const endY = Math.min(canvas.height, Math.ceil(targetY + radius));
    const w = endX - startX;
    const h = endY - startY;

    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(startX, startY, w, h);
    const data = imgData.data;
    const blockSize = Math.max(4, Math.floor(mosaicBlockSize / 2));

    for (let y = 0; y < h; y += blockSize) {
        for (let x = 0; x < w; x += blockSize) {
            const pixelIndex = (y * w + x) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const a = data[pixelIndex + 3];

            for (let by = 0; by < blockSize && y + by < h; by++) {
                for (let bx = 0; bx < blockSize && x + bx < w; bx++) {
                    const idx = ((y + by) * w + (x + bx)) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                }
            }
        }
    }

    ctx.putImageData(imgData, startX, startY);
    renderViewerCanvas(item);
}

// ----------------------------------------------------------------------------
// 7. 우측 [전체 사진 일괄 설정] 패널 이벤트 바인딩
// ----------------------------------------------------------------------------
function bindBatchSettingsUI() {
    // 1. 세로 크기 맞춤
    const chkHeightFit = document.getElementById('chk-height-fit');
    const inputHeightFit = document.getElementById('input-height-fit');
    const heightSubtext = document.getElementById('height-fit-subtext');

    if (chkHeightFit) {
        chkHeightFit.addEventListener('change', (e) => {
            isHeightFit = e.target.checked;
            if (heightSubtext) {
                heightSubtext.textContent = isHeightFit ? `모든 사진 세로 ${targetHeightPx}px 자동 맞춤` : '크기 변경 없음 · 사진별 편집 크기 유지';
            }
        });
    }

    if (inputHeightFit) {
        inputHeightFit.addEventListener('input', (e) => {
            targetHeightPx = parseInt(e.target.value, 10) || 800;
            if (isHeightFit && heightSubtext) {
                heightSubtext.textContent = `모든 사진 세로 ${targetHeightPx}px 자동 맞춤`;
            }
        });
    }

    // 2. 전체 밝기 %
    const rangeBrightness = document.getElementById('range-global-brightness');
    if (rangeBrightness) {
        rangeBrightness.addEventListener('input', (e) => {
            globalBrightness = parseInt(e.target.value, 10);
        });
    }

    // 3. 테두리 두께 & 색상
    const inputBorderPx = document.getElementById('input-border-px');
    if (inputBorderPx) {
        inputBorderPx.addEventListener('input', (e) => {
            borderPx = parseInt(e.target.value, 10) || 0;
        });
    }

    const inputBorderColor = document.getElementById('input-border-color');
    if (inputBorderColor) {
        inputBorderColor.addEventListener('input', (e) => {
            borderColor = e.target.value;
        });
    }

    // 4. 워터마크 설정
    const chkWatermark = document.getElementById('chk-watermark');
    const selectWmType = document.getElementById('select-wm-type');
    const wmFileInput = document.getElementById('wm-file-input');
    const wmFileLabel = document.getElementById('wm-file-name-label');
    const inputWmWidth = document.getElementById('input-wm-width');
    const btnDeleteLogo = document.getElementById('btn-delete-logo');
    const selectWmPos = document.getElementById('select-wm-position');
    const inputWmOpacity = document.getElementById('input-wm-opacity');
    const inputWmMargin = document.getElementById('input-wm-margin');

    if (chkWatermark) {
        chkWatermark.addEventListener('change', (e) => {
            useWatermark = e.target.checked;
        });
    }

    if (selectWmType) {
        selectWmType.addEventListener('change', (e) => {
            watermarkType = e.target.value;
        });
    }

    if (wmFileInput) {
        wmFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                watermarkImg = await loadImage(dataUrl);
                if (wmFileLabel) wmFileLabel.textContent = file.name;
            }
        });
    }

    if (btnDeleteLogo) {
        btnDeleteLogo.addEventListener('click', () => {
            watermarkImg = null;
            if (wmFileInput) wmFileInput.value = '';
            if (wmFileLabel) wmFileLabel.textContent = '선택된 파일 없음';
        });
    }

    if (inputWmWidth) {
        inputWmWidth.addEventListener('input', (e) => {
            watermarkWidth = parseInt(e.target.value, 10) || 300;
        });
    }

    if (selectWmPos) {
        selectWmPos.addEventListener('change', (e) => {
            watermarkPosition = e.target.value;
            syncPositionGridButtons();
        });
    }

    // 9방향 워터마크 버튼 그리드
    const wmPosBtns = document.querySelectorAll('.wm-pos-btn');
    wmPosBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            wmPosBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            watermarkPosition = btn.getAttribute('data-pos');
            if (selectWmPos) selectWmPos.value = watermarkPosition;
        });
    });

    function syncPositionGridButtons() {
        wmPosBtns.forEach(btn => {
            if (btn.getAttribute('data-pos') === watermarkPosition) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    if (inputWmOpacity) {
        inputWmOpacity.addEventListener('input', (e) => {
            watermarkOpacity = parseInt(e.target.value, 10) || 70;
        });
    }

    if (inputWmMargin) {
        inputWmMargin.addEventListener('input', (e) => {
            watermarkMargin = parseInt(e.target.value, 10) || 30;
        });
    }

    // 5. 저장 형식 & JPG 품질
    const selectSaveFormat = document.getElementById('select-save-format');
    if (selectSaveFormat) {
        selectSaveFormat.addEventListener('change', (e) => {
            exportFormat = e.target.value;
        });
    }

    const rangeJpgQuality = document.getElementById('range-jpg-quality');
    const valJpgQuality = document.getElementById('val-jpg-quality');
    if (rangeJpgQuality) {
        rangeJpgQuality.addEventListener('input', (e) => {
            jpgQuality = parseInt(e.target.value, 10);
            if (valJpgQuality) valJpgQuality.textContent = `${jpgQuality}%`;
        });
    }

    // 6. [이미지 저장] 대형 버튼
    const btnSaveImages = document.getElementById('btn-save-images');
    if (btnSaveImages) {
        btnSaveImages.addEventListener('click', exportImages);
    }
}

/**
 * 9방향 워터마크 좌표 계산 함수
 */
function calculateWatermarkCoordinates(imgW, imgH, wmW, wmH, margin, posKey) {
    let x = margin;
    let y = margin;

    switch (posKey) {
        case 'top-left':
            x = margin;
            y = margin;
            break;
        case 'top-center':
            x = (imgW - wmW) / 2;
            y = margin;
            break;
        case 'top-right':
            x = imgW - wmW - margin;
            y = margin;
            break;
        case 'center-left':
            x = margin;
            y = (imgH - wmH) / 2;
            break;
        case 'center':
            x = (imgW - wmW) / 2;
            y = (imgH - wmH) / 2;
            break;
        case 'center-right':
            x = imgW - wmW - margin;
            y = (imgH - wmH) / 2;
            break;
        case 'bottom-left':
            x = margin;
            y = imgH - wmH - margin;
            break;
        case 'bottom-center':
            x = (imgW - wmW) / 2;
            y = imgH - wmH - margin;
            break;
        case 'bottom-right':
        default:
            x = imgW - wmW - margin;
            y = imgH - wmH - margin;
            break;
    }

    return { x: Math.max(0, x), y: Math.max(0, y) };
}

/**
 * 최종 이미지 일괄 처리 및 내보내기 (세로 맞춤, 테두리, 워터마크, EXIF 제거)
 */
async function exportImages() {
    if (images.length === 0) {
        alert('저장할 이미지를 먼저 등록해주세요.');
        return;
    }

    const btnSave = document.getElementById('btn-save-images');
    const origHTML = btnSave ? btnSave.innerHTML : '';
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>이미지 처리 중...</span>`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        const mimeType = `image/${exportFormat}`;
        const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
        const quality = jpgQuality / 100;

        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            const bakedCanvas = getBakedCanvas(item);

            // 1. 세로 크기 맞춤 리사이징 계산
            let finalW = bakedCanvas.width;
            let finalH = bakedCanvas.height;

            if (isHeightFit && targetHeightPx > 10) {
                const ratio = targetHeightPx / bakedCanvas.height;
                finalH = targetHeightPx;
                finalW = Math.round(bakedCanvas.width * ratio);
            }

            // 최대 4096px 안전 제한
            if (finalW > 4096 || finalH > 4096) {
                const scale = Math.min(4096 / finalW, 4096 / finalH);
                finalW = Math.round(finalW * scale);
                finalH = Math.round(finalH * scale);
            }

            const totalW = finalW + borderPx * 2;
            const totalH = finalH + borderPx * 2;

            const outCanvas = document.createElement('canvas');
            outCanvas.width = totalW;
            outCanvas.height = totalH;
            const ctx = outCanvas.getContext('2d');

            // JPG 형식일 때 흰색 배경 채우기
            if (exportFormat === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalW, totalH);
            }

            // 테두리 드로잉
            if (borderPx > 0) {
                ctx.fillStyle = borderColor;
                ctx.fillRect(0, 0, totalW, totalH);
            }

            // 전체 밝기 필터 적용하여 이미지 합성
            ctx.save();
            if (globalBrightness !== 100) {
                ctx.filter = `brightness(${globalBrightness}%)`;
            }
            ctx.drawImage(bakedCanvas, borderPx, borderPx, finalW, finalH);
            ctx.restore();

            // 2. 워터마크 로고 합성
            if (useWatermark && watermarkImg) {
                const wRatio = watermarkImg.naturalHeight / watermarkImg.naturalWidth;
                const actualWmW = Math.min(watermarkWidth, finalW * 0.8);
                const actualWmH = actualWmW * wRatio;

                const pos = calculateWatermarkCoordinates(
                    totalW,
                    totalH,
                    actualWmW,
                    actualWmH,
                    watermarkMargin,
                    watermarkPosition
                );

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, watermarkOpacity / 100));
                ctx.drawImage(watermarkImg, pos.x, pos.y, actualWmW, actualWmH);
                ctx.restore();
            }

            // 3. Blob 생성 및 순차 다운로드 (EXIF 메타데이터 100% 제거)
            const blob = await canvasToBlob(outCanvas, mimeType, quality);
            const cleanName = item.name.replace(/\.[^/.]+$/, '');
            const padNum = String(i + 1).padStart(2, '0');
            const filename = `${cleanName}_${padNum}.${ext}`;

            downloadBlob(blob, filename);

            if (i < images.length - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

    } catch (err) {
        console.error('저장 오류:', err);
        alert('저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = origHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// ----------------------------------------------------------------------------
// 8. 대화면 정밀 모달 편집기 (더블클릭 시)
// ----------------------------------------------------------------------------
function bindModalEditor() {
    const modal = document.getElementById('editor-modal');
    const btnClose = document.getElementById('btn-modal-close');
    const btnCancel = document.getElementById('btn-modal-cancel');
    const btnSaveModal = document.getElementById('btn-modal-save');
    modalCanvas = document.getElementById('editor-canvas');

    if (btnClose) btnClose.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    if (btnCancel) btnCancel.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });

    if (btnSaveModal) {
        btnSaveModal.addEventListener('click', () => {
            if (modalTargetItem && modalCanvas) {
                const newCanvas = document.createElement('canvas');
                newCanvas.width = modalCanvas.width;
                newCanvas.height = modalCanvas.height;
                const ctx = newCanvas.getContext('2d');
                ctx.drawImage(modalCanvas, 0, 0);

                modalTargetItem.currentCanvas = newCanvas;
                modalTargetItem.width = newCanvas.width;
                modalTargetItem.height = newCanvas.height;
                updateGalleryUI();
                if (selectedId === modalTargetItem.id) {
                    renderViewerCanvas(modalTargetItem);
                }
            }
            if (modal) modal.style.display = 'none';
        });
    }

    const mRotL = document.getElementById('btn-rotate-left');
    const mRotR = document.getElementById('btn-rotate-right');
    const mFlipH = document.getElementById('btn-flip-horizontal');
    const mFlipV = document.getElementById('btn-flip-vertical');

    if (mRotL && modalCanvas) mRotL.addEventListener('click', () => rotateModalCanvas(-90));
    if (mRotR && modalCanvas) mRotR.addEventListener('click', () => rotateModalCanvas(90));
    if (mFlipH && modalCanvas) mFlipH.addEventListener('click', () => flipModalCanvas(true, false));
    if (mFlipV && modalCanvas) mFlipV.addEventListener('click', () => flipModalCanvas(false, true));
}

function openModalEditor(item) {
    modalTargetItem = item;
    const modal = document.getElementById('editor-modal');
    const titleEl = document.getElementById('modal-image-title');
    const dimEl = document.getElementById('modal-dim-info');

    if (modal && modalCanvas) {
        if (titleEl) titleEl.textContent = item.name;
        if (dimEl) dimEl.textContent = `원본 해상도: ${item.width} × ${item.height} px`;

        modalCanvas.width = item.currentCanvas.width;
        modalCanvas.height = item.currentCanvas.height;
        modalCtx = modalCanvas.getContext('2d');
        modalCtx.drawImage(item.currentCanvas, 0, 0);

        modal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
    }
}

function rotateModalCanvas(angle) {
    if (!modalCanvas || !modalCtx) return;
    const temp = document.createElement('canvas');
    temp.width = modalCanvas.width;
    temp.height = modalCanvas.height;
    temp.getContext('2d').drawImage(modalCanvas, 0, 0);

    modalCanvas.width = temp.height;
    modalCanvas.height = temp.width;
    modalCtx.translate(modalCanvas.width / 2, modalCanvas.height / 2);
    modalCtx.rotate((angle * Math.PI) / 180);
    modalCtx.drawImage(temp, -temp.width / 2, -temp.height / 2);
}

function flipModalCanvas(h, v) {
    if (!modalCanvas || !modalCtx) return;
    const temp = document.createElement('canvas');
    temp.width = modalCanvas.width;
    temp.height = modalCanvas.height;
    temp.getContext('2d').drawImage(modalCanvas, 0, 0);

    modalCtx.save();
    modalCtx.translate(h ? modalCanvas.width : 0, v ? modalCanvas.height : 0);
    modalCtx.scale(h ? -1 : 1, v ? -1 : 1);
    modalCtx.drawImage(temp, 0, 0);
    modalCtx.restore();
}

// 초기화 실행
init();

/**
 * ============================================================================
 * assets/js/tool-image-edit.js - [이미지 편집] 전용 독립 ES 모듈
 * ============================================================================
 * [스크린샷 1, 2, 3, 4번 100% 완벽 대응]
 * 1. 상단 카드 갤러리: 썸네일, 순번/파일명, 원본→출력 해상도 표시, [편집], [삭제]
 * 2. 사진 클릭 시: 아래쪽에 대형 화면으로 나타나며, 우측 설정이 실시간 반영됨
 * 3. 더블클릭 또는 [편집] 클릭 시: 대화면 [사진 정밀 편집] 모달창 오픈 (10대 도구, 우측 탭, 하단 액션)
 * 4. 우측 이미지 설정: 세로 크기 맞춤 800px, 밝기, 테두리, 워터마크(이미지/텍스트 9방향 자동 활성화), EXIF 제거 저장
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 상태 변수 정의
// ----------------------------------------------------------------------------

/** 등록된 이미지 목록 */
let images = [];

/** 현재 선택된 이미지 ID */
let selectedId = null;

// [우측 전체 이미지 설정 상태]
let isHeightFit = false;          // 세로 크기 맞춤 여부
let targetHeightPx = 800;         // 맞춤 세로 픽셀 (기본 800px)
let globalBrightness = 100;       // 전체 밝기 % (50 ~ 150)
let borderPx = 0;                 // 테두리 두께 (px)
let borderColor = '#000000';      // 테두리 색상

// [워터마크 설정 상태]
let useWatermark = false;         // 워터마크 적용 여부
let watermarkType = 'image';      // 'image' | 'text'
let watermarkImg = null;          // 로드된 워터마크 이미지 객체
let watermarkText = '방장 용용이'; // 텍스트 워터마크 문구
let watermarkTextColor = '#ffffff'; // 텍스트 워터마크 색상
let watermarkWidth = 300;         // 로고 너비 (px)
let watermarkPosition = 'bottom-right'; // 9방향 위치
let watermarkOpacity = 70;        // 농도 % (0 ~ 100)
let watermarkMargin = 30;         // 여백 px (0 ~ 500)

// [내보내기 설정 상태]
let exportFormat = 'jpeg';        // 'jpeg' | 'png' | 'webp'
let jpgQuality = 90;              // JPG 품질 % (30 ~ 100)

// ----------------------------------------------------------------------------
// [사진 정밀 편집 모달 상태] (더블클릭 / [편집] 시)
// ----------------------------------------------------------------------------
let modalTargetItem = null;
let modalCanvas = null;
let modalCtx = null;
let activeModalTool = 'select';   // 'select' | 'crop' | 'mosaic' | 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'circle' | 'text'
let modalHistory = [];            // Undo / Redo 스택
let modalHistoryIndex = -1;

// 드로잉 / 자르기 상태
let isModalDrawing = false;
let modalDrawStart = { x: 0, y: 0 };
let modalCropRect = { x: 0, y: 0, w: 0, h: 0 };
let modalCropRatio = 'free';

// 객체 서식
let objectColor = '#8b5cf6';
let objectLineWidth = 4;
let objectFontSize = 24;

// ----------------------------------------------------------------------------
// 2. 초기화 (DOM 로드 후 이벤트 바인딩)
// ----------------------------------------------------------------------------
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindSidebarSettings();
    bindModalEditor();
}

// ----------------------------------------------------------------------------
// 3. 붙여넣기(Ctrl+V) & 파일 추가 & 드래그앤드롭
// ----------------------------------------------------------------------------
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
                    await addImageFromFile(file, `캡처_${Date.now()}`);
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
                closeBottomPreview();
            }
        });
    }
}

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

/** 이미지 파일 등록 */
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
            height: img.naturalHeight
        };

        images.push(newImageItem);
        updateGalleryUI();

        // 등록 시 자동으로 첫 번째 이미지 또는 방금 추가된 이미지 선택
        selectImage(id);
    } catch (err) {
        console.error('이미지 로드 오류:', err);
    }
}

// ----------------------------------------------------------------------------
// 4. 상단 갤러리 카드 렌더링 & 하단 대형 뷰어 연동 (스크린샷 4번)
// ----------------------------------------------------------------------------

/** 세로 크기 맞춤에 따른 최종 출력 해상도 계산 문자열 반환 */
function getResolutionString(item) {
    const origW = item.width;
    const origH = item.height;

    if (!isHeightFit || targetHeightPx <= 10) {
        return `${origW} × ${origH} → ${origW} × ${origH}px`;
    }

    const ratio = targetHeightPx / origH;
    let finalH = targetHeightPx;
    let finalW = Math.round(origW * ratio);

    if (finalW > 4096 || finalH > 4096) {
        const scale = Math.min(4096 / finalW, 4096 / finalH);
        finalW = Math.round(finalW * scale);
        finalH = Math.round(finalH * scale);
    }

    return `${origW} × ${origH} → ${finalW} × ${finalH}px`;
}

/** 갤러리 카드 UI 업데이트 (스크린샷 4번 형태) */
function updateGalleryUI() {
    const emptyState = document.getElementById('empty-state');
    const imageGrid = document.getElementById('image-grid');
    const badge = document.getElementById('image-count-badge');

    if (badge) badge.textContent = `${images.length} / 30장 · 한 장 25MB 이하`;

    if (images.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (imageGrid) imageGrid.style.display = 'none';
        closeBottomPreview();
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
                    <img class="image-thumb" src="${item.currentCanvas.toDataURL('image/jpeg', 0.8)}" alt="${item.name}">
                </div>
                <div class="card-body">
                    <div class="card-title" title="${item.name}">${index + 1}. ${item.name}</div>
                    <div class="card-resolution" id="res-${item.id}">${getResolutionString(item)}</div>
                    <div class="card-btn-row">
                        <button class="btn-card-action btn-edit" title="정밀 편집">편집</button>
                        <button class="btn-card-action btn-del" title="삭제">삭제</button>
                    </div>
                </div>
            `;

            // 단일 클릭: 선택 및 아래쪽 대형 뷰어 노출
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-card-action')) return;
                selectImage(item.id);
            });

            // 더블 클릭: 대화면 [사진 정밀 편집] 모달창 열기
            card.addEventListener('dblclick', (e) => {
                if (e.target.closest('.btn-card-action')) return;
                openModalEditor(item);
            });

            // [편집] 버튼 클릭: 모달창 열기
            const btnEdit = card.querySelector('.btn-edit');
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                selectImage(item.id);
                openModalEditor(item);
            });

            // [삭제] 버튼 클릭
            const btnDel = card.querySelector('.btn-del');
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                images = images.filter(img => img.id !== item.id);
                if (selectedId === item.id) {
                    selectedId = images.length > 0 ? images[0].id : null;
                    if (selectedId) selectImage(selectedId);
                    else closeBottomPreview();
                }
                updateGalleryUI();
            });

            imageGrid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }
}

/** 사진 선택 및 아래쪽 대형 뷰어 활성화 */
function selectImage(id) {
    selectedId = id;
    const item = images.find(img => img.id === id);
    if (!item) return;

    // 카드 선택 스타일 갱신
    document.querySelectorAll('.image-card').forEach(card => {
        if (card.getAttribute('data-id') === id) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    const previewContainer = document.getElementById('bottom-preview-container');
    if (previewContainer) {
        previewContainer.style.display = 'flex';
        renderBottomPreviewCanvas(item);
    }
}

function closeBottomPreview() {
    selectedId = null;
    const previewContainer = document.getElementById('bottom-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
}

/**
 * 아래쪽 대형 뷰어 캔버스 실시간 렌더링
 * (우측의 세로 맞춤, 밝기, 테두리, 워터마크가 실시간으로 합성되어 표시됨)
 */
function renderBottomPreviewCanvas(item) {
    const canvas = document.getElementById('bottom-preview-canvas');
    if (!canvas || !item) return;

    const srcCanvas = item.currentCanvas;

    // 1. 세로 맞춤 크기 계산
    let finalW = srcCanvas.width;
    let finalH = srcCanvas.height;

    if (isHeightFit && targetHeightPx > 10) {
        const ratio = targetHeightPx / srcCanvas.height;
        finalH = targetHeightPx;
        finalW = Math.round(srcCanvas.width * ratio);
    }

    if (finalW > 4096 || finalH > 4096) {
        const scale = Math.min(4096 / finalW, 4096 / finalH);
        finalW = Math.round(finalW * scale);
        finalH = Math.round(finalH * scale);
    }

    const totalW = finalW + borderPx * 2;
    const totalH = finalH + borderPx * 2;

    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // 테두리 드로잉
    if (borderPx > 0) {
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, totalW, totalH);
    }

    // 밝기 필터 적용하여 드로잉
    ctx.save();
    if (globalBrightness !== 100) {
        ctx.filter = `brightness(${globalBrightness}%)`;
    }
    ctx.drawImage(srcCanvas, borderPx, borderPx, finalW, finalH);
    ctx.restore();

    // 2. 워터마크 실시간 합성 (이미지 또는 텍스트)
    if (useWatermark) {
        if (watermarkType === 'image' && watermarkImg) {
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
        } else if (watermarkType === 'text' && watermarkText.trim() !== '') {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, watermarkOpacity / 100));
            const fontSize = Math.max(14, Math.round(watermarkWidth / 8));
            ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;
            ctx.fillStyle = watermarkTextColor;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            const textMetrics = ctx.measureText(watermarkText);
            const textW = textMetrics.width;
            const textH = fontSize;

            const pos = calculateWatermarkCoordinates(
                totalW,
                totalH,
                textW,
                textH,
                watermarkMargin,
                watermarkPosition
            );

            ctx.fillText(watermarkText, pos.x, pos.y + textH * 0.85);
            ctx.restore();
        }
    }
}

/** 모든 카드의 해상도 텍스트 실시간 갱신 */
function updateAllCardResolutions() {
    images.forEach(item => {
        const resEl = document.getElementById(`res-${item.id}`);
        if (resEl) resEl.textContent = getResolutionString(item);
    });

    if (selectedId) {
        const item = images.find(img => img.id === selectedId);
        if (item) renderBottomPreviewCanvas(item);
    }
}

// ----------------------------------------------------------------------------
// 5. 우측 [이미지 설정] 사이드바 이벤트 바인딩 (스크린샷 1, 2번)
// ----------------------------------------------------------------------------
function bindSidebarSettings() {
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
            updateAllCardResolutions();
        });
    }

    if (inputHeightFit) {
        inputHeightFit.addEventListener('input', (e) => {
            targetHeightPx = parseInt(e.target.value, 10) || 800;
            if (isHeightFit && heightSubtext) {
                heightSubtext.textContent = `모든 사진 세로 ${targetHeightPx}px 자동 맞춤`;
            }
            updateAllCardResolutions();
        });
    }

    // 2. 밝기 · %
    const rangeBrightness = document.getElementById('range-global-brightness');
    if (rangeBrightness) {
        rangeBrightness.addEventListener('input', (e) => {
            globalBrightness = parseInt(e.target.value, 10);
            if (selectedId) {
                const item = images.find(img => img.id === selectedId);
                if (item) renderBottomPreviewCanvas(item);
            }
        });
    }

    // 3. 테두리 · px & 색상
    const inputBorderPx = document.getElementById('input-border-px');
    if (inputBorderPx) {
        inputBorderPx.addEventListener('input', (e) => {
            borderPx = parseInt(e.target.value, 10) || 0;
            if (selectedId) {
                const item = images.find(img => img.id === selectedId);
                if (item) renderBottomPreviewCanvas(item);
            }
        });
    }

    const inputBorderColor = document.getElementById('input-border-color');
    if (inputBorderColor) {
        inputBorderColor.addEventListener('input', (e) => {
            borderColor = e.target.value;
            if (selectedId) {
                const item = images.find(img => img.id === selectedId);
                if (item) renderBottomPreviewCanvas(item);
            }
        });
    }

    // 4. 워터마크
    const chkWatermark = document.getElementById('chk-watermark');
    const selectWmType = document.getElementById('select-wm-type');
    const wmImageGroup = document.getElementById('wm-image-file-group');
    const wmTextGroup = document.getElementById('wm-text-group');
    const wmSizeLabel = document.getElementById('wm-size-label');
    const wmDelBtnGroup = document.getElementById('wm-delete-btn-group');

    const wmFileInput = document.getElementById('wm-file-input');
    const wmFileLabel = document.getElementById('wm-file-name-label');
    const inputWmText = document.getElementById('input-wm-text');
    const inputWmTextColor = document.getElementById('input-wm-text-color');
    const inputWmWidth = document.getElementById('input-wm-width');
    const btnDeleteLogo = document.getElementById('btn-delete-logo');
    const selectWmPos = document.getElementById('select-wm-position');
    const inputWmOpacity = document.getElementById('input-wm-opacity');
    const inputWmMargin = document.getElementById('input-wm-margin');

    // 워터마크 체크박스 수동 토글
    if (chkWatermark) {
        chkWatermark.addEventListener('change', (e) => {
            useWatermark = e.target.checked;
            triggerPreviewUpdate();
        });
    }

    // 워터마크 종류 변경 (이미지 파일 vs 텍스트)
    if (selectWmType) {
        selectWmType.addEventListener('change', (e) => {
            watermarkType = e.target.value;
            if (watermarkType === 'text') {
                if (wmImageGroup) wmImageGroup.style.display = 'none';
                if (wmDelBtnGroup) wmDelBtnGroup.style.display = 'none';
                if (wmTextGroup) wmTextGroup.style.display = 'block';
                if (wmSizeLabel) wmSizeLabel.textContent = '글자 크기 기준 너비 · px';
                // 텍스트 선택 시 자동으로 워터마크 체크 활성화
                useWatermark = true;
                if (chkWatermark) chkWatermark.checked = true;
            } else {
                if (wmImageGroup) wmImageGroup.style.display = 'block';
                if (wmDelBtnGroup) wmDelBtnGroup.style.display = 'block';
                if (wmTextGroup) wmTextGroup.style.display = 'none';
                if (wmSizeLabel) wmSizeLabel.textContent = '로고 너비 · 출력 px';
                if (watermarkImg) {
                    useWatermark = true;
                    if (chkWatermark) chkWatermark.checked = true;
                }
            }
            triggerPreviewUpdate();
        });
    }

    // 워터마크 이미지 파일 선택
    if (wmFileInput) {
        wmFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                watermarkImg = await loadImage(dataUrl);
                if (wmFileLabel) wmFileLabel.textContent = file.name;
                
                // 파일 선택 시 자동으로 워터마크 적용 활성화
                useWatermark = true;
                if (chkWatermark) chkWatermark.checked = true;
                
                triggerPreviewUpdate();
            }
        });
    }

    // 텍스트 워터마크 입력
    if (inputWmText) {
        inputWmText.addEventListener('input', (e) => {
            watermarkText = e.target.value;
            useWatermark = true;
            if (chkWatermark) chkWatermark.checked = true;
            triggerPreviewUpdate();
        });
    }

    if (inputWmTextColor) {
        inputWmTextColor.addEventListener('input', (e) => {
            watermarkTextColor = e.target.value;
            triggerPreviewUpdate();
        });
    }

    if (btnDeleteLogo) {
        btnDeleteLogo.addEventListener('click', () => {
            watermarkImg = null;
            if (wmFileInput) wmFileInput.value = '';
            if (wmFileLabel) wmFileLabel.textContent = '선택된 파일 없음';
            triggerPreviewUpdate();
        });
    }

    if (inputWmWidth) {
        inputWmWidth.addEventListener('input', (e) => {
            watermarkWidth = parseInt(e.target.value, 10) || 300;
            triggerPreviewUpdate();
        });
    }

    if (selectWmPos) {
        selectWmPos.addEventListener('change', (e) => {
            watermarkPosition = e.target.value;
            syncPositionGridButtons();
            triggerPreviewUpdate();
        });
    }

    // 9방향 워터마크 위치 버튼
    const wmPosBtns = document.querySelectorAll('.wm-pos-btn');
    wmPosBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            wmPosBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            watermarkPosition = btn.getAttribute('data-pos');
            if (selectWmPos) selectWmPos.value = watermarkPosition;
            triggerPreviewUpdate();
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
            triggerPreviewUpdate();
        });
    }

    if (inputWmMargin) {
        inputWmMargin.addEventListener('input', (e) => {
            watermarkMargin = parseInt(e.target.value, 10) || 30;
            triggerPreviewUpdate();
        });
    }

    function triggerPreviewUpdate() {
        if (selectedId) {
            const item = images.find(img => img.id === selectedId);
            if (item) renderBottomPreviewCanvas(item);
        }
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

    // 6. [이미지 저장] 버튼
    const btnSaveImages = document.getElementById('btn-save-images');
    if (btnSaveImages) {
        btnSaveImages.addEventListener('click', exportImages);
    }
}

/** 9방향 워터마크 좌표 계산 */
function calculateWatermarkCoordinates(imgW, imgH, wmW, wmH, margin, posKey) {
    let x = margin;
    let y = margin;

    switch (posKey) {
        case 'top-left': x = margin; y = margin; break;
        case 'top-center': x = (imgW - wmW) / 2; y = margin; break;
        case 'top-right': x = imgW - wmW - margin; y = margin; break;
        case 'center-left': x = margin; y = (imgH - wmH) / 2; break;
        case 'center': x = (imgW - wmW) / 2; y = (imgH - wmH) / 2; break;
        case 'center-right': x = imgW - wmW - margin; y = (imgH - wmH) / 2; break;
        case 'bottom-left': x = margin; y = imgH - wmH - margin; break;
        case 'bottom-center': x = (imgW - wmW) / 2; y = imgH - wmH - margin; break;
        case 'bottom-right':
        default: x = imgW - wmW - margin; y = imgH - wmH - margin; break;
    }

    return { x: Math.max(0, x), y: Math.max(0, y) };
}

/** 일괄 이미지 다운로드 (EXIF 메타데이터 제거) */
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
            const srcCanvas = item.currentCanvas;

            let finalW = srcCanvas.width;
            let finalH = srcCanvas.height;

            if (isHeightFit && targetHeightPx > 10) {
                const ratio = targetHeightPx / srcCanvas.height;
                finalH = targetHeightPx;
                finalW = Math.round(srcCanvas.width * ratio);
            }

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

            if (exportFormat === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalW, totalH);
            }

            if (borderPx > 0) {
                ctx.fillStyle = borderColor;
                ctx.fillRect(0, 0, totalW, totalH);
            }

            ctx.save();
            if (globalBrightness !== 100) {
                ctx.filter = `brightness(${globalBrightness}%)`;
            }
            ctx.drawImage(srcCanvas, borderPx, borderPx, finalW, finalH);
            ctx.restore();

            // 워터마크 합성
            if (useWatermark) {
                if (watermarkType === 'image' && watermarkImg) {
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
                } else if (watermarkType === 'text' && watermarkText.trim() !== '') {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, Math.min(1, watermarkOpacity / 100));
                    const fontSize = Math.max(14, Math.round(watermarkWidth / 8));
                    ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;
                    ctx.fillStyle = watermarkTextColor;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 1;
                    ctx.shadowOffsetY = 1;

                    const textMetrics = ctx.measureText(watermarkText);
                    const textW = textMetrics.width;
                    const textH = fontSize;

                    const pos = calculateWatermarkCoordinates(
                        totalW,
                        totalH,
                        textW,
                        textH,
                        watermarkMargin,
                        watermarkPosition
                    );

                    ctx.fillText(watermarkText, pos.x, pos.y + textH * 0.85);
                    ctx.restore();
                }
            }

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
// 6. 더블클릭 시 열리는 [사진 정밀 편집] 팝업 모달창 (스크린샷 3번 100% 일치)
// ----------------------------------------------------------------------------
function bindModalEditor() {
    const modal = document.getElementById('editor-modal');
    const btnClose = document.getElementById('btn-modal-close');
    const btnCancel = document.getElementById('btn-modal-cancel');
    const btnApply = document.getElementById('btn-modal-apply');
    const btnReset = document.getElementById('btn-modal-reset');
    const btnUndo = document.getElementById('btn-modal-undo');
    const btnRedo = document.getElementById('btn-modal-redo');
    modalCanvas = document.getElementById('editor-canvas');

    if (btnClose) btnClose.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    if (btnCancel) btnCancel.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });

    // [적용] 클릭 시 편집된 내용을 사진 객체에 최종 반영
    if (btnApply) {
        btnApply.addEventListener('click', () => {
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
                    renderBottomPreviewCanvas(modalTargetItem);
                }
            }
            if (modal) modal.style.display = 'none';
        });
    }

    // [원본 복원]
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (modalTargetItem && confirm('모든 편집을 취소하고 원본 이미지로 복원하시겠습니까?')) {
                const origImg = modalTargetItem.originalImg;
                modalCanvas.width = origImg.naturalWidth;
                modalCanvas.height = origImg.naturalHeight;
                modalCtx.drawImage(origImg, 0, 0);
                saveModalHistory();
                syncModalDimInputs();
                hideModalCropBox();
            }
        });
    }

    // 실행 취소 & 다시 실행
    if (btnUndo) btnUndo.addEventListener('click', undoModalHistory);
    if (btnRedo) btnRedo.addEventListener('click', redoModalHistory);

    // 10대 도구 툴바 버튼 클릭
    const toolBtns = document.querySelectorAll('.modal-tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeModalTool = btn.getAttribute('data-tool');

            if (activeModalTool === 'crop') {
                showModalCropBox();
            } else {
                hideModalCropBox();
            }
        });
    });

    // 우측 탭 전환 (객체 서식 / 사진 전체)
    const tabBtnObj = document.getElementById('tab-btn-object');
    const tabBtnPhoto = document.getElementById('tab-btn-photo');
    const tabContentObj = document.getElementById('tab-content-object');
    const tabContentPhoto = document.getElementById('tab-content-photo');

    if (tabBtnObj && tabBtnPhoto) {
        tabBtnObj.addEventListener('click', () => {
            tabBtnObj.classList.add('active');
            tabBtnPhoto.classList.remove('active');
            if (tabContentObj) tabContentObj.style.display = 'flex';
            if (tabContentPhoto) tabContentPhoto.style.display = 'none';
        });

        tabBtnPhoto.addEventListener('click', () => {
            tabBtnPhoto.classList.add('active');
            tabBtnObj.classList.remove('active');
            if (tabContentPhoto) tabContentPhoto.style.display = 'flex';
            if (tabContentObj) tabContentObj.style.display = 'none';
        });
    }

    // [사진 전체] 탭 컨트롤들
    const mRotL = document.getElementById('btn-modal-rot-l');
    const mRotR = document.getElementById('btn-modal-rot-r');
    const mFlipH = document.getElementById('btn-modal-flip-h');
    const mFlipV = document.getElementById('btn-modal-flip-v');

    if (mRotL) mRotL.addEventListener('click', () => rotateModalCanvas(-90));
    if (mRotR) mRotR.addEventListener('click', () => rotateModalCanvas(90));
    if (mFlipH) mFlipH.addEventListener('click', () => flipModalCanvas(true, false));
    if (mFlipV) mFlipV.addEventListener('click', () => flipModalCanvas(false, true));

    // 미세 각도 적용
    const btnAngle = document.getElementById('btn-modal-apply-angle');
    const inputAngle = document.getElementById('input-modal-angle');
    if (btnAngle && inputAngle) {
        btnAngle.addEventListener('click', () => {
            const deg = parseFloat(inputAngle.value) || 0;
            if (deg !== 0) rotateModalCanvas(deg);
        });
    }

    // 이미지 크기 변경
    const btnSize = document.getElementById('btn-modal-apply-size');
    const inputW = document.getElementById('input-modal-w');
    const inputH = document.getElementById('input-modal-h');
    const chkKeepRatio = document.getElementById('chk-modal-keep-ratio');

    if (inputW && inputH && chkKeepRatio) {
        inputW.addEventListener('input', () => {
            if (chkKeepRatio.checked && modalCanvas && modalCanvas.width > 0) {
                const ratio = modalCanvas.height / modalCanvas.width;
                inputH.value = Math.round(parseInt(inputW.value || 0, 10) * ratio);
            }
        });

        inputH.addEventListener('input', () => {
            if (chkKeepRatio.checked && modalCanvas && modalCanvas.height > 0) {
                const ratio = modalCanvas.width / modalCanvas.height;
                inputW.value = Math.round(parseInt(inputH.value || 0, 10) * ratio);
            }
        });
    }

    if (btnSize && inputW && inputH) {
        btnSize.addEventListener('click', () => {
            const newW = parseInt(inputW.value, 10);
            const newH = parseInt(inputH.value, 10);
            if (newW > 10 && newH > 10) {
                resizeModalCanvas(newW, newH);
            }
        });
    }

    // 자르기 비율 선택 & 자르기 실행
    const selectCropRatio = document.getElementById('select-modal-crop-ratio');
    if (selectCropRatio) {
        selectCropRatio.addEventListener('change', (e) => {
            modalCropRatio = e.target.value;
            // 자르기 도구 활성화
            const cropBtn = document.getElementById('tool-btn-crop');
            if (cropBtn) cropBtn.click();
        });
    }

    const btnModalCrop = document.getElementById('btn-modal-apply-crop');
    if (btnModalCrop) {
        btnModalCrop.addEventListener('click', applyModalCrop);
    }

    // [객체 서식] 컨트롤 바인딩
    const inputObjColor = document.getElementById('input-object-color');
    const rangeObjWidth = document.getElementById('range-object-width');
    const rangeObjFont = document.getElementById('range-object-fontsize');

    if (inputObjColor) inputObjColor.addEventListener('input', (e) => { objectColor = e.target.value; });
    if (rangeObjWidth) rangeObjWidth.addEventListener('input', (e) => { objectLineWidth = parseInt(e.target.value, 10); });
    if (rangeObjFont) rangeObjFont.addEventListener('input', (e) => { objectFontSize = parseInt(e.target.value, 10); });

    // 캔버스 마우스 인터랙션 바인딩
    bindModalCanvasDrawing();
}

/** 정밀 편집 모달창 열기 */
function openModalEditor(item) {
    modalTargetItem = item;
    const modal = document.getElementById('editor-modal');
    const fileNameEl = document.getElementById('modal-file-name');

    if (modal && modalCanvas) {
        if (fileNameEl) fileNameEl.textContent = item.name;

        modalCanvas.width = item.currentCanvas.width;
        modalCanvas.height = item.currentCanvas.height;
        modalCtx = modalCanvas.getContext('2d');
        modalCtx.drawImage(item.currentCanvas, 0, 0);

        // 히스토리 초기화
        modalHistory = [];
        modalHistoryIndex = -1;
        saveModalHistory();

        // 크기 입력창 동기화
        syncModalDimInputs();

        // 기본 선택 도구
        const selectBtn = document.getElementById('tool-btn-select');
        if (selectBtn) selectBtn.click();

        modal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
    }
}

function syncModalDimInputs() {
    const inputW = document.getElementById('input-modal-w');
    const inputH = document.getElementById('input-modal-h');
    if (inputW && inputH && modalCanvas) {
        inputW.value = modalCanvas.width;
        inputH.value = modalCanvas.height;
    }
}

/** 모달 히스토리 상태 저장 (Undo / Redo) */
function saveModalHistory() {
    if (!modalCanvas) return;
    const dataUrl = modalCanvas.toDataURL();
    if (modalHistoryIndex < modalHistory.length - 1) {
        modalHistory = modalHistory.slice(0, modalHistoryIndex + 1);
    }
    modalHistory.push(dataUrl);
    modalHistoryIndex = modalHistory.length - 1;
}

async function undoModalHistory() {
    if (modalHistoryIndex > 0) {
        modalHistoryIndex--;
        const img = await loadImage(modalHistory[modalHistoryIndex]);
        modalCanvas.width = img.naturalWidth;
        modalCanvas.height = img.naturalHeight;
        modalCtx.drawImage(img, 0, 0);
        syncModalDimInputs();
    }
}

async function redoModalHistory() {
    if (modalHistoryIndex < modalHistory.length - 1) {
        modalHistoryIndex++;
        const img = await loadImage(modalHistory[modalHistoryIndex]);
        modalCanvas.width = img.naturalWidth;
        modalCanvas.height = img.naturalHeight;
        modalCtx.drawImage(img, 0, 0);
        syncModalDimInputs();
    }
}

/** 캔버스 회전 */
function rotateModalCanvas(angle) {
    if (!modalCanvas || !modalCtx) return;
    const temp = document.createElement('canvas');
    temp.width = modalCanvas.width;
    temp.height = modalCanvas.height;
    temp.getContext('2d').drawImage(modalCanvas, 0, 0);

    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const newW = Math.round(temp.width * cos + temp.height * sin);
    const newH = Math.round(temp.width * sin + temp.height * cos);

    modalCanvas.width = newW;
    modalCanvas.height = newH;
    modalCtx.translate(newW / 2, newH / 2);
    modalCtx.rotate(rad);
    modalCtx.drawImage(temp, -temp.width / 2, -temp.height / 2);

    saveModalHistory();
    syncModalDimInputs();
}

/** 캔버스 반전 */
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

    saveModalHistory();
}

/** 캔버스 크기 변경 */
function resizeModalCanvas(newW, newH) {
    if (!modalCanvas || !modalCtx) return;
    const temp = document.createElement('canvas');
    temp.width = modalCanvas.width;
    temp.height = modalCanvas.height;
    temp.getContext('2d').drawImage(modalCanvas, 0, 0);

    modalCanvas.width = newW;
    modalCanvas.height = newH;
    modalCtx.drawImage(temp, 0, 0, newW, newH);

    saveModalHistory();
    syncModalDimInputs();
}

/** 캔버스 인터랙티브 드로잉 & 자르기 박스 바인딩 */
function bindModalCanvasDrawing() {
    if (!modalCanvas) return;
    let snapshotImgData = null;

    modalCanvas.addEventListener('mousedown', (e) => {
        if (!modalCtx) return;
        isModalDrawing = true;

        const rect = modalCanvas.getBoundingClientRect();
        const scaleX = modalCanvas.width / rect.width;
        const scaleY = modalCanvas.height / rect.height;
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        modalDrawStart = { x: clientX * scaleX, y: clientY * scaleY, rawX: clientX, rawY: clientY };

        if (activeModalTool === 'crop') {
            updateModalCropOverlay(clientX, clientY, 0, 0);
            return;
        }

        if (activeModalTool === 'text') {
            const textInput = prompt('삽입할 텍스트를 입력하세요:');
            if (textInput) {
                modalCtx.font = `bold ${objectFontSize}px Pretendard, sans-serif`;
                modalCtx.fillStyle = objectColor;
                modalCtx.fillText(textInput, modalDrawStart.x, modalDrawStart.y);
                saveModalHistory();
            }
            isModalDrawing = false;
            return;
        }

        snapshotImgData = modalCtx.getImageData(0, 0, modalCanvas.width, modalCanvas.height);

        if (activeModalTool === 'mosaic') {
            applyModalMosaic(modalDrawStart.x, modalDrawStart.y);
        } else if (activeModalTool === 'pen' || activeModalTool === 'highlighter') {
            modalCtx.beginPath();
            modalCtx.moveTo(modalDrawStart.x, modalDrawStart.y);
            modalCtx.strokeStyle = objectColor;
            modalCtx.lineWidth = activeModalTool === 'highlighter' ? objectLineWidth * 4 : objectLineWidth;
            modalCtx.lineCap = 'round';
            modalCtx.lineJoin = 'round';
            modalCtx.globalAlpha = activeModalTool === 'highlighter' ? 0.35 : 1.0;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isModalDrawing || !modalCtx) return;

        const rect = modalCanvas.getBoundingClientRect();
        const scaleX = modalCanvas.width / rect.width;
        const scaleY = modalCanvas.height / rect.height;
        const clientX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const clientY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const curX = clientX * scaleX;
        const curY = clientY * scaleY;

        if (activeModalTool === 'crop') {
            let w = clientX - modalDrawStart.rawX;
            let h = clientY - modalDrawStart.rawY;
            let x = w < 0 ? clientX : modalDrawStart.rawX;
            let y = h < 0 ? clientY : modalDrawStart.rawY;
            w = Math.abs(w);
            h = Math.abs(h);

            if (modalCropRatio === '1:1') {
                const minD = Math.min(w, h);
                w = minD; h = minD;
            } else if (modalCropRatio === '4:3') {
                h = w * (3 / 4);
            } else if (modalCropRatio === '16:9') {
                h = w * (9 / 16);
            }

            modalCropRect = { x, y, w, h, scaleX, scaleY };
            updateModalCropOverlay(x, y, w, h);
            return;
        }

        if (activeModalTool === 'mosaic') {
            applyModalMosaic(curX, curY);
            return;
        }

        if (activeModalTool === 'pen' || activeModalTool === 'highlighter') {
            modalCtx.lineTo(curX, curY);
            modalCtx.stroke();
            return;
        }

        // 도형/선 드로잉 (미리보기 반영)
        if (snapshotImgData) {
            modalCtx.putImageData(snapshotImgData, 0, 0);
            modalCtx.save();
            modalCtx.strokeStyle = objectColor;
            modalCtx.fillStyle = objectColor;
            modalCtx.lineWidth = objectLineWidth;
            modalCtx.lineCap = 'round';

            if (activeModalTool === 'line') {
                modalCtx.beginPath();
                modalCtx.moveTo(modalDrawStart.x, modalDrawStart.y);
                modalCtx.lineTo(curX, curY);
                modalCtx.stroke();
            } else if (activeModalTool === 'arrow') {
                drawArrow(modalCtx, modalDrawStart.x, modalDrawStart.y, curX, curY, objectLineWidth * 3);
            } else if (activeModalTool === 'rect') {
                modalCtx.strokeRect(modalDrawStart.x, modalDrawStart.y, curX - modalDrawStart.x, curY - modalDrawStart.y);
            } else if (activeModalTool === 'circle') {
                const radius = Math.sqrt(Math.pow(curX - modalDrawStart.x, 2) + Math.pow(curY - modalDrawStart.y, 2));
                modalCtx.beginPath();
                modalCtx.arc(modalDrawStart.x, modalDrawStart.y, radius, 0, 2 * Math.PI);
                modalCtx.stroke();
            }
            modalCtx.restore();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isModalDrawing) {
            isModalDrawing = false;
            if (activeModalTool !== 'crop' && activeModalTool !== 'select') {
                modalCtx.globalAlpha = 1.0;
                saveModalHistory();
            }
        }
    });
}

function updateModalCropOverlay(x, y, w, h) {
    const cropBox = document.getElementById('modal-crop-box');
    if (cropBox) {
        cropBox.style.display = w > 5 && h > 5 ? 'block' : 'none';
        cropBox.style.left = `${x}px`;
        cropBox.style.top = `${y}px`;
        cropBox.style.width = `${w}px`;
        cropBox.style.height = `${h}px`;
    }
}

function showModalCropBox() {
    if (!modalCanvas) return;
    const rect = modalCanvas.getBoundingClientRect();
    const w = rect.width * 0.8;
    const h = rect.height * 0.8;
    const x = (rect.width - w) / 2;
    const y = (rect.height - h) / 2;
    modalCropRect = { x, y, w, h };
    updateModalCropOverlay(x, y, w, h);
}

function hideModalCropBox() {
    const cropBox = document.getElementById('modal-crop-box');
    if (cropBox) cropBox.style.display = 'none';
}

function applyModalCrop() {
    if (!modalCanvas || !modalCropRect || modalCropRect.w <= 5 || modalCropRect.h <= 5) {
        alert('캔버스에서 자를 영역을 마우스로 드래그하여 지정해주세요.');
        return;
    }

    const rect = modalCanvas.getBoundingClientRect();
    const scaleX = modalCanvas.width / rect.width;
    const scaleY = modalCanvas.height / rect.height;

    const realX = Math.round(modalCropRect.x * scaleX);
    const realY = Math.round(modalCropRect.y * scaleY);
    const realW = Math.round(modalCropRect.w * scaleX);
    const realH = Math.round(modalCropRect.h * scaleY);

    const temp = document.createElement('canvas');
    temp.width = realW;
    temp.height = realH;
    temp.getContext('2d').drawImage(modalCanvas, realX, realY, realW, realH, 0, 0, realW, realH);

    modalCanvas.width = realW;
    modalCanvas.height = realH;
    modalCtx.drawImage(temp, 0, 0);

    hideModalCropBox();
    saveModalHistory();
    syncModalDimInputs();
}

/** 화살표 드로잉 헬퍼 */
function drawArrow(ctx, fromX, fromY, toX, toY, headLength) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

/** 모달 내 모자이크 블러 처리 */
function applyModalMosaic(targetX, targetY) {
    if (!modalCtx) return;
    const radius = 24;
    const startX = Math.max(0, Math.floor(targetX - radius));
    const startY = Math.max(0, Math.floor(targetY - radius));
    const endX = Math.min(modalCanvas.width, Math.ceil(targetX + radius));
    const endY = Math.min(modalCanvas.height, Math.ceil(targetY + radius));
    const w = endX - startX;
    const h = endY - startY;

    if (w <= 0 || h <= 0) return;

    const imgData = modalCtx.getImageData(startX, startY, w, h);
    const data = imgData.data;
    const blockSize = 8;

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

    modalCtx.putImageData(imgData, startX, startY);
}

// ----------------------------------------------------------------------------
// 초기화 실행
// ----------------------------------------------------------------------------
init();

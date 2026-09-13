/**
 * ============================================================================
 * assets/js/tool-mosaic.js - [사진 모자이크] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. 다중 사진 등록 (Ctrl+V, 파일 추가, 드래그앤드롭) 및 상단 카드 갤러리 관리
 * 2. 캔버스 직접 조작 (빈 곳 드래그 새 영역, 영역 이동, 8개 조절 핸들 리사이징, 방향키 이동)
 * 3. 4대 모자이크 패턴 (거친 픽셀, 부드러운 픽셀, 블러, 랜덤 패턴) 및 모양 (네모, 원형)
 * 4. 브라우저 로컬 얼굴 자동 감지 (Skin-tone Segmentation)
 * 5. 워터마크 실시간 합성 (이미지/텍스트, 9방향 위치 그리드, 불투명도, 여백)
 * 6. 선택 사진 개별 저장 및 전체 사진 ZIP 일괄 압축 다운로드 (EXIF 메타데이터 100% 제거)
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
// 등록된 사진 목록 배열 [{ file, name, imgElement, width, height, areas: [], selectedAreaIndex: 0, undoStack: [], redoStack: [] }]
const imageList = [];
let selectedImageIndex = -1;

// 줌 & 팬 상태
let zoomLevel = 1.0; // 100% = 1.0

// 워터마크 설정 (전역 공유)
const wmSettings = {
    enabled: false,
    type: 'image', // 'image' | 'text'
    image: null,
    imageName: '',
    text: '',
    logoWidth: 300,
    opacity: 80,
    position: 'bottom-right',
    margin: 16
};

// 캔버스 마우스 인터랙션 상태
let isDrawingNew = false;
let isMovingArea = false;
let isResizingArea = false;
let resizeHandleType = null; // 'tl','tc','tr','ml','mr','bl','bc','br'
let isPanning = false;

let dragStartX = 0;
let dragStartY = 0;
let initialAreaState = null;

// DOM 요소 캐시
let canvas = null;
let ctx = null;
let emptyState = null;
let workspace = null;
let galleryGrid = null;
let canvasWrapper = null;
let statusBanner = null;
let bottomActions = null;
let faceStatusMsg = null;

// 사이드바 컨트롤 DOM 캐시
let selectAreaMode = null;
let btnUndo = null;
let btnRedo = null;
let btnSelectAll = null;
let btnDetectFaces = null;
let chkAutoFace = null;
let inputFacePad = null;
let chipsContainer = null;
let inputAreaX = null;
let inputAreaY = null;
let inputAreaW = null;
let inputAreaH = null;
let selectPattern = null;
let selectShape = null;
let rangeIntensity = null;
let badgeIntensity = null;
let btnDeleteArea = null;
let btnClearAreas = null;

let inputZoom = null;
let btnZoomIn = null;
let btnZoomOut = null;
let btnZoomFit = null;

let chkWatermark = null;
let wmOptionsPanel = null;
let selectWmType = null;
let wmImageGroup = null;
let wmTextGroup = null;
let wmFileName = null;
let wmFileInput = null;
let btnWmRemoveLogo = null;
let inputWmLogoW = null;
let inputWmText = null;
let rangeWmOpacity = null;
let badgeWmOpacity = null;
let selectWmPos = null;
let inputWmMargin = null;

let inputFilename = null;
let selectSaveFormat = null;
let btnSaveCurrent = null;
let btnSaveAllZip = null;

/**
 * ============================================================================
 * 2. 초기화 함수 (DOM 로드 후 1회 실행)
 * ============================================================================
 */
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // DOM 캐싱
    canvas = document.getElementById('mosaic-canvas');
    if (canvas) ctx = canvas.getContext('2d', { willReadFrequently: true });
    emptyState = document.getElementById('mosaic-empty-state');
    workspace = document.getElementById('mosaic-workspace');
    galleryGrid = document.getElementById('mosaic-gallery-grid');
    canvasWrapper = document.getElementById('mosaic-canvas-wrapper');
    statusBanner = document.getElementById('mosaic-status-banner');
    bottomActions = document.getElementById('mosaic-bottom-actions');
    faceStatusMsg = document.getElementById('face-detect-status-msg');

    selectAreaMode = document.getElementById('select-area-mode');
    btnUndo = document.getElementById('btn-undo');
    btnRedo = document.getElementById('btn-redo');
    btnSelectAll = document.getElementById('btn-select-all-area');
    btnDetectFaces = document.getElementById('btn-detect-faces');
    chkAutoFace = document.getElementById('chk-auto-face-on-load');
    inputFacePad = document.getElementById('input-face-padding');
    chipsContainer = document.getElementById('area-chips-container');
    inputAreaX = document.getElementById('input-area-x');
    inputAreaY = document.getElementById('input-area-y');
    inputAreaW = document.getElementById('input-area-w');
    inputAreaH = document.getElementById('input-area-h');
    selectPattern = document.getElementById('select-mosaic-pattern');
    selectShape = document.getElementById('select-mosaic-shape');
    rangeIntensity = document.getElementById('range-mosaic-intensity');
    badgeIntensity = document.getElementById('badge-mosaic-intensity');
    btnDeleteArea = document.getElementById('btn-delete-current-area');
    btnClearAreas = document.getElementById('btn-clear-all-areas');

    inputZoom = document.getElementById('input-zoom-percent');
    btnZoomIn = document.getElementById('btn-zoom-in');
    btnZoomOut = document.getElementById('btn-zoom-out');
    btnZoomFit = document.getElementById('btn-zoom-fit');

    chkWatermark = document.getElementById('chk-watermark-enable');
    wmOptionsPanel = document.getElementById('watermark-options-panel');
    selectWmType = document.getElementById('select-watermark-type');
    wmImageGroup = document.getElementById('wm-image-group');
    wmTextGroup = document.getElementById('wm-text-group');
    wmFileName = document.getElementById('wm-file-name');
    wmFileInput = document.getElementById('wm-file-input');
    btnWmRemoveLogo = document.getElementById('btn-wm-remove-logo');
    inputWmLogoW = document.getElementById('input-wm-logo-width');
    inputWmText = document.getElementById('input-wm-text');
    rangeWmOpacity = document.getElementById('range-wm-opacity');
    badgeWmOpacity = document.getElementById('badge-wm-opacity');
    selectWmPos = document.getElementById('select-wm-pos');
    inputWmMargin = document.getElementById('input-wm-margin');

    inputFilename = document.getElementById('input-save-filename');
    selectSaveFormat = document.getElementById('select-save-format');
    btnSaveCurrent = document.getElementById('btn-save-current-image');
    btnSaveAllZip = document.getElementById('btn-save-all-zip');

    // 이벤트 리스너 바인딩
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindCanvasEvents();
    bindKeyboardEvents();
    bindSettingsUI();
    bindWatermarkUI();
}

/**
 * ============================================================================
 * 3. 이미지 입력 처리 (다중 등록 & 갤러리 관리)
 * ============================================================================
 */
function bindPasteEvents() {
    window.addEventListener('paste', async (e) => {
        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await addImageFiles([file], `캡처_${formatDateForName(new Date())}`);
                    break;
                }
            }
        }
    });

    const btnPaste = document.getElementById('btn-mosaic-paste');
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        if (types.length > 0) {
                            const blob = await item.getType(types[0]);
                            const file = new File([blob], `붙여넣기_${formatDateForName(new Date())}.${types[0].split('/')[1] || 'png'}`, { type: types[0] });
                            await addImageFiles([file]);
                            return;
                        }
                    }
                }
                alert('클립보드에 이미지가 없습니다.\nWin + Shift + S로 캡처 후 Ctrl + V로 붙여넣어 주세요.');
            } catch (err) {
                alert('Ctrl + V 단축키를 눌러 화면에 캡처 이미지를 붙여넣어 주세요.');
            }
        });
    }
}

function bindFileInputEvents() {
    const fileInput = document.getElementById('mosaic-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await addImageFiles(files);
            }
            fileInput.value = '';
        });
    }

    const btnClear = document.getElementById('btn-mosaic-clear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (imageList.length === 0) return;
            if (confirm('모든 사진을 삭제하고 초기화하시겠습니까?')) {
                imageList.length = 0;
                selectedImageIndex = -1;
                updateWorkspaceUI();
            }
        });
    }
}

function bindDragAndDrop() {
    const dropZone = document.getElementById('mosaic-drop-zone');
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
        if (files.length > 0) {
            await addImageFiles(files);
        }
    });
}

function formatDateForName(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}${h}${min}${s}`;
}

/**
 * 다중 이미지 파일 추가 처리
 */
async function addImageFiles(files, customPrefix = '') {
    const MAX_IMAGES = 30;
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB

    for (let i = 0; i < files.length; i++) {
        if (imageList.length >= MAX_IMAGES) {
            alert(`최대 ${MAX_IMAGES}장까지만 추가할 수 있습니다.`);
            break;
        }

        const file = files[i];
        if (file.size > MAX_SIZE) {
            alert(`25MB 이하의 사진만 추가할 수 있습니다: ${file.name}`);
            continue;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const img = await loadImage(dataUrl);

            // 가로/세로 최대 4096px 크기 제한
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const MAX_DIM = 4096;
            if (w > MAX_DIM || h > MAX_DIM) {
                if (w > h) {
                    h = Math.round((h * MAX_DIM) / w);
                    w = MAX_DIM;
                } else {
                    w = Math.round((w * MAX_DIM) / h);
                    h = MAX_DIM;
                }
            }

            const item = {
                file,
                name: customPrefix ? `${customPrefix}_${imageList.length + 1}.png` : file.name,
                imgElement: img,
                width: w,
                height: h,
                areas: [],
                selectedAreaIndex: -1,
                undoStack: [],
                redoStack: []
            };

            imageList.push(item);

            // 불러올 때 얼굴 자동 적용 체크 시 자동 얼굴 감지
            if (chkAutoFace && chkAutoFace.checked) {
                autoDetectFacesForItem(item);
            }

        } catch (err) {
            console.error('이미지 로드 오류:', err);
        }
    }

    if (selectedImageIndex === -1 && imageList.length > 0) {
        selectedImageIndex = 0;
    }

    updateWorkspaceUI();
}

/**
 * 작업대 UI 전체 갱신 (상단 갤러리 + 메인 뷰어 + 사이드바 동기화)
 */
function updateWorkspaceUI() {
    if (imageList.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (workspace) workspace.style.display = 'none';
        if (bottomActions) bottomActions.style.display = 'none';
        if (statusBanner) statusBanner.textContent = '사진을 추가해주세요.';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (workspace) workspace.style.display = 'flex';
    if (bottomActions) bottomActions.style.display = 'block';

    const currentItem = imageList[selectedImageIndex];
    if (currentItem && statusBanner) {
        statusBanner.textContent = `${imageList.length} / 30장 · 선택 ${selectedImageIndex + 1}번 · ${currentItem.width} × ${currentItem.height}px`;
    }

    renderGalleryGrid();
    syncSidebarWithCurrentItem();
    renderMainCanvas();
}

/**
 * 상단 다중 사진 갤러리 카드 렌더링
 */
function renderGalleryGrid() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    imageList.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `mosaic-gallery-card ${index === selectedImageIndex ? 'selected' : ''}`;
        
        card.innerHTML = `
            <div class="gallery-thumb-wrap">
                <img class="gallery-thumb" src="${item.imgElement.src}" alt="${item.name}">
            </div>
            <div class="gallery-card-info">
                <span class="gallery-card-name" title="${item.name}">${index + 1}. ${item.name}</span>
                <span class="gallery-card-sub">${item.width} × ${item.height}px</span>
            </div>
            <button type="button" class="btn-card-delete" data-index="${index}">삭제</button>
        `;

        // 카드 클릭 시 선택 전환
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-card-delete')) return;
            selectedImageIndex = index;
            updateWorkspaceUI();
        });

        // 개별 삭제 버튼
        const btnDel = card.querySelector('.btn-card-delete');
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteImageItem(index);
        });

        galleryGrid.appendChild(card);
    });
}

function deleteImageItem(index) {
    imageList.splice(index, 1);
    if (selectedImageIndex >= imageList.length) {
        selectedImageIndex = imageList.length - 1;
    }
    updateWorkspaceUI();
}

/**
 * ============================================================================
 * 4. 메인 캔버스 렌더링 & 4대 모자이크 알고리즘
 * ============================================================================
 */
function renderMainCanvas() {
    if (!canvas || selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;

    const item = imageList[selectedImageIndex];
    canvas.width = item.width;
    canvas.height = item.height;

    // 1. 원본 이미지 드로잉
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(item.imgElement, 0, 0, item.width, item.height);

    // 2. 각 모자이크 영역 렌더링
    item.areas.forEach(area => {
        applyMosaicToArea(ctx, area, item);
    });

    // 3. 워터마크 합성 (활성화 시)
    if (wmSettings.enabled) {
        renderWatermarkOnCanvas(ctx, item.width, item.height);
    }

    // 4. 선택된 영역 조절 가이드 (파란색 점선 외곽선 + 8개 조절 핸들)
    if (item.selectedAreaIndex >= 0 && item.selectedAreaIndex < item.areas.length) {
        const activeArea = item.areas[item.selectedAreaIndex];
        drawSelectionBox(ctx, activeArea);
    }
}

/**
 * 4대 모자이크 효과 적용
 */
function applyMosaicToArea(targetCtx, area, item) {
    const x = Math.max(0, Math.min(item.width - 1, Math.round(area.x)));
    const y = Math.max(0, Math.min(item.height - 1, Math.round(area.y)));
    const w = Math.max(1, Math.min(item.width - x, Math.round(area.width)));
    const h = Math.max(1, Math.min(item.height - y, Math.round(area.height)));

    if (w <= 0 || h <= 0) return;

    targetCtx.save();

    // 모양이 'circle'(원형)일 경우 타원 클립 마스크
    if (area.shape === 'circle') {
        targetCtx.beginPath();
        targetCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        targetCtx.clip();
    } else {
        targetCtx.beginPath();
        targetCtx.rect(x, y, w, h);
        targetCtx.clip();
    }

    const intensity = Math.max(4, area.intensity || 22);

    if (area.pattern === 'pixel-coarse' || area.pattern === 'pixel-smooth') {
        // 픽셀 모자이크 (거친 픽셀 / 부드러운 픽셀)
        const blockSize = Math.max(4, Math.round(intensity * (area.pattern === 'pixel-smooth' ? 0.7 : 1.0)));
        const imgData = targetCtx.getImageData(x, y, w, h);
        const data = imgData.data;

        for (let by = 0; by < h; by += blockSize) {
            for (let bx = 0; bx < w; bx += blockSize) {
                const bw = Math.min(blockSize, w - bx);
                const bh = Math.min(blockSize, h - by);

                // 블록 내 대표 색상(평균) 계산
                let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
                for (let py = 0; py < bh; py++) {
                    for (let px = 0; px < bw; px++) {
                        const idx = ((by + py) * w + (bx + px)) * 4;
                        sumR += data[idx];
                        sumG += data[idx + 1];
                        sumB += data[idx + 2];
                        sumA += data[idx + 3];
                        count++;
                    }
                }

                const avgR = Math.round(sumR / count);
                const avgG = Math.round(sumG / count);
                const avgB = Math.round(sumB / count);
                const avgA = Math.round(sumA / count);

                // 블록 전체에 평균색 채우기
                for (let py = 0; py < bh; py++) {
                    for (let px = 0; px < bw; px++) {
                        const idx = ((by + py) * w + (bx + px)) * 4;
                        data[idx] = avgR;
                        data[idx + 1] = avgG;
                        data[idx + 2] = avgB;
                        data[idx + 3] = avgA;
                    }
                }
            }
        }
        targetCtx.putImageData(imgData, x, y);

    } else if (area.pattern === 'blur') {
        // 블러 모자이크 (가우시안 3패스 박스 블러)
        const radius = Math.max(3, Math.round(intensity * 0.8));
        const imgData = targetCtx.getImageData(x, y, w, h);
        boxBlur(imgData.data, w, h, radius);
        targetCtx.putImageData(imgData, x, y);

    } else if (area.pattern === 'random') {
        // 랜덤 패턴 모자이크 (노이즈 텍스처 산란 블록)
        const blockSize = Math.max(6, Math.round(intensity * 0.9));
        const imgData = targetCtx.getImageData(x, y, w, h);
        const data = imgData.data;

        for (let by = 0; by < h; by += blockSize) {
            for (let bx = 0; bx < w; bx += blockSize) {
                const bw = Math.min(blockSize, w - bx);
                const bh = Math.min(blockSize, h - by);

                // 랜덤 노이즈 오프셋 (-25 ~ +25)
                const noise = Math.round((Math.random() - 0.5) * 50);

                let sumR = 0, sumG = 0, sumB = 0, count = 0;
                for (let py = 0; py < bh; py++) {
                    for (let px = 0; px < bw; px++) {
                        const idx = ((by + py) * w + (bx + px)) * 4;
                        sumR += data[idx];
                        sumG += data[idx + 1];
                        sumB += data[idx + 2];
                        count++;
                    }
                }

                const r = Math.min(255, Math.max(0, Math.round(sumR / count) + noise));
                const g = Math.min(255, Math.max(0, Math.round(sumG / count) + noise));
                const b = Math.min(255, Math.max(0, Math.round(sumB / count) + noise));

                for (let py = 0; py < bh; py++) {
                    for (let px = 0; px < bw; px++) {
                        const idx = ((by + py) * w + (bx + px)) * 4;
                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                    }
                }
            }
        }
        targetCtx.putImageData(imgData, x, y);
    }

    targetCtx.restore();
}

/**
 * 고속 박스 블러 알고리즘
 */
function boxBlur(data, w, h, radius) {
    // 수평 블러 패스
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let k = -radius; k <= radius; k++) {
                const nx = Math.min(w - 1, Math.max(0, x + k));
                const idx = (y * w + nx) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
            }
            const cIdx = (y * w + x) * 4;
            data[cIdx] = Math.round(r / count);
            data[cIdx + 1] = Math.round(g / count);
            data[cIdx + 2] = Math.round(b / count);
        }
    }
}

/**
 * 선택 점선 테두리 및 8개 조절 핸들 드로잉
 */
function drawSelectionBox(targetCtx, area) {
    targetCtx.save();

    // 1. 파란색 점선 테두리
    targetCtx.strokeStyle = '#4f46e5';
    targetCtx.lineWidth = 2;
    targetCtx.setLineDash([6, 4]);

    if (area.shape === 'circle') {
        targetCtx.beginPath();
        targetCtx.ellipse(area.x + area.width / 2, area.y + area.height / 2, area.width / 2, area.height / 2, 0, 0, Math.PI * 2);
        targetCtx.stroke();
    } else {
        targetCtx.strokeRect(area.x, area.y, area.width, area.height);
    }

    targetCtx.setLineDash([]); // 점선 초기화

    // 2. 8개 조절 핸들 (손잡이 사각형)
    const handles = getHandleCoordinates(area);
    const HANDLE_SIZE = 8;

    targetCtx.fillStyle = '#4f46e5';
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.lineWidth = 2;

    Object.values(handles).forEach(pt => {
        targetCtx.fillRect(pt.x - HANDLE_SIZE / 2, pt.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        targetCtx.strokeRect(pt.x - HANDLE_SIZE / 2, pt.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });

    targetCtx.restore();
}

function getHandleCoordinates(area) {
    const x1 = area.x;
    const y1 = area.y;
    const x2 = area.x + area.width;
    const y2 = area.y + area.height;
    const xc = area.x + area.width / 2;
    const yc = area.y + area.height / 2;

    return {
        tl: { x: x1, y: y1 },
        tc: { x: xc, y: y1 },
        tr: { x: x2, y: y1 },
        ml: { x: x1, y: yc },
        mr: { x: x2, y: yc },
        bl: { x: x1, y: y2 },
        bc: { x: xc, y: y2 },
        br: { x: x2, y: y2 }
    };
}

/**
 * ============================================================================
 * 5. 캔버스 마우스 인터랙션 (새 영역 생성, 영역 이동, 8개 핸들 리사이징)
 * ============================================================================
 */
function bindCanvasEvents() {
    if (!canvas) return;

    const getCanvasPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const getHitHandle = (pos, area) => {
        if (!area) return null;
        const handles = getHandleCoordinates(area);
        const HIT_DIST = 14;

        for (const [key, pt] of Object.entries(handles)) {
            if (Math.abs(pt.x - pos.x) <= HIT_DIST && Math.abs(pt.y - pos.y) <= HIT_DIST) {
                return key;
            }
        }
        return null;
    };

    const isInsideArea = (pos, area) => {
        if (!area) return false;
        return (
            pos.x >= area.x &&
            pos.x <= area.x + area.width &&
            pos.y >= area.y &&
            pos.y <= area.y + area.height
        );
    };

    // 마우스 다운 이벤트
    canvas.addEventListener('mousedown', (e) => {
        if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
        const item = imageList[selectedImageIndex];
        const pos = getCanvasPos(e);

        // 휠 클릭 시 팬 이동 시작
        if (e.button === 1) {
            isPanning = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            return;
        }

        if (e.button !== 0) return; // 좌클릭만 처리

        const currentArea = item.areas[item.selectedAreaIndex];
        const hitHandle = getHitHandle(pos, currentArea);

        if (hitHandle) {
            // 8개 조절 핸들 드래그 시작
            saveUndoState(item);
            isResizingArea = true;
            resizeHandleType = hitHandle;
            dragStartX = pos.x;
            dragStartY = pos.y;
            initialAreaState = { ...currentArea };
            return;
        }

        // 기존 영역 클릭 여부 확인
        let clickedAreaIndex = -1;
        for (let i = item.areas.length - 1; i >= 0; i--) {
            if (isInsideArea(pos, item.areas[i])) {
                clickedAreaIndex = i;
                break;
            }
        }

        if (clickedAreaIndex >= 0) {
            // 영역 선택 및 이동 시작
            saveUndoState(item);
            item.selectedAreaIndex = clickedAreaIndex;
            isMovingArea = true;
            dragStartX = pos.x;
            dragStartY = pos.y;
            initialAreaState = { ...item.areas[clickedAreaIndex] };
            syncSidebarWithCurrentItem();
            renderMainCanvas();
        } else {
            // 빈 곳 드래그 시 새 영역 생성
            saveUndoState(item);
            const newArea = {
                id: `area_${Date.now()}`,
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                pattern: selectPattern ? selectPattern.value : 'pixel-coarse',
                shape: selectShape ? selectShape.value : 'rect',
                intensity: rangeIntensity ? parseInt(rangeIntensity.value, 10) : 22
            };
            item.areas.push(newArea);
            item.selectedAreaIndex = item.areas.length - 1;
            isDrawingNew = true;
            dragStartX = pos.x;
            dragStartY = pos.y;
            initialAreaState = { ...newArea };
            syncSidebarWithCurrentItem();
            renderMainCanvas();
        }
    });

    // 마우스 무브 이벤트
    window.addEventListener('mousemove', (e) => {
        if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
        const item = imageList[selectedImageIndex];
        const pos = getCanvasPos(e);

        if (isPanning && canvasWrapper) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            canvasWrapper.scrollLeft -= dx;
            canvasWrapper.scrollTop -= dy;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            return;
        }

        if (isDrawingNew) {
            const area = item.areas[item.selectedAreaIndex];
            const x1 = Math.min(dragStartX, pos.x);
            const y1 = Math.min(dragStartY, pos.y);
            const x2 = Math.max(dragStartX, pos.x);
            const y2 = Math.max(dragStartY, pos.y);
            area.x = Math.round(x1);
            area.y = Math.round(y1);
            area.width = Math.round(x2 - x1);
            area.height = Math.round(y2 - y1);
            syncInputsWithActiveArea(area);
            renderMainCanvas();
            return;
        }

        if (isMovingArea && initialAreaState) {
            const area = item.areas[item.selectedAreaIndex];
            const dx = pos.x - dragStartX;
            const dy = pos.y - dragStartY;
            area.x = Math.round(Math.max(0, Math.min(item.width - area.width, initialAreaState.x + dx)));
            area.y = Math.round(Math.max(0, Math.min(item.height - area.height, initialAreaState.y + dy)));
            syncInputsWithActiveArea(area);
            renderMainCanvas();
            return;
        }

        if (isResizingArea && initialAreaState) {
            const area = item.areas[item.selectedAreaIndex];
            const dx = pos.x - dragStartX;
            const dy = pos.y - dragStartY;

            let x1 = initialAreaState.x;
            let y1 = initialAreaState.y;
            let x2 = initialAreaState.x + initialAreaState.width;
            let y2 = initialAreaState.y + initialAreaState.height;

            if (resizeHandleType.includes('l')) x1 += dx;
            if (resizeHandleType.includes('r')) x2 += dx;
            if (resizeHandleType.includes('t')) y1 += dy;
            if (resizeHandleType.includes('b')) y2 += dy;

            area.x = Math.round(Math.min(x1, x2));
            area.y = Math.round(Math.min(y1, y2));
            area.width = Math.round(Math.abs(x2 - x1));
            area.height = Math.round(Math.abs(y2 - y1));

            syncInputsWithActiveArea(area);
            renderMainCanvas();
            return;
        }

        // 호버 커서 업데이트
        const currentArea = item.areas[item.selectedAreaIndex];
        const hitHandle = getHitHandle(pos, currentArea);

        if (hitHandle) {
            if (hitHandle === 'tl' || hitHandle === 'br') canvas.style.cursor = 'nwse-resize';
            else if (hitHandle === 'tr' || hitHandle === 'bl') canvas.style.cursor = 'nesw-resize';
            else if (hitHandle === 'tc' || hitHandle === 'bc') canvas.style.cursor = 'ns-resize';
            else if (hitHandle === 'ml' || hitHandle === 'mr') canvas.style.cursor = 'ew-resize';
        } else if (isInsideArea(pos, currentArea)) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    });

    // 마우스 업 이벤트
    window.addEventListener('mouseup', () => {
        if (isDrawingNew) {
            const item = imageList[selectedImageIndex];
            const area = item.areas[item.selectedAreaIndex];
            if (area && (area.width < 5 || area.height < 5)) {
                // 너무 작은 드래그는 취소 처리
                item.areas.pop();
                item.selectedAreaIndex = item.areas.length - 1;
            }
            isDrawingNew = false;
            syncSidebarWithCurrentItem();
            renderMainCanvas();
        }

        isMovingArea = false;
        isResizingArea = false;
        isPanning = false;
        resizeHandleType = null;
    });

    // 마우스 휠 줌 (Ctrl + Wheel)
    canvasWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoomLevel(zoomLevel + delta);
        }
    }, { passive: false });
}

/**
 * 방향키 키보드 단축키 (선택 영역 1px/10px 정밀 이동 & Ctrl+Z)
 */
function bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
        if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
        const item = imageList[selectedImageIndex];
        const area = item.areas[item.selectedAreaIndex];

        // 입력 폼에 포커스되어 있을 땐 단축키 무시
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        // Undo (Ctrl+Z), Redo (Ctrl+Y)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            performUndo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            performRedo();
            return;
        }

        // 방향키 이동
        if (area && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;

            if (e.key === 'ArrowUp') area.y = Math.max(0, area.y - step);
            if (e.key === 'ArrowDown') area.y = Math.min(item.height - area.height, area.y + step);
            if (e.key === 'ArrowLeft') area.x = Math.max(0, area.x - step);
            if (e.key === 'ArrowRight') area.x = Math.min(item.width - area.width, area.x + step);

            syncInputsWithActiveArea(area);
            renderMainCanvas();
        }

        // Delete 키로 선택 영역 삭제
        if (area && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            deleteActiveArea();
        }
    });
}

/**
 * ============================================================================
 * 6. 브라우저 로컬 스마트 얼굴 자동 감지 (Skin-tone Segmentation)
 * ============================================================================
 */
function detectFacesInCurrentImage() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
    const item = imageList[selectedImageIndex];
    autoDetectFacesForItem(item);
    syncSidebarWithCurrentItem();
    renderMainCanvas();
}

function autoDetectFacesForItem(item) {
    try {
        saveUndoState(item);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = item.width;
        tempCanvas.height = item.height;
        const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tCtx.drawImage(item.imgElement, 0, 0, item.width, item.height);

        const imgData = tCtx.getImageData(0, 0, item.width, item.height);
        const data = imgData.data;

        const w = item.width;
        const h = item.height;
        const skinMap = new Uint8Array(w * h);

        // 1. 피부색 탐색 (RGB 기반 피부톤 모델)
        for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // 피부톤 조건
                const isSkin = (r > 95 && g > 40 && b > 20 &&
                    (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                    Math.abs(r - g) > 15 && r > g && r > b);

                if (isSkin) {
                    skinMap[y * w + x] = 1;
                }
            }
        }

        // 2. 연결 컴포넌트 클러스터링을 통한 얼굴 바운딩 박스 추정
        const detectedBoxes = [];
        const visited = new Uint8Array(w * h);

        for (let y = 10; y < h - 10; y += 8) {
            for (let x = 10; x < w - 10; x += 8) {
                const pos = y * w + x;
                if (skinMap[pos] === 1 && visited[pos] === 0) {
                    // BFS 영역 탐색
                    let minX = x, maxX = x, minY = y, maxY = y, count = 0;
                    const queue = [x, y];
                    visited[pos] = 1;

                    let qHead = 0;
                    while (qHead < queue.length) {
                        const cx = queue[qHead++];
                        const cy = queue[qHead++];
                        count++;

                        if (cx < minX) minX = cx;
                        if (cx > maxX) maxX = cx;
                        if (cy < minY) minY = cy;
                        if (cy > maxY) maxY = cy;

                        const neighbors = [
                            [cx + 8, cy], [cx - 8, cy],
                            [cx, cy + 8], [cx, cy - 8]
                        ];

                        for (let n = 0; n < 4; n++) {
                            const nx = neighbors[n][0];
                            const ny = neighbors[n][1];
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                const nPos = ny * w + nx;
                                if (skinMap[nPos] === 1 && visited[nPos] === 0) {
                                    visited[nPos] = 1;
                                    queue.push(nx, ny);
                                }
                            }
                        }
                    }

                    const boxW = maxX - minX;
                    const boxH = maxY - minY;
                    // 최소/최대 얼굴 비율 필터링
                    if (count > 25 && boxW > w * 0.04 && boxH > h * 0.04 && boxW < w * 0.85 && boxH < h * 0.85) {
                        detectedBoxes.push({ x: minX, y: minY, w: boxW, h: boxH });
                    }
                }
            }
        }

        // 여백(Padding) 적용 및 모자이크 영역 추가
        const padPercent = inputFacePad ? parseInt(inputFacePad.value, 10) / 100 : 0.3;
        
        // 감지된 후보가 없을 경우 중앙 기본 영역 제공
        if (detectedBoxes.length === 0) {
            const fallbackW = Math.round(w * 0.28);
            const fallbackH = Math.round(h * 0.32);
            detectedBoxes.push({
                x: Math.round((w - fallbackW) / 2),
                y: Math.round(h * 0.2),
                w: fallbackW,
                h: fallbackH
            });
        }

        detectedBoxes.forEach(box => {
            const padX = Math.round(box.w * padPercent);
            const padY = Math.round(box.h * padPercent);
            const finalX = Math.max(0, box.x - padX);
            const finalY = Math.max(0, box.y - padY);
            const finalW = Math.min(w - finalX, box.w + padX * 2);
            const finalH = Math.min(h - finalY, box.h + padY * 2);

            item.areas.push({
                id: `area_face_${Date.now()}_${Math.random()}`,
                x: finalX,
                y: finalY,
                width: finalW,
                height: finalH,
                pattern: selectPattern ? selectPattern.value : 'pixel-coarse',
                shape: selectShape ? selectShape.value : 'rect',
                intensity: rangeIntensity ? parseInt(rangeIntensity.value, 10) : 22
            });
        });

        item.selectedAreaIndex = item.areas.length - 1;

        if (faceStatusMsg) {
            faceStatusMsg.textContent = `${detectedBoxes.length}개 얼굴을 찾았습니다. 가려진 범위를 직접 확인하세요.`;
        }

    } catch (err) {
        console.error('얼굴 감지 오류:', err);
    }
}

/**
 * ============================================================================
 * 7. 사이드바 설정 UI 동기화 및 이벤트 바인딩
 * ============================================================================
 */
function syncSidebarWithCurrentItem() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
    const item = imageList[selectedImageIndex];

    // 영역 칩 버튼 목록 렌더링
    if (chipsContainer) {
        chipsContainer.innerHTML = '';
        item.areas.forEach((area, i) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `area-chip ${i === item.selectedAreaIndex ? 'active' : ''}`;
            chip.textContent = `영역 ${i + 1}`;
            chip.addEventListener('click', () => {
                item.selectedAreaIndex = i;
                syncSidebarWithCurrentItem();
                renderMainCanvas();
            });
            chipsContainer.appendChild(chip);
        });
    }

    // 선택된 영역 입력값 동기화
    if (item.selectedAreaIndex >= 0 && item.selectedAreaIndex < item.areas.length) {
        const area = item.areas[item.selectedAreaIndex];
        syncInputsWithActiveArea(area);
        if (selectPattern) selectPattern.value = area.pattern || 'pixel-coarse';
        if (selectShape) selectShape.value = area.shape || 'rect';
        if (rangeIntensity) {
            rangeIntensity.value = area.intensity || 22;
            if (badgeIntensity) badgeIntensity.textContent = `선택 영역 ${item.selectedAreaIndex + 1} · 강도 ${area.intensity || 22}`;
        }
    } else {
        if (inputAreaX) inputAreaX.value = '0';
        if (inputAreaY) inputAreaY.value = '0';
        if (inputAreaW) inputAreaW.value = '0';
        if (inputAreaH) inputAreaH.value = '0';
        if (badgeIntensity) badgeIntensity.textContent = `선택된 영역 없음`;
    }

    // Undo/Redo 버튼 상태 갱신
    if (btnUndo) btnUndo.disabled = item.undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = item.redoStack.length === 0;
}

function syncInputsWithActiveArea(area) {
    if (inputAreaX) inputAreaX.value = Math.round(area.x);
    if (inputAreaY) inputAreaY.value = Math.round(area.y);
    if (inputAreaW) inputAreaW.value = Math.round(area.width);
    if (inputAreaH) inputAreaH.value = Math.round(area.height);
}

function bindSettingsUI() {
    // 1. 되돌리기 & 다시 실행
    if (btnUndo) btnUndo.addEventListener('click', performUndo);
    if (btnRedo) btnRedo.addEventListener('click', performRedo);

    // 2. 전체 영역 버튼
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            saveUndoState(item);

            item.areas.push({
                id: `area_all_${Date.now()}`,
                x: 0,
                y: 0,
                width: item.width,
                height: item.height,
                pattern: selectPattern ? selectPattern.value : 'pixel-coarse',
                shape: selectShape ? selectShape.value : 'rect',
                intensity: rangeIntensity ? parseInt(rangeIntensity.value, 10) : 22
            });
            item.selectedAreaIndex = item.areas.length - 1;
            syncSidebarWithCurrentItem();
            renderMainCanvas();
        });
    }

    // 3. 얼굴 자동 감지 버튼
    if (btnDetectFaces) {
        btnDetectFaces.addEventListener('click', detectFacesInCurrentImage);
    }

    // 4. 위치 X, Y, W, H 직접 입력
    [inputAreaX, inputAreaY, inputAreaW, inputAreaH].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            const area = item.areas[item.selectedAreaIndex];
            if (!area) return;

            if (inputAreaX) area.x = Math.max(0, parseInt(inputAreaX.value, 10) || 0);
            if (inputAreaY) area.y = Math.max(0, parseInt(inputAreaY.value, 10) || 0);
            if (inputAreaW) area.width = Math.max(1, parseInt(inputAreaW.value, 10) || 1);
            if (inputAreaH) area.height = Math.max(1, parseInt(inputAreaH.value, 10) || 1);

            renderMainCanvas();
        });
    });

    // 5. 패턴 & 모양 선택
    if (selectPattern) {
        selectPattern.addEventListener('change', (e) => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            const area = item.areas[item.selectedAreaIndex];
            if (area) {
                area.pattern = e.target.value;
                renderMainCanvas();
            }
        });
    }

    if (selectShape) {
        selectShape.addEventListener('change', (e) => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            const area = item.areas[item.selectedAreaIndex];
            if (area) {
                area.shape = e.target.value;
                renderMainCanvas();
            }
        });
    }

    // 6. 모자이크 강도 슬라이더
    if (rangeIntensity) {
        rangeIntensity.addEventListener('input', (e) => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            const area = item.areas[item.selectedAreaIndex];
            const val = parseInt(e.target.value, 10);
            if (badgeIntensity) badgeIntensity.textContent = `선택 영역 ${item.selectedAreaIndex + 1} · 강도 ${val}`;
            if (area) {
                area.intensity = val;
                renderMainCanvas();
            }
        });
    }

    // 7. 선택 영역 삭제 & 영역 모두 지우기
    if (btnDeleteArea) btnDeleteArea.addEventListener('click', deleteActiveArea);
    if (btnClearAreas) {
        btnClearAreas.addEventListener('click', () => {
            if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
            const item = imageList[selectedImageIndex];
            if (item.areas.length === 0) return;
            if (confirm('현재 사진의 모든 모자이크 영역을 삭제하시겠습니까?')) {
                saveUndoState(item);
                item.areas = [];
                item.selectedAreaIndex = -1;
                syncSidebarWithCurrentItem();
                renderMainCanvas();
            }
        });
    }

    // 8. 줌 컨트롤
    if (inputZoom) {
        inputZoom.addEventListener('change', () => {
            const val = parseInt(inputZoom.value, 10);
            if (val >= 20 && val <= 500) setZoomLevel(val / 100);
        });
    }
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => setZoomLevel(zoomLevel + 0.15));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => setZoomLevel(zoomLevel - 0.15));
    if (btnZoomFit) btnZoomFit.addEventListener('click', fitZoomToScreen);

    // 9. 저장 버튼 바인딩
    if (btnSaveCurrent) btnSaveCurrent.addEventListener('click', saveCurrentImage);
    if (btnSaveAllZip) btnSaveAllZip.addEventListener('click', saveAllImagesZip);
}

function setZoomLevel(newLevel) {
    zoomLevel = Math.max(0.2, Math.min(5.0, newLevel));
    if (inputZoom) inputZoom.value = Math.round(zoomLevel * 100);
    if (canvas) {
        canvas.style.transform = `scale(${zoomLevel})`;
        canvas.style.transformOrigin = 'center center';
    }
}

function fitZoomToScreen() {
    setZoomLevel(1.0);
}

function deleteActiveArea() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
    const item = imageList[selectedImageIndex];
    if (item.selectedAreaIndex >= 0 && item.selectedAreaIndex < item.areas.length) {
        saveUndoState(item);
        item.areas.splice(item.selectedAreaIndex, 1);
        item.selectedAreaIndex = item.areas.length - 1;
        syncSidebarWithCurrentItem();
        renderMainCanvas();
    }
}

/**
 * ============================================================================
 * 8. 실행 취소(Undo) & 다시 실행(Redo)
 * ============================================================================
 */
function saveUndoState(item) {
    item.undoStack.push(JSON.stringify(item.areas));
    if (item.undoStack.length > 20) item.undoStack.shift();
    item.redoStack.length = 0;
    if (btnUndo) btnUndo.disabled = false;
    if (btnRedo) btnRedo.disabled = true;
}

function performUndo() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
    const item = imageList[selectedImageIndex];
    if (item.undoStack.length === 0) return;

    item.redoStack.push(JSON.stringify(item.areas));
    const prevState = item.undoStack.pop();
    item.areas = JSON.parse(prevState);
    if (item.selectedAreaIndex >= item.areas.length) {
        item.selectedAreaIndex = item.areas.length - 1;
    }
    syncSidebarWithCurrentItem();
    renderMainCanvas();
}

function performRedo() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) return;
    const item = imageList[selectedImageIndex];
    if (item.redoStack.length === 0) return;

    item.undoStack.push(JSON.stringify(item.areas));
    const nextState = item.redoStack.pop();
    item.areas = JSON.parse(nextState);
    if (item.selectedAreaIndex >= item.areas.length) {
        item.selectedAreaIndex = item.areas.length - 1;
    }
    syncSidebarWithCurrentItem();
    renderMainCanvas();
}

/**
 * ============================================================================
 * 9. 워터마크 인터랙션 & 렌더링
 * ============================================================================
 */
function bindWatermarkUI() {
    if (chkWatermark) {
        chkWatermark.addEventListener('change', (e) => {
            wmSettings.enabled = e.target.checked;
            renderMainCanvas();
        });
    }

    if (selectWmType) {
        selectWmType.addEventListener('change', (e) => {
            wmSettings.type = e.target.value;
            if (wmImageGroup) wmImageGroup.style.display = wmSettings.type === 'image' ? 'block' : 'none';
            if (wmTextGroup) wmTextGroup.style.display = wmSettings.type === 'text' ? 'block' : 'none';
            renderMainCanvas();
        });
    }

    if (wmFileInput) {
        wmFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                wmSettings.image = await loadImage(dataUrl);
                wmSettings.imageName = file.name;
                if (wmFileName) wmFileName.textContent = file.name;
                if (chkWatermark) chkWatermark.checked = true;
                wmSettings.enabled = true;
                renderMainCanvas();
            }
        });
    }

    if (btnWmRemoveLogo) {
        btnWmRemoveLogo.addEventListener('click', () => {
            wmSettings.image = null;
            wmSettings.imageName = '';
            if (wmFileName) wmFileName.textContent = '선택한 파일 없음';
            renderMainCanvas();
        });
    }

    if (inputWmLogoW) {
        inputWmLogoW.addEventListener('input', (e) => {
            wmSettings.logoWidth = parseInt(e.target.value, 10) || 300;
            renderMainCanvas();
        });
    }

    if (inputWmText) {
        inputWmText.addEventListener('input', (e) => {
            wmSettings.text = e.target.value;
            if (wmSettings.text && chkWatermark) {
                chkWatermark.checked = true;
                wmSettings.enabled = true;
            }
            renderMainCanvas();
        });
    }

    if (rangeWmOpacity) {
        rangeWmOpacity.addEventListener('input', (e) => {
            wmSettings.opacity = parseInt(e.target.value, 10);
            if (badgeWmOpacity) badgeWmOpacity.textContent = `${wmSettings.opacity}%`;
            renderMainCanvas();
        });
    }

    // 9방향 버튼 그리드 (.wm-pos-btn)
    const posBtns = document.querySelectorAll('.wm-pos-btn');
    posBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            posBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const pos = btn.getAttribute('data-pos');
            wmSettings.position = pos;
            if (selectWmPos) selectWmPos.value = pos;
            renderMainCanvas();
        });
    });

    if (selectWmPos) {
        selectWmPos.addEventListener('change', (e) => {
            wmSettings.position = e.target.value;
            posBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-pos') === wmSettings.position));
            renderMainCanvas();
        });
    }

    if (inputWmMargin) {
        inputWmMargin.addEventListener('input', (e) => {
            wmSettings.margin = parseInt(e.target.value, 10) || 16;
            renderMainCanvas();
        });
    }
}

function renderWatermarkOnCanvas(targetCtx, w, h) {
    targetCtx.save();
    targetCtx.globalAlpha = (wmSettings.opacity || 80) / 100;

    const margin = wmSettings.margin || 16;
    let targetX = margin;
    let targetY = margin;

    if (wmSettings.type === 'image' && wmSettings.image) {
        const logo = wmSettings.image;
        const logoW = Math.min(w * 0.8, wmSettings.logoWidth || 300);
        const logoH = (logoW / logo.naturalWidth) * logo.naturalHeight;

        if (wmSettings.position.includes('center')) targetX = (w - logoW) / 2;
        if (wmSettings.position.includes('right')) targetX = w - logoW - margin;
        if (wmSettings.position.includes('left')) targetX = margin;

        if (wmSettings.position.startsWith('center') || wmSettings.position === 'center') targetY = (h - logoH) / 2;
        if (wmSettings.position.startsWith('bottom')) targetY = h - logoH - margin;
        if (wmSettings.position.startsWith('top')) targetY = margin;

        targetCtx.drawImage(logo, targetX, targetY, logoW, logoH);

    } else if (wmSettings.type === 'text' && wmSettings.text) {
        const fontSize = Math.max(16, Math.round(w * 0.035));
        targetCtx.font = `bold ${fontSize}px sans-serif`;
        const textMetrics = targetCtx.measureText(wmSettings.text);
        const textW = textMetrics.width;
        const textH = fontSize;

        if (wmSettings.position.includes('center')) targetX = (w - textW) / 2;
        if (wmSettings.position.includes('right')) targetX = w - textW - margin;
        if (wmSettings.position.includes('left')) targetX = margin;

        if (wmSettings.position.startsWith('center') || wmSettings.position === 'center') targetY = (h + textH) / 2;
        if (wmSettings.position.startsWith('bottom')) targetY = h - margin;
        if (wmSettings.position.startsWith('top')) targetY = margin + textH;

        // 그림자 및 텍스트 드로잉
        targetCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        targetCtx.shadowBlur = 6;
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillText(wmSettings.text, targetX, targetY);
    }

    targetCtx.restore();
}

/**
 * ============================================================================
 * 10. 최종 완성 이미지 다운로드 & ZIP 일괄 압축 (EXIF 메타데이터 제거)
 * ============================================================================
 */
async function saveCurrentImage() {
    if (selectedImageIndex < 0 || selectedImageIndex >= imageList.length) {
        alert('먼저 사진을 추가해주세요.');
        return;
    }

    const item = imageList[selectedImageIndex];
    const format = selectSaveFormat ? selectSaveFormat.value : 'png';
    const mimeType = `image/${format}`;
    const ext = format === 'jpeg' ? 'jpg' : format;

    let baseName = inputFilename && inputFilename.value.trim() ? inputFilename.value.trim() : item.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_모자이크.${ext}`;

    const originalHTML = btnSaveCurrent ? btnSaveCurrent.innerHTML : '';
    if (btnSaveCurrent) {
        btnSaveCurrent.disabled = true;
        btnSaveCurrent.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>저장 중...</span>`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        // 순수 캔버스 렌더링 (가이드 박스 제외)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = item.width;
        exportCanvas.height = item.height;
        const expCtx = exportCanvas.getContext('2d');

        expCtx.drawImage(item.imgElement, 0, 0, item.width, item.height);
        item.areas.forEach(area => applyMosaicToArea(expCtx, area, item));
        if (wmSettings.enabled) renderWatermarkOnCanvas(expCtx, item.width, item.height);

        const blob = await canvasToBlob(exportCanvas, mimeType, 0.95);
        downloadBlob(blob, filename);

    } catch (err) {
        console.error('다운로드 오류:', err);
        alert('다운로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSaveCurrent) {
            btnSaveCurrent.disabled = false;
            btnSaveCurrent.innerHTML = originalHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

async function saveAllImagesZip() {
    if (imageList.length === 0) {
        alert('먼저 사진을 추가해주세요.');
        return;
    }

    if (!window.JSZip) {
        alert('ZIP 압축 라이브러리를 불러오지 못했습니다.');
        return;
    }

    const originalHTML = btnSaveAllZip ? btnSaveAllZip.innerHTML : '';
    if (btnSaveAllZip) {
        btnSaveAllZip.disabled = true;
        btnSaveAllZip.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>ZIP 압축 중...</span>`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        const zip = new JSZip();
        const format = selectSaveFormat ? selectSaveFormat.value : 'png';
        const mimeType = `image/${format}`;
        const ext = format === 'jpeg' ? 'jpg' : format;

        for (let i = 0; i < imageList.length; i++) {
            const item = imageList[i];
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = item.width;
            exportCanvas.height = item.height;
            const expCtx = exportCanvas.getContext('2d');

            expCtx.drawImage(item.imgElement, 0, 0, item.width, item.height);
            item.areas.forEach(area => applyMosaicToArea(expCtx, area, item));
            if (wmSettings.enabled) renderWatermarkOnCanvas(expCtx, item.width, item.height);

            const blob = await canvasToBlob(exportCanvas, mimeType, 0.95);
            const cleanName = item.name.replace(/\.[^/.]+$/, '');
            zip.file(`${cleanName}_모자이크.${ext}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `사진_모자이크_일괄_${formatDateForName(new Date())}.zip`);

    } catch (err) {
        console.error('ZIP 압축 오류:', err);
        alert('ZIP 압축 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSaveAllZip) {
            btnSaveAllZip.disabled = false;
            btnSaveAllZip.innerHTML = originalHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// 초기화 자동 실행
document.addEventListener('DOMContentLoaded', init);

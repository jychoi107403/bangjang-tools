/**
 * ============================================================================
 * assets/js/tool-remove-bg.js - [배경 제거·바꾸기] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. Win+Shift+S 캡처(Ctrl+V), 파일 드래그앤드롭 및 파일 선택 지원
 * 2. 100% 브라우저 로컬 스마트 자동 배경 제거 (Flood Fill + 색상 유사도 분석)
 * 3. 캔버스 정밀 수동 보정 도구 (지우개, 복원 브러시, 마법봉 일괄 제거, Undo/Redo)
 * 4. 실시간 원형 브러시 커서 가이드 표시
 * 5. 새 배경 바꾸기 (투명 체커보드, 실무 추천 단색 팔레트, 스튜디오 그라데이션, 사용자 사진 합성)
 * 6. 원본 비교 (홀드 뷰 & 토글 뷰) 및 EXIF 메타데이터 100% 제거 고화질 다운로드
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
let currentImage = null;          // 현재 로드된 원본 이미지 정보 { file, name, imgElement, width, height }
let originalCanvas = null;        // 변경되지 않는 순수 원본 이미지 캔버스
let foregroundMaskCanvas = null;  // 배경이 투명하게 제거된 전경(누끼) 캔버스
let customBgImage = null;         // 사용자가 추가한 배경 사진 객체

// 설정 상태
let bgType = 'transparent';       // 'transparent' | 'color' | 'gradient' | 'image'
let bgColor = '#ffffff';          // 단색 배경 색상
let gradientPreset = 'studio-light'; // 그라데이션 프리셋
let thresholdVal = 30;            // 제거 범위 / 민감도 (5 ~ 80)
let featherVal = 2;               // 경계 부드러움 (0 ~ 8)
let currentToolMode = 'preview';  // 'preview' | 'erase' | 'restore' | 'magic'
let brushSize = 25;               // 수동 브러시 크기 (5 ~ 100)
let showOriginal = false;         // 원본 보기 고정 여부
let isHoldingOriginal = false;    // 원본 비교 버튼 누르고 있는 상태 여부
let exportFormat = 'png';         // 'png' | 'jpeg' | 'webp'

// 마우스 브러시 페인팅 상태 및 실행 취소(Undo) 히스토리
let isPainting = false;
const undoHistory = [];           // ImageData 스택 (최대 15단계)
const MAX_UNDO_STEPS = 15;

// DOM 요소 캐싱 변수
let canvas = null;
let ctx = null;
let canvasWrapper = null;
let brushCursor = null;
let emptyState = null;
let workspace = null;
let loadingOverlay = null;
let stateBanner = null;
let btnAutoRemove = null;
let btnSave = null;
let btnUndo = null;
let btnResetView = null;
let btnResetBrush = null;
let rangeThreshold = null;
let rangeFeather = null;
let rangeBrush = null;
let badgeThreshold = null;
let badgeFeather = null;
let badgeBrush = null;
let chkShowOriginal = null;
let selectNewBg = null;
let colorInput = null;
let labelColorVal = null;
let selectGradientPreset = null;
let bgFileInput = null;
let bgFileNameLabel = null;
let groupBgColor = null;
let groupBgGradient = null;
let groupBgImage = null;

/**
 * ============================================================================
 * 2. 초기화 함수 (DOM 로드 후 1회 실행)
 * ============================================================================
 */
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // DOM 요소 참조 연결
    canvas = document.getElementById('remove-bg-canvas');
    if (canvas) ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvasWrapper = document.getElementById('canvas-wrapper');
    brushCursor = document.getElementById('brush-cursor');
    emptyState = document.getElementById('remove-bg-empty-state');
    workspace = document.getElementById('remove-bg-workspace');
    loadingOverlay = document.getElementById('ai-loading-overlay');
    stateBanner = document.getElementById('remove-bg-status-banner');
    btnAutoRemove = document.getElementById('btn-auto-remove');
    btnSave = document.getElementById('btn-save-completed');
    btnUndo = document.getElementById('btn-brush-undo');
    btnResetView = document.getElementById('btn-brush-reset-view');
    btnResetBrush = document.getElementById('btn-reset-brush');

    rangeThreshold = document.getElementById('range-threshold');
    rangeFeather = document.getElementById('range-feather');
    rangeBrush = document.getElementById('range-brush-size');
    badgeThreshold = document.getElementById('badge-threshold');
    badgeFeather = document.getElementById('badge-feather');
    badgeBrush = document.getElementById('badge-brush-size');

    chkShowOriginal = document.getElementById('chk-show-original');
    selectNewBg = document.getElementById('select-new-bg');
    colorInput = document.getElementById('input-bg-color');
    labelColorVal = document.getElementById('label-color-val');
    selectGradientPreset = document.getElementById('select-gradient-preset');
    bgFileInput = document.getElementById('bg-file-input');
    bgFileNameLabel = document.getElementById('bg-file-name-label');

    groupBgColor = document.getElementById('group-bg-color');
    groupBgGradient = document.getElementById('group-bg-gradient');
    groupBgImage = document.getElementById('group-bg-image');

    // 이벤트 리스너 바인딩
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindToolbarModes();
    bindBrushCanvasEvents();
    bindSettingsUI();
    bindKeyboardShortcuts();
}

/**
 * ============================================================================
 * 3. 이미지 입력 처리 (클립보드 붙여넣기, 파일 선택, 드래그앤드롭)
 * ============================================================================
 */
function bindPasteEvents() {
    // Win+Shift+S 캡처 후 Ctrl+V 붙여넣기
    window.addEventListener('paste', async (e) => {
        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await loadMainImage(file, `캡처_사진_${Date.now()}`);
                    break;
                }
            }
        }
    });

    const btnPaste = document.getElementById('btn-bg-paste');
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        if (types.length > 0) {
                            const blob = await item.getType(types[0]);
                            const file = new File([blob], `붙여넣기_${Date.now()}.${types[0].split('/')[1] || 'png'}`, { type: types[0] });
                            await loadMainImage(file);
                            return;
                        }
                    }
                }
                alert('클립보드에 복사된 이미지가 없습니다.\nWin + Shift + S로 화면을 캡처한 후 Ctrl + V로 붙여넣어 주세요.');
            } catch (err) {
                alert('브라우저 보안 설정으로 인해 직접 Ctrl + V 키를 눌러 붙여넣어 주세요.');
            }
        });
    }
}

function bindFileInputEvents() {
    const fileInput = document.getElementById('bg-main-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await loadMainImage(file);
            }
            fileInput.value = '';
        });
    }

    const btnClear = document.getElementById('btn-bg-clear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (!currentImage) return;
            if (confirm('현재 작업 중인 사진을 삭제하고 초기화하시겠습니까?')) {
                currentImage = null;
                originalCanvas = null;
                foregroundMaskCanvas = null;
                customBgImage = null;
                undoHistory.length = 0;
                updateUndoButtonState();
                updateWorkspaceUI();
            }
        });
    }
}

function bindDragAndDrop() {
    const dropZone = document.getElementById('remove-bg-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'dragend'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            await loadMainImage(file);
        }
    });
}

/**
 * 메인 사진 파일 로드 및 초기 캔버스 설정
 */
async function loadMainImage(file, customName = '') {
    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        // 최대 해상도 2048px 비율 유지 조정 (고속 브라우저 연산 보장)
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const MAX_DIM = 2048;
        if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
                h = Math.round((h * MAX_DIM) / w);
                w = MAX_DIM;
            } else {
                w = Math.round((w * MAX_DIM) / h);
                h = MAX_DIM;
            }
        }

        currentImage = {
            file,
            name: customName ? `${customName}.png` : file.name,
            imgElement: img,
            width: w,
            height: h
        };

        // 1. 원본 보존용 캔버스 생성
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = w;
        originalCanvas.height = h;
        const origCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
        origCtx.drawImage(img, 0, 0, w, h);

        // 2. 초기 전경 누끼 캔버스 생성 (초기에는 원본 복사)
        foregroundMaskCanvas = document.createElement('canvas');
        foregroundMaskCanvas.width = w;
        foregroundMaskCanvas.height = h;
        const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
        fgCtx.drawImage(originalCanvas, 0, 0);

        // 히스토리 초기화 및 첫 상태 저장
        undoHistory.length = 0;
        saveUndoState();

        updateWorkspaceUI();

        // 사진 추가 시 자동으로 스마트 배경 제거 1회 즉시 실행 (편의성 극대화)
        await executeAutoRemoveBackground();

    } catch (err) {
        console.error('사진 로드 실패:', err);
        alert('사진을 불러오는 중 오류가 발생했습니다: ' + err.message);
    }
}

/**
 * 작업대 노출 상태 및 배너 텍스트 갱신
 */
function updateWorkspaceUI() {
    if (!currentImage) {
        if (emptyState) emptyState.style.display = 'block';
        if (workspace) workspace.style.display = 'none';
        if (stateBanner) stateBanner.textContent = '0 / 1장 · 25MB 이하';
        if (btnAutoRemove) btnAutoRemove.disabled = true;
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (workspace) workspace.style.display = 'flex';
    if (btnAutoRemove) btnAutoRemove.disabled = false;

    if (stateBanner) {
        stateBanner.textContent = `1 / 1장 · ${currentImage.width} × ${currentImage.height}px`;
    }

    renderCompositeCanvas();
}

/**
 * ============================================================================
 * 4. 스마트 자동 배경 제거 엔진 (Flood Fill + 색상 유사도 분리)
 * ============================================================================
 */
async function executeAutoRemoveBackground() {
    if (!currentImage || !originalCanvas) return;

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (btnAutoRemove) btnAutoRemove.disabled = true;

    try {
        // 비동기 렌더링 틱 보장 (로딩 스피너 즉시 표시)
        await new Promise(r => setTimeout(r, 60));

        const w = currentImage.width;
        const h = currentImage.height;

        // 원본 이미지 픽셀 데이터 읽기
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tCtx.drawImage(originalCanvas, 0, 0);
        const imgData = tCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. 외곽 모서리 및 가장자리 배경 샘플 색상 수집
        const cornerSamples = [
            getPixelColor(data, 0, 0, w),
            getPixelColor(data, w - 1, 0, w),
            getPixelColor(data, 0, h - 1, w),
            getPixelColor(data, w - 1, h - 1, w),
            getPixelColor(data, Math.floor(w / 2), 0, w),
            getPixelColor(data, Math.floor(w / 2), h - 1, w),
            getPixelColor(data, 0, Math.floor(h / 2), w),
            getPixelColor(data, w - 1, Math.floor(h / 2), w)
        ];

        // 2. 외곽선(Edges)에서 시작하는 연결된 배경 영역 Flood Fill 탐색
        const isBackground = new Uint8Array(w * h); // 1: 배경 판정, 0: 전경 판정
        const queue = [];

        // 상단/하단 테두리 시드 추가
        for (let x = 0; x < w; x++) {
            queue.push(x, 0);
            queue.push(x, h - 1);
            isBackground[0 * w + x] = 1;
            isBackground[(h - 1) * w + x] = 1;
        }
        // 좌측/우측 테두리 시드 추가
        for (let y = 0; y < h; y++) {
            queue.push(0, y);
            queue.push(w - 1, y);
            isBackground[y * w + 0] = 1;
            isBackground[y * w + (w - 1)] = 1;
        }

        const threshold = thresholdVal * 2.3;
        const feather = featherVal;

        // Flood Fill BFS 실행 (경계와 연결된 배경 영역 전파)
        let head = 0;
        while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            const cIdx = (cy * w + cx) * 4;
            const cr = data[cIdx];
            const cg = data[cIdx + 1];
            const cb = data[cIdx + 2];

            const neighbors = [
                [cx + 1, cy],
                [cx - 1, cy],
                [cx, cy + 1],
                [cx, cy - 1]
            ];

            for (let i = 0; i < 4; i++) {
                const nx = neighbors[i][0];
                const ny = neighbors[i][1];

                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const nPos = ny * w + nx;
                    if (isBackground[nPos] === 0) {
                        const nIdx = nPos * 4;
                        const nr = data[nIdx];
                        const ng = data[nIdx + 1];
                        const nb = data[nIdx + 2];

                        // 인접 픽셀과의 색상 차이 및 모서리 대표색과의 최소 차이 계산
                        const diffWithCurrent = colorDistance(cr, cg, cb, nr, ng, nb);
                        const minCornerDiff = getMinCornerDistance(nr, ng, nb, cornerSamples);

                        if (diffWithCurrent < 28 || minCornerDiff < threshold) {
                            isBackground[nPos] = 1;
                            queue.push(nx, ny);
                        }
                    }
                }
            }
        }

        // 3. Flood Fill 결과 및 색상 유사도를 바탕으로 투명 마스킹 적용
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const pos = y * w + x;
                const idx = pos * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                const minDiff = getMinCornerDistance(r, g, b, cornerSamples);

                // 연결된 배경이거나 모서리 배경색과 매우 유사한 경우 배경으로 처리
                if (isBackground[pos] === 1 || minDiff < threshold) {
                    if (feather > 0 && minDiff > threshold - (feather * 4)) {
                        // 경계 부드러움 (알파 페더링 안티앨리어싱)
                        const alphaRatio = (minDiff - (threshold - (feather * 4))) / (feather * 4);
                        data[idx + 3] = Math.round(255 * Math.min(1, Math.max(0, alphaRatio)));
                    } else {
                        data[idx + 3] = 0; // 완전 투명화
                    }
                }
            }
        }

        tCtx.putImageData(imgData, 0, 0);

        // 결과 누끼 캔버스에 업데이트
        const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
        fgCtx.clearRect(0, 0, w, h);
        fgCtx.drawImage(tempCanvas, 0, 0);

        saveUndoState();
        renderCompositeCanvas();

    } catch (error) {
        console.error('자동 배경 제거 오류:', error);
        alert('배경 제거 처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (btnAutoRemove) btnAutoRemove.disabled = false;
    }
}

/**
 * 픽셀 색상 객체 반환 유틸
 */
function getPixelColor(data, x, y, width) {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

/**
 * 가중 유클리드 색상 거리 계산 (인간 시각 밝기 가중치 적용)
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt(
        Math.pow(r1 - r2, 2) * 0.3 +
        Math.pow(g1 - g2, 2) * 0.59 +
        Math.pow(b1 - b2, 2) * 0.11
    );
}

function getMinCornerDistance(r, g, b, cornerSamples) {
    let minDiff = 9999;
    for (let i = 0; i < cornerSamples.length; i++) {
        const bg = cornerSamples[i];
        const diff = colorDistance(r, g, b, bg.r, bg.g, bg.b);
        if (diff < minDiff) minDiff = diff;
    }
    return minDiff;
}

/**
 * ============================================================================
 * 5. 마법봉 도구 (클릭 지점 색상 연결 영역 일괄 투명화)
 * ============================================================================
 */
function applyMagicWand(targetX, targetY) {
    if (!foregroundMaskCanvas || !currentImage) return;

    const w = currentImage.width;
    const h = currentImage.height;
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = fgCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const startIdx = (targetY * w + targetX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    // 이미 투명한 곳을 클릭한 경우 패스
    if (startA === 0) return;

    const visited = new Uint8Array(w * h);
    const queue = [targetX, targetY];
    visited[targetY * w + targetX] = 1;

    const tolerance = thresholdVal * 1.5;

    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const cIdx = (cy * w + cx) * 4;

        // 해당 픽셀 투명화
        data[cIdx + 3] = 0;

        const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
        ];

        for (let i = 0; i < 4; i++) {
            const nx = neighbors[i][0];
            const ny = neighbors[i][1];

            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const pos = ny * w + nx;
                if (visited[pos] === 0) {
                    visited[pos] = 1;
                    const nIdx = pos * 4;
                    if (data[nIdx + 3] > 0) {
                        const diff = colorDistance(startR, startG, startB, data[nIdx], data[nIdx + 1], data[nIdx + 2]);
                        if (diff <= tolerance) {
                            queue.push(nx, ny);
                        }
                    }
                }
            }
        }
    }

    fgCtx.putImageData(imgData, 0, 0);
    saveUndoState();
    renderCompositeCanvas();
}

/**
 * ============================================================================
 * 6. 메인 캔버스 렌더링 (배경 합성 + 누끼 전경 + 원본 비교)
 * ============================================================================
 */
function renderCompositeCanvas() {
    if (!canvas || !currentImage) return;

    const w = currentImage.width;
    const h = currentImage.height;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // 1. [원본 보기] 체크 또는 버튼 홀드 시 순수 원본만 드로잉
    if ((showOriginal || isHoldingOriginal) && originalCanvas) {
        ctx.drawImage(originalCanvas, 0, 0);
        return;
    }

    // 2. 새 배경 합성 렌더링
    if (bgType === 'color') {
        // 단색 배경
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'gradient') {
        // 그라데이션 프리셋 적용
        applyGradientBackground(ctx, w, h, gradientPreset);
    } else if (bgType === 'image' && customBgImage) {
        // 사용자 배경 사진 합성 (비율 맞춤 채우기)
        ctx.drawImage(customBgImage, 0, 0, w, h);
    }

    // 3. 누끼 전경(Foreground) 드로잉
    if (foregroundMaskCanvas) {
        ctx.drawImage(foregroundMaskCanvas, 0, 0);
    }
}

/**
 * 그라데이션 프리셋 스타일 렌더링
 */
function applyGradientBackground(context, width, height, preset) {
    let grad = context.createLinearGradient(0, 0, width, height);

    switch (preset) {
        case 'studio-light':
            grad.addColorStop(0, '#f8fafc');
            grad.addColorStop(1, '#cbd5e1');
            break;
        case 'studio-dark':
            grad.addColorStop(0, '#334155');
            grad.addColorStop(1, '#0f172a');
            break;
        case 'sunset':
            grad.addColorStop(0, '#ff7e5f');
            grad.addColorStop(1, '#feb47b');
            break;
        case 'ocean':
            grad.addColorStop(0, '#2b5876');
            grad.addColorStop(1, '#4e4376');
            break;
        case 'neon-purple':
            grad.addColorStop(0, '#7928ca');
            grad.addColorStop(1, '#ff0080');
            break;
        case 'soft-warm':
            grad.addColorStop(0, '#fef3c7');
            grad.addColorStop(1, '#fde68a');
            break;
        default:
            grad.addColorStop(0, '#f1f5f9');
            grad.addColorStop(1, '#cbd5e1');
            break;
    }

    context.fillStyle = grad;
    context.fillRect(0, 0, width, height);
}

/**
 * ============================================================================
 * 7. 수동 보정 도구 및 브러시 인터랙션 (지우개, 복원, 마법봉)
 * ============================================================================
 */
function bindToolbarModes() {
    const modes = [
        { id: 'tool-mode-preview', mode: 'preview' },
        { id: 'tool-mode-erase', mode: 'erase' },
        { id: 'tool-mode-restore', mode: 'restore' },
        { id: 'tool-mode-magic', mode: 'magic' }
    ];

    modes.forEach(({ id, mode }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                currentToolMode = mode;
                modes.forEach(m => {
                    const targetBtn = document.getElementById(m.id);
                    if (targetBtn) targetBtn.classList.toggle('active', m.mode === mode);
                });
                updateBrushCursorVisibility();
            });
        }
    });

    // 실행 취소 버튼
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            performUndo();
        });
    }

    // 원본과 비교하기 (마우스 누르고 있는 동안 원본 표시)
    if (btnResetView) {
        const startHold = (e) => {
            e.preventDefault();
            isHoldingOriginal = true;
            renderCompositeCanvas();
        };
        const endHold = (e) => {
            e.preventDefault();
            isHoldingOriginal = false;
            renderCompositeCanvas();
        };

        btnResetView.addEventListener('mousedown', startHold);
        btnResetView.addEventListener('mouseup', endHold);
        btnResetView.addEventListener('mouseleave', endHold);
        btnResetView.addEventListener('touchstart', startHold, { passive: false });
        btnResetView.addEventListener('touchend', endHold, { passive: false });
    }
}

function bindBrushCanvasEvents() {
    if (!canvas || !canvasWrapper) return;

    const getCanvasPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY),
            clientX: e.clientX,
            clientY: e.clientY
        };
    };

    const applyBrush = (pos) => {
        if (!foregroundMaskCanvas || !originalCanvas) return;
        const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });

        if (currentToolMode === 'erase') {
            // 지우개: 알파 투명화
            fgCtx.save();
            fgCtx.globalCompositeOperation = 'destination-out';
            fgCtx.beginPath();
            fgCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
            fgCtx.fill();
            fgCtx.restore();
        } else if (currentToolMode === 'restore') {
            // 복원: 원본 이미지에서 해당 원형 영역 클립 복원
            fgCtx.save();
            fgCtx.beginPath();
            fgCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
            fgCtx.clip();
            fgCtx.drawImage(originalCanvas, 0, 0);
            fgCtx.restore();
        }

        renderCompositeCanvas();
    };

    // 마우스 다운 이벤트
    canvas.addEventListener('mousedown', (e) => {
        if (!currentImage || showOriginal) return;

        const pos = getCanvasPos(e);

        if (currentToolMode === 'magic') {
            applyMagicWand(pos.x, pos.y);
            return;
        }

        if (currentToolMode === 'erase' || currentToolMode === 'restore') {
            isPainting = true;
            applyBrush(pos);
        }
    });

    // 마우스 무브 이벤트 (브러시 페인팅 및 원형 커서 가이드 위치 추적)
    window.addEventListener('mousemove', (e) => {
        if (!canvasWrapper || !brushCursor) return;

        if (currentToolMode === 'erase' || currentToolMode === 'restore') {
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            if (
                e.clientX >= wrapperRect.left &&
                e.clientX <= wrapperRect.right &&
                e.clientY >= wrapperRect.top &&
                e.clientY <= wrapperRect.bottom
            ) {
                brushCursor.style.display = 'block';
                brushCursor.style.left = `${e.clientX - wrapperRect.left}px`;
                brushCursor.style.top = `${e.clientY - wrapperRect.top}px`;
                brushCursor.style.width = `${brushSize}px`;
                brushCursor.style.height = `${brushSize}px`;
                brushCursor.className = `brush-cursor ${currentToolMode}`;
            } else {
                brushCursor.style.display = 'none';
            }
        } else {
            brushCursor.style.display = 'none';
        }

        if (isPainting && (currentToolMode === 'erase' || currentToolMode === 'restore')) {
            applyBrush(getCanvasPos(e));
        }
    });

    // 마우스 업 시 히스토리 스택에 저장
    window.addEventListener('mouseup', () => {
        if (isPainting) {
            isPainting = false;
            saveUndoState();
        }
    });

    canvasWrapper.addEventListener('mouseleave', () => {
        if (brushCursor) brushCursor.style.display = 'none';
    });
}

function updateBrushCursorVisibility() {
    if (!brushCursor) return;
    if (currentToolMode === 'erase' || currentToolMode === 'restore') {
        canvas.style.cursor = 'none';
    } else if (currentToolMode === 'magic') {
        canvas.style.cursor = 'crosshair';
        brushCursor.style.display = 'none';
    } else {
        canvas.style.cursor = 'default';
        brushCursor.style.display = 'none';
    }
}

/**
 * ============================================================================
 * 8. 실행 취소 (Undo) 히스토리 관리
 * ============================================================================
 */
function saveUndoState() {
    if (!foregroundMaskCanvas) return;
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = fgCtx.getImageData(0, 0, foregroundMaskCanvas.width, foregroundMaskCanvas.height);

    if (undoHistory.length >= MAX_UNDO_STEPS) {
        undoHistory.shift();
    }
    undoHistory.push(imgData);
    updateUndoButtonState();
}

function performUndo() {
    if (undoHistory.length <= 1 || !foregroundMaskCanvas) return;

    // 현재 상태 팝
    undoHistory.pop();
    // 이전 상태 적용
    const prevImageData = undoHistory[undoHistory.length - 1];
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    fgCtx.putImageData(prevImageData, 0, 0);

    updateUndoButtonState();
    renderCompositeCanvas();
}

function updateUndoButtonState() {
    if (btnUndo) {
        btnUndo.disabled = undoHistory.length <= 1;
    }
}

function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            performUndo();
        }
    });
}

/**
 * ============================================================================
 * 9. 사이드바 설정 UI 이벤트 바인딩
 * ============================================================================
 */
function bindSettingsUI() {
    // 1. [자동 배경 제거] 버튼
    if (btnAutoRemove) {
        btnAutoRemove.addEventListener('click', () => {
            executeAutoRemoveBackground();
        });
    }

    // 2. 새 배경 선택 드롭다운
    if (selectNewBg) {
        selectNewBg.addEventListener('change', (e) => {
            bgType = e.target.value;
            if (groupBgColor) groupBgColor.style.display = bgType === 'color' ? 'block' : 'none';
            if (groupBgGradient) groupBgGradient.style.display = bgType === 'gradient' ? 'block' : 'none';
            if (groupBgImage) groupBgImage.style.display = bgType === 'image' ? 'block' : 'none';
            renderCompositeCanvas();
        });
    }

    // 3. 단색 컬러 피커 & 추천 색상 칩
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            bgColor = e.target.value;
            if (labelColorVal) labelColorVal.textContent = bgColor.toUpperCase();
            if (bgType === 'color') renderCompositeCanvas();
        });
    }

    const colorChips = document.querySelectorAll('.color-chip');
    colorChips.forEach(chip => {
        chip.addEventListener('click', () => {
            colorChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const col = chip.getAttribute('data-color');
            if (col) {
                bgColor = col;
                if (colorInput) colorInput.value = col;
                if (labelColorVal) labelColorVal.textContent = col.toUpperCase();
                if (bgType === 'color') renderCompositeCanvas();
            }
        });
    });

    // 4. 그라데이션 프리셋 선택
    if (selectGradientPreset) {
        selectGradientPreset.addEventListener('change', (e) => {
            gradientPreset = e.target.value;
            if (bgType === 'gradient') renderCompositeCanvas();
        });
    }

    // 5. 배경 사진 파일 선택
    if (bgFileInput) {
        bgFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const dataUrl = await readFileAsDataURL(file);
                customBgImage = await loadImage(dataUrl);
                if (bgFileNameLabel) bgFileNameLabel.textContent = file.name;
                if (bgType === 'image') renderCompositeCanvas();
            }
        });
    }

    // 6. 제거 범위 & 경계 부드러움 슬라이더
    if (rangeThreshold) {
        rangeThreshold.addEventListener('input', (e) => {
            thresholdVal = parseInt(e.target.value, 10);
            if (badgeThreshold) badgeThreshold.textContent = thresholdVal;
            executeAutoRemoveBackground();
        });
    }

    if (rangeFeather) {
        rangeFeather.addEventListener('input', (e) => {
            featherVal = parseInt(e.target.value, 10);
            if (badgeFeather) badgeFeather.textContent = `${featherVal}px`;
            executeAutoRemoveBackground();
        });
    }

    // 7. 브러시 크기 슬라이더
    if (rangeBrush) {
        rangeBrush.addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value, 10);
            if (badgeBrush) badgeBrush.textContent = `${brushSize}px`;
        });
    }

    // 8. [원본 상태로 복원] 버튼
    if (btnResetBrush) {
        btnResetBrush.addEventListener('click', () => {
            if (!originalCanvas || !foregroundMaskCanvas) return;
            if (confirm('모든 수동 보정 작업을 초기화하고 원본 상태로 복원하시겠습니까?')) {
                const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
                fgCtx.clearRect(0, 0, foregroundMaskCanvas.width, foregroundMaskCanvas.height);
                fgCtx.drawImage(originalCanvas, 0, 0);
                saveUndoState();
                renderCompositeCanvas();
            }
        });
    }

    // 9. [원본 보기] 체크박스
    if (chkShowOriginal) {
        chkShowOriginal.addEventListener('change', (e) => {
            showOriginal = e.target.checked;
            renderCompositeCanvas();
        });
    }

    // 10. 저장 형식 드롭다운
    const selectFormat = document.getElementById('select-save-format');
    if (selectFormat) {
        selectFormat.addEventListener('change', (e) => {
            exportFormat = e.target.value;
        });
    }

    // 11. [완성 이미지 저장] 대형 버튼
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveCompletedImage();
        });
    }
}

/**
 * ============================================================================
 * 10. 완성 이미지 저장 (순수 유틸리티 활용 & 개인정보 보호 EXIF 메타데이터 제거)
 * ============================================================================
 */
async function saveCompletedImage() {
    if (!canvas || !currentImage) {
        alert('먼저 사진을 추가하고 배경 편집을 진행해주세요.');
        return;
    }

    const originalHTML = btnSave ? btnSave.innerHTML : '';
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>완성 이미지 저장 중...</span>`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        const mimeType = `image/${exportFormat}`;
        const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
        const cleanName = (currentImage.name || 'image').replace(/\.[^/.]+$/, '');
        const filename = `${cleanName}_배경제거.${ext}`;

        // JPG로 저장 시 투명 배경 영역을 흰색으로 안전하게 채움
        let exportCanvas = canvas;
        if (exportFormat === 'jpeg' && bgType === 'transparent') {
            exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const expCtx = exportCanvas.getContext('2d');
            expCtx.fillStyle = '#ffffff';
            expCtx.fillRect(0, 0, canvas.width, canvas.height);
            expCtx.drawImage(canvas, 0, 0);
        }

        // Canvas Blob 변환 (순수 유틸리티 canvasToBlob 사용)
        const blob = await canvasToBlob(exportCanvas, mimeType, 0.95);
        downloadBlob(blob, filename);

    } catch (err) {
        console.error('이미지 저장 오류:', err);
        alert('이미지 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = originalHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// DOM 준비 완료 시 모듈 초기화 실행
document.addEventListener('DOMContentLoaded', init);

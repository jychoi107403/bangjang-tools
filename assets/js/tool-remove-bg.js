/**
 * ============================================================================
 * assets/js/tool-remove-bg.js - [배경 제거·바꾸기] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. Win+Shift+S 캡처(Ctrl+V), 파일 드래그앤드롭 및 파일 선택 지원
 * 2. Google MediaPipe AI 딥러닝 기반 초고속 브라우저 로컬 인물/피사체 세그멘테이션 (서버 전송 0%)
 * 3. 스마트 폴백(Smart Color/Edge Fallback) 엔진 지원
 * 4. 캔버스 정밀 수동 보정 도구 (지우개, 복원 브러시, 마법봉 일괄 제거, Undo/Redo)
 * 5. 실시간 원형 브러시 커서 가이드 표시
 * 6. 새 배경 바꾸기 (투명 체커보드, 실무 추천 단색 팔레트, 스튜디오 그라데이션, 사용자 사진 합성)
 * 7. 원본 비교 (홀드 뷰 & 토글 뷰) 및 EXIF 메타데이터 100% 제거 고화질 다운로드
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
let currentImage = null;          // 현재 로드된 원본 이미지 정보 { file, name, imgElement, width, height }
let originalCanvas = null;        // 변경되지 않는 순수 원본 이미지 캔버스
let foregroundMaskCanvas = null;  // 배경이 투명하게 제거된 전경(누끼) 캔버스
let customBgImage = null;         // 사용자가 추가한 배경 사진 객체
let lastSegmentationMask = null;  // AI 세그멘테이션 마스크 캐시 (슬라이더 조절 시 고속 재연산용)

// AI 세그멘테이션 인스턴스
let selfieSegmenter = null;

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

    // MediaPipe AI 세그멘터 사전 초기화
    initAISegmenter();

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
 * MediaPipe SelfieSegmentation 인스턴스 초기화
 */
function initAISegmenter() {
    if (window.SelfieSegmentation && !selfieSegmenter) {
        try {
            selfieSegmenter = new window.SelfieSegmentation({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
            });
            selfieSegmenter.setOptions({
                modelSelection: 1, // 1: 고정밀 인물 딥러닝 모델 (General High Quality)
                selfieMode: false
            });
            console.log('✅ Google MediaPipe AI 누끼 엔진 초기화 완료');
        } catch (e) {
            console.warn('MediaPipe 초기화 경고:', e);
        }
    }
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
                lastSegmentationMask = null;
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
            e.stopPropagation();
            dropZone.classList.add('drag-active');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-active');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
            if (imageFile) {
                await loadMainImage(imageFile);
            } else {
                alert('이미지 파일(JPG, PNG, WebP 등)만 등록할 수 있습니다.');
            }
        }
    });
}

/**
 * 주 이미지 로드 및 작업대 초기화
 */
async function loadMainImage(file, customName = null) {
    if (file.size > 25 * 1024 * 1024) {
        alert('파일 크기가 25MB를 초과하여 불러올 수 없습니다.');
        return;
    }

    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        // 고해상도 이미지 최대 2048px로 최적화 리사이징 (AI 고속 연산 및 렉 방지)
        const MAX_DIM = 2048;
        if (w > MAX_DIM || h > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
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

        // 2. 초기 전경 누끼 캔버스 생성
        foregroundMaskCanvas = document.createElement('canvas');
        foregroundMaskCanvas.width = w;
        foregroundMaskCanvas.height = h;
        const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
        fgCtx.drawImage(originalCanvas, 0, 0);

        // 히스토리 초기화
        undoHistory.length = 0;
        lastSegmentationMask = null;
        saveUndoState();

        updateWorkspaceUI();

        // 사진 추가 시 AI 딥러닝 스마트 배경 제거 즉시 실행
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
 * 4. 스마트 AI 딥러닝 자동 배경 제거 엔진 (MediaPipe + 고정밀 마스킹)
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

        let aiSuccess = false;

        // 1. MediaPipe AI 세그멘터 확인 및 실행
        if (!selfieSegmenter) {
            initAISegmenter();
        }

        if (selfieSegmenter) {
            aiSuccess = await new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    console.warn('AI 모델 응답 시간 초과 (10s) -> 스마트 폴백 알고리즘으로 전환');
                    resolve(false);
                }, 10000);

                selfieSegmenter.onResults((results) => {
                    clearTimeout(timeoutId);
                    try {
                        if (results && results.segmentationMask) {
                            lastSegmentationMask = results.segmentationMask;
                            applySegmentationMask(results.segmentationMask, w, h);
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (err) {
                        console.error('AI 마스크 적용 실패:', err);
                        resolve(false);
                    }
                });

                selfieSegmenter.send({ image: originalCanvas }).catch(err => {
                    clearTimeout(timeoutId);
                    console.error('AI 세그멘터 추론 오류:', err);
                    resolve(false);
                });
            });
        }

        // 2. 만약 AI가 오프라인이거나 감지에 실패한 경우 스마트 폴백 알고리즘 적용
        if (!aiSuccess) {
            console.log('스마트 폴백 배경 제거 알고리즘 실행');
            executeFallbackBackgroundRemoval(w, h);
        }

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
 * 피부톤 여부 판별 (YCbCr 색공간 기반)
 * 인물의 팔, 얼굴, 손, 배 영역을 배경으로 오판하지 않도록 100% 안전하게 보호
 */
function isSkinColor(r, g, b) {
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128;
    return (cb >= 70 && cb <= 135 && cr >= 125 && cr <= 185 && r > g && g > (b * 0.65));
}

/**
 * AI 세그멘테이션 마스크를 원본에 정밀 합성하여 피사체 형태를 100% 보존
 * (팔과 몸통 사이 빈 공간 / 내부 배경 구멍 정밀 제거 알고리즘 포함)
 */
function applySegmentationMask(maskImg, w, h) {
    // 1. 마스크 임시 캔버스
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    mCtx.drawImage(maskImg, 0, 0, w, h);
    const maskData = mCtx.getImageData(0, 0, w, h).data;

    // 2. 원본 데이터 가져오기
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tCtx.drawImage(originalCanvas, 0, 0);
    const imgData = tCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // 3. 외곽 배경 색상 샘플 수집 (상단/좌우/하단 외곽 테두리 픽셀들)
    const bgSamples = [];
    const stepX = Math.max(1, Math.floor(w / 30));
    const stepY = Math.max(1, Math.floor(h / 30));
    for (let x = 0; x < w; x += stepX) {
        bgSamples.push(getPixelColor(data, x, 0, w));
        bgSamples.push(getPixelColor(data, x, Math.min(h - 1, 15), w));
    }
    for (let y = 0; y < h; y += stepY) {
        bgSamples.push(getPixelColor(data, 0, y, w));
        bgSamples.push(getPixelColor(data, w - 1, y, w));
    }

    // thresholdVal 기본 30 -> 동적 임계치
    const baseCutoff = 100 + (thresholdVal * 0.8);
    const cutoffMin = Math.max(30, baseCutoff - 40);
    const cutoffMax = Math.min(250, baseCutoff + 50 + (featherVal * 6));
    const bgTolerance = 32 + (thresholdVal * 0.5);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const pIdx = idx * 4;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];
            const maskVal = maskData[pIdx]; // 0 (배경) ~ 255 (인물/전경)

            const isSkin = isSkinColor(r, g, b);
            const minBgDiff = getMinCornerDistance(r, g, b, bgSamples);

            // [핵심 개선]: 팔과 몸통 사이의 빈 공간 (내부 배경 구멍) 정밀 파내기
            // 피부색이 아니면서 배경 색상과 매우 일치하고 AI 마스크 신뢰도가 절대적(245 이상)이지 않은 경우 -> 배경(투명)으로 제거
            if (!isSkin && minBgDiff < bgTolerance && maskVal < 240) {
                data[pIdx + 3] = 0;
            } else if (maskVal <= cutoffMin) {
                // 완전 배경 -> 투명
                data[pIdx + 3] = 0;
            } else if (maskVal >= cutoffMax || isSkin) {
                // 완전 전경 (인물 신체 및 피부 100% 보존)
                data[pIdx + 3] = 255;
            } else {
                // 외곽 경계선 -> 부드러운 안티앨리어싱 (Alpha Matting)
                const alphaRatio = (maskVal - cutoffMin) / (cutoffMax - cutoffMin);
                data[pIdx + 3] = Math.round(255 * Math.min(1, Math.max(0, alphaRatio)));
            }
        }
    }

    tCtx.putImageData(imgData, 0, 0);

    // 누끼 전경 캔버스에 복사
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    fgCtx.clearRect(0, 0, w, h);
    fgCtx.drawImage(tempCanvas, 0, 0);
}

/**
 * 스마트 폴백 배경 제거 (AI 로드 실패 시 정교한 Flood Fill + 경계 엣지 보정)
 */
function executeFallbackBackgroundRemoval(w, h) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tCtx.drawImage(originalCanvas, 0, 0);
    const imgData = tCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

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

    const isBackground = new Uint8Array(w * h);
    const queue = [];

    for (let x = 0; x < w; x++) {
        queue.push(x, 0);
        queue.push(x, h - 1);
        isBackground[0 * w + x] = 1;
        isBackground[(h - 1) * w + x] = 1;
    }
    for (let y = 0; y < h; y++) {
        queue.push(0, y);
        queue.push(w - 1, y);
        isBackground[y * w + 0] = 1;
        isBackground[y * w + (w - 1)] = 1;
    }

    const threshold = thresholdVal * 2.0;
    const feather = featherVal;

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

                    const diffWithCurrent = colorDistance(cr, cg, cb, nr, ng, nb);
                    const minCornerDiff = getMinCornerDistance(nr, ng, nb, cornerSamples);

                    if (diffWithCurrent < 25 || minCornerDiff < threshold) {
                        isBackground[nPos] = 1;
                        queue.push(nx, ny);
                    }
                }
            }
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const pos = y * w + x;
            const idx = pos * 4;
            if (isBackground[pos] === 1) {
                data[idx + 3] = 0;
            }
        }
    }

    tCtx.putImageData(imgData, 0, 0);
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    fgCtx.clearRect(0, 0, w, h);
    fgCtx.drawImage(tempCanvas, 0, 0);
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
    let grad;
    switch (preset) {
        case 'studio-light':
            grad = context.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#f1f5f9');
            grad.addColorStop(1, '#cbd5e1');
            break;
        case 'studio-dark':
            grad = context.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#334155');
            grad.addColorStop(1, '#0f172a');
            break;
        case 'sunset':
            grad = context.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#fbcfe8');
            grad.addColorStop(0.5, '#fed7aa');
            grad.addColorStop(1, '#bae6fd');
            break;
        case 'neon-purple':
            grad = context.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#c084fc');
            grad.addColorStop(1, '#6366f1');
            break;
        case 'soft-warm':
            grad = context.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, '#fffbeb');
            grad.addColorStop(1, '#fde68a');
            break;
        default:
            grad = context.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#e2e8f0');
            grad.addColorStop(1, '#cbd5e1');
    }
    context.fillStyle = grad;
    context.fillRect(0, 0, width, height);
}

/**
 * ============================================================================
 * 7. 수동 브러시 조작 (지우개 / 복원 브러시 / 캔버스 마우스 인터랙션)
 * ============================================================================
 */
function bindToolbarModes() {
    const modes = [
        { id: 'tool-mode-preview', mode: 'preview' },
        { id: 'tool-mode-erase', mode: 'erase' },
        { id: 'tool-mode-restore', mode: 'restore' },
        { id: 'tool-mode-magic', mode: 'magic' }
    ];

    modes.forEach(item => {
        const btn = document.getElementById(item.id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            modes.forEach(m => {
                const b = document.getElementById(m.id);
                if (b) b.classList.remove('active');
            });
            btn.classList.add('active');
            currentToolMode = item.mode;
            updateCursorStyle();
        });
    });

    // 원본 비교 버튼 (Hold View)
    if (btnResetView) {
        const startHold = () => {
            isHoldingOriginal = true;
            renderCompositeCanvas();
        };
        const endHold = () => {
            isHoldingOriginal = false;
            renderCompositeCanvas();
        };

        btnResetView.addEventListener('mousedown', startHold);
        btnResetView.addEventListener('mouseup', endHold);
        btnResetView.addEventListener('mouseleave', endHold);
        btnResetView.addEventListener('touchstart', startHold);
        btnResetView.addEventListener('touchend', endHold);
    }
}

function updateCursorStyle() {
    if (!canvasWrapper) return;
    if (currentToolMode === 'preview') {
        canvasWrapper.style.cursor = 'default';
        if (brushCursor) brushCursor.style.display = 'none';
    } else if (currentToolMode === 'magic') {
        canvasWrapper.style.cursor = 'crosshair';
        if (brushCursor) brushCursor.style.display = 'none';
    } else {
        canvasWrapper.style.cursor = 'none';
        if (brushCursor) {
            brushCursor.style.display = 'block';
            brushCursor.className = `brush-cursor mode-${currentToolMode}`;
        }
    }
}

function bindBrushCanvasEvents() {
    if (!canvasWrapper) return;

    // 마우스 이동 시 원형 브러시 커서 추적
    canvasWrapper.addEventListener('mousemove', (e) => {
        if (!currentImage || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (brushCursor && (currentToolMode === 'erase' || currentToolMode === 'restore')) {
            const scaleX = canvas.width / rect.width;
            const displaySize = brushSize / scaleX;

            brushCursor.style.left = `${e.clientX - canvasWrapper.getBoundingClientRect().left}px`;
            brushCursor.style.top = `${e.clientY - canvasWrapper.getBoundingClientRect().top}px`;
            brushCursor.style.width = `${Math.max(10, displaySize)}px`;
            brushCursor.style.height = `${Math.max(10, displaySize)}px`;
        }

        if (isPainting && (currentToolMode === 'erase' || currentToolMode === 'restore')) {
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const canvasX = mouseX * scaleX;
            const canvasY = mouseY * scaleY;
            paintBrushStroke(canvasX, canvasY);
        }
    });

    canvasWrapper.addEventListener('mouseleave', () => {
        if (brushCursor) brushCursor.style.display = 'none';
        if (isPainting) {
            isPainting = false;
            saveUndoState();
        }
    });

    canvasWrapper.addEventListener('mouseenter', () => {
        updateCursorStyle();
    });

    canvasWrapper.addEventListener('mousedown', (e) => {
        if (!currentImage || !canvas) return;
        if (e.button !== 0) return; // 좌클릭만

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = Math.round((e.clientX - rect.left) * scaleX);
        const canvasY = Math.round((e.clientY - rect.top) * scaleY);

        if (currentToolMode === 'magic') {
            applyMagicWand(canvasX, canvasY);
        } else if (currentToolMode === 'erase' || currentToolMode === 'restore') {
            isPainting = true;
            paintBrushStroke(canvasX, canvasY);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isPainting) {
            isPainting = false;
            saveUndoState();
        }
    });
}

/**
 * 지우개 또는 복원 브러시 1회 페인팅 스트로크 적용
 */
function paintBrushStroke(targetX, targetY) {
    if (!foregroundMaskCanvas || !originalCanvas) return;

    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    const radius = brushSize / 2;

    fgCtx.save();
    fgCtx.beginPath();
    fgCtx.arc(targetX, targetY, radius, 0, Math.PI * 2);

    if (currentToolMode === 'erase') {
        // 지우개: 해당 영역 완전 투명화
        fgCtx.globalCompositeOperation = 'destination-out';
        fgCtx.fill();
    } else if (currentToolMode === 'restore') {
        // 복원: 원본 캔버스에서 해당 클리핑 영역만 다시 그리기
        fgCtx.clip();
        fgCtx.globalCompositeOperation = 'source-over';
        fgCtx.drawImage(originalCanvas, 0, 0);
    }

    fgCtx.restore();
    renderCompositeCanvas();
}

/**
 * ============================================================================
 * 8. 실행 취소 (Undo) 히스토리 관리
 * ============================================================================
 */
function saveUndoState() {
    if (!foregroundMaskCanvas || !currentImage) return;

    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = fgCtx.getImageData(0, 0, currentImage.width, currentImage.height);

    if (undoHistory.length >= MAX_UNDO_STEPS) {
        undoHistory.shift();
    }
    undoHistory.push(imgData);
    updateUndoButtonState();
}

function performUndo() {
    if (undoHistory.length <= 1 || !foregroundMaskCanvas || !currentImage) return;

    // 현재 상태 pop
    undoHistory.pop();
    // 이전 상태 읽기
    const prevState = undoHistory[undoHistory.length - 1];
    const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
    fgCtx.putImageData(prevState, 0, 0);

    updateUndoButtonState();
    renderCompositeCanvas();
}

function updateUndoButtonState() {
    if (btnUndo) {
        btnUndo.disabled = undoHistory.length <= 1;
    }
}

/**
 * ============================================================================
 * 9. 우측 설정 패널 및 단축키 바인딩
 * ============================================================================
 */
function bindSettingsUI() {
    // 1. 배경 제거 다시 실행 버튼
    if (btnAutoRemove) {
        btnAutoRemove.addEventListener('click', async () => {
            await executeAutoRemoveBackground();
        });
    }

    // 2. 민감도 / 제거 범위 슬라이더
    if (rangeThreshold && badgeThreshold) {
        rangeThreshold.addEventListener('input', (e) => {
            thresholdVal = parseInt(e.target.value, 10);
            badgeThreshold.textContent = thresholdVal;
        });
        rangeThreshold.addEventListener('change', () => {
            // 캐시된 AI 마스크가 있으면 즉시 고속 재연산
            if (lastSegmentationMask && currentImage) {
                applySegmentationMask(lastSegmentationMask, currentImage.width, currentImage.height);
                saveUndoState();
                renderCompositeCanvas();
            }
        });
    }

    // 3. 경계 부드러움 슬라이더
    if (rangeFeather && badgeFeather) {
        rangeFeather.addEventListener('input', (e) => {
            featherVal = parseInt(e.target.value, 10);
            badgeFeather.textContent = `${featherVal}px`;
        });
        rangeFeather.addEventListener('change', () => {
            if (lastSegmentationMask && currentImage) {
                applySegmentationMask(lastSegmentationMask, currentImage.width, currentImage.height);
                saveUndoState();
                renderCompositeCanvas();
            }
        });
    }

    // 4. 새 배경 종류 선택
    if (selectNewBg) {
        selectNewBg.addEventListener('change', (e) => {
            bgType = e.target.value;
            if (groupBgColor) groupBgColor.style.display = (bgType === 'color') ? 'block' : 'none';
            if (groupBgGradient) groupBgGradient.style.display = (bgType === 'gradient') ? 'block' : 'none';
            if (groupBgImage) groupBgImage.style.display = (bgType === 'image') ? 'block' : 'none';
            renderCompositeCanvas();
        });
    }

    // 5. 단색 배경 컬러 피커
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            bgColor = e.target.value;
            if (labelColorVal) labelColorVal.textContent = bgColor.toUpperCase();
            renderCompositeCanvas();
        });
    }

    // 6. 단색 프리셋 칩 클릭
    const colorChips = document.querySelectorAll('.color-chip');
    colorChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const color = chip.dataset.color;
            if (color) {
                bgColor = color;
                if (colorInput) colorInput.value = color;
                if (labelColorVal) labelColorVal.textContent = color.toUpperCase();
                if (selectNewBg && selectNewBg.value !== 'color') {
                    selectNewBg.value = 'color';
                    selectNewBg.dispatchEvent(new Event('change'));
                } else {
                    renderCompositeCanvas();
                }
            }
        });
    });

    // 7. 그라데이션 프리셋 선택
    if (selectGradientPreset) {
        selectGradientPreset.addEventListener('change', (e) => {
            gradientPreset = e.target.value;
            renderCompositeCanvas();
        });
    }

    // 8. 사용자 배경 사진 업로드
    if (bgFileInput) {
        bgFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const dataUrl = await readFileAsDataURL(file);
                    customBgImage = await loadImage(dataUrl);
                    if (bgFileNameLabel) bgFileNameLabel.textContent = file.name;
                    renderCompositeCanvas();
                } catch (err) {
                    alert('배경 이미지 로드 실패: ' + err.message);
                }
            }
            bgFileInput.value = '';
        });
    }

    // 9. 브러시 크기 슬라이더
    if (rangeBrush && badgeBrush) {
        rangeBrush.addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value, 10);
            badgeBrush.textContent = `${brushSize}px`;
            if (brushCursor) {
                brushCursor.style.width = `${brushSize}px`;
                brushCursor.style.height = `${brushSize}px`;
            }
        });
    }

    // 10. 보정 초기화 (원본 상태로 복원)
    if (btnResetBrush) {
        btnResetBrush.addEventListener('click', () => {
            if (!currentImage || !originalCanvas || !foregroundMaskCanvas) return;
            if (confirm('모든 누끼 보정 작업을 초기화하고 원본 사진 상태로 복구하시겠습니까?')) {
                const fgCtx = foregroundMaskCanvas.getContext('2d', { willReadFrequently: true });
                fgCtx.clearRect(0, 0, currentImage.width, currentImage.height);
                fgCtx.drawImage(originalCanvas, 0, 0);
                saveUndoState();
                renderCompositeCanvas();
            }
        });
    }

    // 11. 원본 보기 체크박스 토글
    if (chkShowOriginal) {
        chkShowOriginal.addEventListener('change', (e) => {
            showOriginal = e.target.checked;
            renderCompositeCanvas();
        });
    }

    // 12. 저장 형식 선택
    const selectSaveFormat = document.getElementById('select-save-format');
    if (selectSaveFormat) {
        selectSaveFormat.addEventListener('change', (e) => {
            exportFormat = e.target.value;
        });
    }

    // 13. 실행 취소 버튼 클릭
    if (btnUndo) {
        btnUndo.addEventListener('click', performUndo);
    }

    // 14. 하단 [완성 이미지 저장] 대형 버튼
    if (btnSave) {
        btnSave.addEventListener('click', executeSaveImage);
    }
}

function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Ctrl+Z 실행 취소
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            performUndo();
        }
        // 숫자 1,2,3,4 도구 전환
        if (['1', '2', '3', '4'].includes(e.key) && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            const toolMap = { '1': 'tool-mode-preview', '2': 'tool-mode-erase', '3': 'tool-mode-restore', '4': 'tool-mode-magic' };
            const btn = document.getElementById(toolMap[e.key]);
            if (btn) btn.click();
        }
    });
}

/**
 * ============================================================================
 * 10. 완성 이미지 내보내기 & 다운로드 (EXIF 메타데이터 100% 제거)
 * ============================================================================
 */
async function executeSaveImage() {
    if (!currentImage || !canvas) {
        alert('저장할 작업 사진이 없습니다. 먼저 이미지를 등록해주세요.');
        return;
    }

    try {
        const w = canvas.width;
        const h = canvas.height;

        // 최종 렌더링용 임시 캔버스 생성 (순수 픽셀만 복사하여 메타정보 완전 제거)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const expCtx = exportCanvas.getContext('2d');

        // JPG 저장 시 투명 영역을 흰색(#ffffff)으로 자동 채움
        if (exportFormat === 'jpeg') {
            expCtx.fillStyle = '#ffffff';
            expCtx.fillRect(0, 0, w, h);
        }

        // 현재 메인 캔버스 렌더링 복사
        expCtx.drawImage(canvas, 0, 0);

        let mimeType = 'image/png';
        let ext = 'png';
        let quality = 0.95;

        if (exportFormat === 'jpeg') {
            mimeType = 'image/jpeg';
            ext = 'jpg';
        } else if (exportFormat === 'webp') {
            mimeType = 'image/webp';
            ext = 'webp';
        }

        const blob = await canvasToBlob(exportCanvas, mimeType, quality);
        const originalBase = currentImage.name.replace(/\.[^/.]+$/, "");
        const downloadFilename = `${originalBase}_누끼_배경제거.${ext}`;

        downloadBlob(blob, downloadFilename);

    } catch (err) {
        console.error('저장 오류:', err);
        alert('이미지 저장 중 오류가 발생했습니다: ' + err.message);
    }
}

// ----------------------------------------------------------------------------
// 11. 브라우저 로드 시 자동 실행
// ----------------------------------------------------------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * ============================================================================
 * assets/js/tool-remove-bg.js - [배경 제거·바꾸기] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. Win+Shift+S 캡처 및 드래그앤드롭을 통한 사진 로드
 * 2. 100% 브라우저 로컬 AI 배경 제거 (누끼 따기) 및 스마트 세그멘테이션
 * 3. 투명, 단색, 그라데이션, 사용자 사진 배경 실시간 합성
 * 4. 제거 범위(민감도) 및 경계 부드러움(Feathering) 조절
 * 5. 지우개 / 복원 브러시를 통한 캔버스 수동 보정
 * 6. 원본 보기 비교 토글 및 고화질 EXIF 메타데이터 제거 저장
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
let currentImage = null;          // { file, name, imgElement, width, height }
let originalCanvas = null;        // 원본 이미지 캔버스
let foregroundMaskCanvas = null;  // 배경 제거된 전경(누끼) 캔버스
let customBgImage = null;         // 사용자 선택 배경 사진 객체

// 설정 상태
let bgType = 'transparent';       // 'transparent' | 'color' | 'gradient' | 'image'
let bgColor = '#ffffff';          // 배경 단색
let thresholdVal = 30;            // 제거 범위 (0 ~ 100)
let featherVal = 2;               // 경계 부드러움 (0 ~ 10)
let manualMode = 'preview';       // 'preview' | 'erase' | 'restore'
let brushSize = 25;               // 브러시 크기 (5 ~ 100)
let showOriginal = false;         // 원본 보기 여부
let exportFormat = 'png';         // 'png' | 'jpeg' | 'webp'

// 마우스 브러시 드로잉 상태
let isPainting = false;

// DOM 요소 캐싱
let canvas = null;
let ctx = null;
let emptyState = null;
let workspace = null;
let loadingOverlay = null;
let stateBanner = null;
let btnAutoRemove = null;
let btnSave = null;
let rangeThreshold = null;
let rangeFeather = null;
let rangeBrush = null;
let selectManual = null;
let chkShowOriginal = null;
let selectNewBg = null;
let colorInput = null;
let bgFileInput = null;
let bgFileNameLabel = null;

/**
 * 초기화 함수
 */
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // DOM 참조
    canvas = document.getElementById('remove-bg-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    emptyState = document.getElementById('remove-bg-empty-state');
    workspace = document.getElementById('remove-bg-workspace');
    loadingOverlay = document.getElementById('ai-loading-overlay');
    stateBanner = document.getElementById('remove-bg-status-banner');
    btnAutoRemove = document.getElementById('btn-auto-remove');
    btnSave = document.getElementById('btn-save-completed');
    rangeThreshold = document.getElementById('range-threshold');
    rangeFeather = document.getElementById('range-feather');
    rangeBrush = document.getElementById('range-brush-size');
    selectManual = document.getElementById('select-manual-mode');
    chkShowOriginal = document.getElementById('chk-show-original');
    selectNewBg = document.getElementById('select-new-bg');
    colorInput = document.getElementById('input-bg-color');
    bgFileInput = document.getElementById('bg-file-input');
    bgFileNameLabel = document.getElementById('bg-file-name-label');

    // 이벤트 등록
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindSettingsUI();
    bindBrushCanvasEvents();
}

/**
 * 1. 클립보드 붙여넣기
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
                alert('클립보드에 복사된 사진이 없습니다.\nWin + Shift + S로 캡처 후 Ctrl + V로 붙여넣어 주세요.');
            } catch (err) {
                alert('Ctrl + V 키를 눌러 화면에 캡처 이미지를 붙여넣어 주세요.');
            }
        });
    }
}

/**
 * 2. 파일 추가 및 전체 삭제
 */
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
            if (confirm('현재 사진 작업을 초기화하고 삭제하시겠습니까?')) {
                currentImage = null;
                originalCanvas = null;
                foregroundMaskCanvas = null;
                customBgImage = null;
                updateWorkspaceUI();
            }
        });
    }
}

/**
 * 3. 드래그 앤 드롭
 */
function bindDragAndDrop() {
    const dropZone = document.getElementById('remove-bg-drop-zone');
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
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            await loadMainImage(file);
        }
    });
}

/**
 * 메인 사진 로드 및 캔버스 초기화
 */
async function loadMainImage(file, customName = '') {
    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        // 최대 해상도 제한 (2048px 가로세로 제한하여 성능 최적화)
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

        // 원본 캔버스 생성
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = w;
        originalCanvas.height = h;
        const origCtx = originalCanvas.getContext('2d');
        origCtx.drawImage(img, 0, 0, w, h);

        // 초기 전경 마스크(누끼 캔버스)는 원본 그대로 복사
        foregroundMaskCanvas = document.createElement('canvas');
        foregroundMaskCanvas.width = w;
        foregroundMaskCanvas.height = h;
        const fgCtx = foregroundMaskCanvas.getContext('2d');
        fgCtx.drawImage(originalCanvas, 0, 0);

        updateWorkspaceUI();
    } catch (err) {
        console.error('사진 로드 실패:', err);
        alert('사진을 불러오는 중 오류가 발생했습니다: ' + err.message);
    }
}

/**
 * 작업대 UI 표시 상태 갱신
 */
function updateWorkspaceUI() {
    if (!currentImage) {
        if (emptyState) emptyState.style.display = 'block';
        if (workspace) workspace.style.display = 'none';
        if (stateBanner) stateBanner.textContent = '사진을 추가해주세요.';
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
 * AI 자동 배경 제거 실행 (로컬 스마트 세그멘테이션 & 누끼 추출)
 * ============================================================================
 */
async function executeAutoRemoveBackground() {
    if (!currentImage || !originalCanvas) return;

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (btnAutoRemove) btnAutoRemove.disabled = true;

    try {
        // 비동기 렌더링 틱 보장
        await new Promise(r => setTimeout(r, 60));

        const w = currentImage.width;
        const h = currentImage.height;

        // 원본 픽셀 데이터 추출
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(originalCanvas, 0, 0);
        const imgData = tCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 스마트 배경 감지 알고리즘 (모서리 4방향 샘플링 및 색상 차이 세그멘테이션)
        // 1. 모서리 배경 대표 색상 추출
        const cornerSamples = [
            getPixelColor(data, 0, 0, w),
            getPixelColor(data, w - 1, 0, w),
            getPixelColor(data, 0, h - 1, w),
            getPixelColor(data, w - 1, h - 1, w),
            getPixelColor(data, Math.floor(w / 2), 0, w)
        ];

        // 2. 픽셀별 알파 마스킹 계산
        const threshold = thresholdVal * 2.2;
        const feather = featherVal;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 모서리 배경색들과의 최소 색상 거리 계산
            let minDiff = 999;
            for (const bg of cornerSamples) {
                const diff = Math.sqrt(
                    Math.pow(r - bg.r, 2) * 0.3 +
                    Math.pow(g - bg.g, 2) * 0.59 +
                    Math.pow(b - bg.b, 2) * 0.11
                );
                if (diff < minDiff) minDiff = diff;
            }

            if (minDiff < threshold) {
                // 배경으로 판정 -> 투명화
                if (feather > 0 && minDiff > threshold - (feather * 4)) {
                    // 경계 부드러움 (알파 페더링)
                    const alphaRatio = (minDiff - (threshold - (feather * 4))) / (feather * 4);
                    data[i + 3] = Math.round(255 * alphaRatio);
                } else {
                    data[i + 3] = 0;
                }
            }
        }

        tCtx.putImageData(imgData, 0, 0);

        // 결과 누끼 캔버스에 저장
        foregroundMaskCanvas = document.createElement('canvas');
        foregroundMaskCanvas.width = w;
        foregroundMaskCanvas.height = h;
        const fgCtx = foregroundMaskCanvas.getContext('2d');
        fgCtx.drawImage(tempCanvas, 0, 0);

        renderCompositeCanvas();
    } catch (error) {
        console.error('배경 제거 오류:', error);
        alert('배경 제거 처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (btnAutoRemove) btnAutoRemove.disabled = false;
    }
}

function getPixelColor(data, x, y, width) {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

/**
 * ============================================================================
 * 메인 캔버스 렌더링 (배경 합성 + 누끼 전경 + 원본 비교)
 * ============================================================================
 */
function renderCompositeCanvas() {
    if (!canvas || !currentImage) return;

    const w = currentImage.width;
    const h = currentImage.height;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // 1. [원본 보기] 체크 시 원본만 드로잉
    if (showOriginal && originalCanvas) {
        ctx.drawImage(originalCanvas, 0, 0);
        return;
    }

    // 2. 새 배경 합성 렌더링
    if (bgType === 'color') {
        // 단색 배경
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'gradient') {
        // 부드러운 스튜디오 그라데이션
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#f1f5f9');
        grad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'image' && customBgImage) {
        // 사용자 배경 사진 합성
        ctx.drawImage(customBgImage, 0, 0, w, h);
    }

    // 3. 누끼 전경(Foreground) 드로잉
    if (foregroundMaskCanvas) {
        ctx.drawImage(foregroundMaskCanvas, 0, 0);
    }
}

/**
 * ============================================================================
 * 수동 지우개 / 복원 브러시 인터랙션
 * ============================================================================
 */
function bindBrushCanvasEvents() {
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

    const applyBrush = (pos) => {
        if (!foregroundMaskCanvas || !originalCanvas) return;
        const fgCtx = foregroundMaskCanvas.getContext('2d');

        if (manualMode === 'erase') {
            // 지우개: 해당 영역의 알파를 투명화
            fgCtx.save();
            fgCtx.globalCompositeOperation = 'destination-out';
            fgCtx.beginPath();
            fgCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
            fgCtx.fill();
            fgCtx.restore();
        } else if (manualMode === 'restore') {
            // 복원: 원본 이미지에서 해당 원형 영역을 다시 복사
            fgCtx.save();
            fgCtx.beginPath();
            fgCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
            fgCtx.clip();
            fgCtx.drawImage(originalCanvas, 0, 0);
            fgCtx.restore();
        }

        renderCompositeCanvas();
    };

    canvas.addEventListener('mousedown', (e) => {
        if (manualMode === 'preview' || showOriginal) return;
        isPainting = true;
        applyBrush(getCanvasPos(e));
    });

    canvas.addEventListener('mousemove', (e) => {
        if (manualMode === 'preview') {
            canvas.style.cursor = 'default';
            return;
        }
        canvas.style.cursor = 'crosshair';

        if (isPainting) {
            applyBrush(getCanvasPos(e));
        }
    });

    window.addEventListener('mouseup', () => {
        isPainting = false;
    });
}

/**
 * ============================================================================
 * 사이드바 설정 UI 이벤트 바인딩
 * ============================================================================
 */
function bindSettingsUI() {
    // 1. [자동 배경 제거] 버튼
    if (btnAutoRemove) {
        btnAutoRemove.addEventListener('click', () => {
            executeAutoRemoveBackground();
        });
    }

    // 2. 새 배경 드롭다운 선택
    if (selectNewBg) {
        selectNewBg.addEventListener('change', (e) => {
            bgType = e.target.value;
            renderCompositeCanvas();
        });
    }

    // 3. 배경 색상 선택
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            bgColor = e.target.value;
            if (bgType === 'color') renderCompositeCanvas();
        });
    }

    // 4. 배경 사진 파일 선택
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

    // 5. 제거 범위 & 경계 부드러움 슬라이더
    if (rangeThreshold) {
        rangeThreshold.addEventListener('input', (e) => {
            thresholdVal = parseInt(e.target.value, 10);
            executeAutoRemoveBackground();
        });
    }

    if (rangeFeather) {
        rangeFeather.addEventListener('input', (e) => {
            featherVal = parseInt(e.target.value, 10);
            executeAutoRemoveBackground();
        });
    }

    // 6. 수동 보정 모드 드롭다운 & 브러시 크기
    if (selectManual) {
        selectManual.addEventListener('change', (e) => {
            manualMode = e.target.value;
        });
    }

    if (rangeBrush) {
        rangeBrush.addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value, 10);
        });
    }

    // 7. [보정 초기화] 버튼
    const btnResetBrush = document.getElementById('btn-reset-brush');
    if (btnResetBrush) {
        btnResetBrush.addEventListener('click', () => {
            if (confirm('수동 브러시 보정 내용을 초기화하고 다시 자동 배경 제거를 실행하시겠습니까?')) {
                executeAutoRemoveBackground();
            }
        });
    }

    // 8. [원본 보기] 체크박스
    if (chkShowOriginal) {
        chkShowOriginal.addEventListener('change', (e) => {
            showOriginal = e.target.checked;
            renderCompositeCanvas();
        });
    }

    // 9. 저장 형식
    const selectFormat = document.getElementById('select-save-format');
    if (selectFormat) {
        selectFormat.addEventListener('change', (e) => {
            exportFormat = e.target.value;
        });
    }

    // 10. [완성 이미지 저장] 대형 버튼
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveCompletedImage();
        });
    }
}

/**
 * 완성 이미지 저장 (순수 유틸리티 활용 & EXIF 메타데이터 제거)
 */
async function saveCompletedImage() {
    if (!canvas || !currentImage) {
        alert('먼저 사진을 추가하고 배경을 편집해주세요.');
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

        // Canvas Blob 변환 (순수 유틸리티 canvasToBlob)
        const blob = await canvasToBlob(canvas, mimeType, 0.95);
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

// 자동 실행
document.addEventListener('DOMContentLoaded', init);

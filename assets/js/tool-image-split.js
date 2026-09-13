/**
 * ============================================================================
 * assets/js/tool-image-split.js - [사진 분할] 전용 독립 ES 모듈
 * ============================================================================
 * [스크린샷 100% 완벽 대응]
 * 1. 2·4·8·16분할 및 분할선 마우스 드래그 & 우측 슬라이더 세밀 조절
 * 2. 분할 조각 실시간 계산 및 하단 카드 갤러리 렌더링 (썸네일 + 'N번 · W × Hpx 다운로드')
 * 3. [분할 사진 ZIP 저장] & [파일 다운로드]를 통한 ZIP 일괄 다운로드
 * 4. 각 조각 카드 클릭 시 개별 조각 단독 다운로드 (EXIF 메타데이터 100% 자동 제거)
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage, formatBytes } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 격리 상태 변수
// ----------------------------------------------------------------------------
let currentImage = null; // { name, file, imgElement, naturalWidth, naturalHeight }
let splitType = '4';     // '2v', '2h', '4', '6', '8', '9', '16'
let vLines = [];         // [{ x: 500, id: 'v1' }]
let hLines = [];         // [{ y: 400, id: 'h1' }]
let targetWidth = 0;
let targetHeight = 0;
let exportFormat = 'png'; // 'png' | 'jpeg' | 'webp'

// 현재 생성된 분할 조각 배열 [{ index, width, height, canvas }]
let currentPieces = [];
let latestZipBlob = null;
let latestZipFilename = '';

// 마우스 드래그 분할선 조작 상태
let draggingLine = null;
let isDragging = false;

// DOM 요소 캐시
let canvas = null;
let ctx = null;
let emptyState = null;
let workspace = null;
let stateBanner = null;
let footerInfo = null;
let resultSection = null;
let zipInfoText = null;
let piecesGrid = null;

let inputW = null;
let inputH = null;
let chkAspect = null;
let sliderContainer = null;
let btnSaveZip = null;
let btnZipDownload = null;

// ----------------------------------------------------------------------------
// 2. 초기화 함수
// ----------------------------------------------------------------------------
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // DOM 캐싱
    canvas = document.getElementById('split-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    emptyState = document.getElementById('split-empty-state');
    workspace = document.getElementById('split-workspace');
    stateBanner = document.getElementById('split-status-banner');
    footerInfo = document.getElementById('split-footer-info');
    resultSection = document.getElementById('split-result-section');
    zipInfoText = document.getElementById('zip-info-text');
    piecesGrid = document.getElementById('split-pieces-grid');

    inputW = document.getElementById('input-split-width');
    inputH = document.getElementById('input-split-height');
    chkAspect = document.getElementById('chk-split-aspect');
    sliderContainer = document.getElementById('split-line-sliders-container');
    btnSaveZip = document.getElementById('btn-save-split-zip');
    btnZipDownload = document.getElementById('btn-zip-download');

    // 이벤트 리스너 등록
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindCanvasInteraction();
    bindSettingsUI();
}

// ----------------------------------------------------------------------------
// 3. 붙여넣기(Ctrl+V) & 파일 추가 & 드래그앤드롭
// ----------------------------------------------------------------------------
function bindPasteEvents() {
    window.addEventListener('paste', async (e) => {
        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await processImageFile(file, `캡처_분할_${Date.now()}`);
                    break;
                }
            }
        }
    });

    const btnPaste = document.getElementById('btn-split-paste');
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        if (types.length > 0) {
                            const blob = await item.getType(types[0]);
                            const file = new File([blob], `붙여넣기_분할_${Date.now()}.${types[0].split('/')[1] || 'png'}`, { type: types[0] });
                            await processImageFile(file);
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
    const fileInput = document.getElementById('split-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await processImageFile(file);
            }
            fileInput.value = '';
        });
    }

    const btnClear = document.getElementById('btn-split-clear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (!currentImage) return;
            if (confirm('현재 분할 작업을 초기화하고 사진을 삭제하시겠습니까?')) {
                currentImage = null;
                currentPieces = [];
                latestZipBlob = null;
                updateUI();
            }
        });
    }
}

function bindDragAndDrop() {
    const dropZone = document.getElementById('split-drop-zone');
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
            await processImageFile(file);
        }
    });
}

/** 이미지 파일 로드 */
async function processImageFile(file, customName = '') {
    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        currentImage = {
            name: customName ? `${customName}.png` : file.name,
            file: file,
            imgElement: img,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
        };

        targetWidth = img.naturalWidth;
        targetHeight = img.naturalHeight;

        calculateEqualSplitLines();
        updateUI();
    } catch (err) {
        console.error('이미지 로드 실패:', err);
        alert('이미지를 불러오는 중 오류가 발생했습니다: ' + err.message);
    }
}

/**
 * 조각 수에 따른 균등 분할선 자동 계산
 */
function calculateEqualSplitLines() {
    if (!currentImage) return;
    const w = targetWidth;
    const h = targetHeight;

    vLines = [];
    hLines = [];

    switch (splitType) {
        case '2v': // 세로 2조각 (가로선 1개)
            hLines = [{ y: Math.round(h / 2), id: 'h1' }];
            break;
        case '2h': // 가로 2조각 (세로선 1개)
            vLines = [{ x: Math.round(w / 2), id: 'v1' }];
            break;
        case '4': // 4조각 (2x2) - 기본
        default:
            vLines = [{ x: Math.round(w / 2), id: 'v1' }];
            hLines = [{ y: Math.round(h / 2), id: 'h1' }];
            break;
        case '6': // 6조각 (3x2)
            vLines = [
                { x: Math.round(w / 3), id: 'v1' },
                { x: Math.round((w * 2) / 3), id: 'v2' }
            ];
            hLines = [{ y: Math.round(h / 2), id: 'h1' }];
            break;
        case '8': // 8조각 (4x2)
            vLines = [
                { x: Math.round(w / 4), id: 'v1' },
                { x: Math.round((w * 2) / 4), id: 'v2' },
                { x: Math.round((w * 3) / 4), id: 'v3' }
            ];
            hLines = [{ y: Math.round(h / 2), id: 'h1' }];
            break;
        case '9': // 9조각 (3x3)
            vLines = [
                { x: Math.round(w / 3), id: 'v1' },
                { x: Math.round((w * 2) / 3), id: 'v2' }
            ];
            hLines = [
                { y: Math.round(h / 3), id: 'h1' },
                { y: Math.round((h * 2) / 3), id: 'h2' }
            ];
            break;
        case '16': // 16조각 (4x4)
            vLines = [
                { x: Math.round(w / 4), id: 'v1' },
                { x: Math.round((w * 2) / 4), id: 'v2' },
                { x: Math.round((w * 3) / 4), id: 'v3' }
            ];
            hLines = [
                { y: Math.round(h / 4), id: 'h1' },
                { y: Math.round((h * 2) / 4), id: 'h2' },
                { y: Math.round((h * 3) / 4), id: 'h3' }
            ];
            break;
    }

    updateLineSliders();
}

/**
 * UI 상태 갱신 및 분할 조각 실시간 생성
 */
function updateUI() {
    if (!currentImage) {
        if (emptyState) emptyState.style.display = 'block';
        if (workspace) workspace.style.display = 'none';
        if (resultSection) resultSection.style.display = 'none';
        if (stateBanner) stateBanner.textContent = '사진을 추가해주세요.';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (workspace) workspace.style.display = 'block';
    if (resultSection) resultSection.style.display = 'flex';

    if (stateBanner) {
        stateBanner.textContent = `원본 ${currentImage.naturalWidth} × ${currentImage.naturalHeight}px → 분할 크기 ${targetWidth} × ${targetHeight}px`;
    }

    if (inputW) inputW.value = targetWidth;
    if (inputH) inputH.value = targetHeight;

    if (footerInfo) {
        const cols = vLines.length + 1;
        const rows = hLines.length + 1;
        const total = cols * rows;
        footerInfo.textContent = `가로 ${cols} × 세로 ${rows} · ${total}조각 · 번호·분할선은 저장되지 않습니다.`;
    }

    renderCanvas();
    generateAndRenderPieces();
}

/**
 * 상단 캔버스 렌더링
 */
function renderCanvas() {
    if (!canvas || !currentImage) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // 1. 이미지 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage.imgElement, 0, 0, targetWidth, targetHeight);

    // 2. 외곽 가이드 테두리
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // 3. 분할선 그리기 (보라색)
    ctx.save();
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;

    vLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x, 0);
        ctx.lineTo(line.x, canvas.height);
        ctx.stroke();
    });

    hLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(0, line.y);
        ctx.lineTo(canvas.width, line.y);
        ctx.stroke();
    });
    ctx.restore();

    // 4. 번호 뱃지 가이드
    drawPieceBadges();
}

function drawPieceBadges() {
    const xs = [0, ...vLines.map(l => l.x).sort((a,b) => a - b), targetWidth];
    const ys = [0, ...hLines.map(l => l.y).sort((a,b) => a - b), targetHeight];

    let pieceNumber = 1;
    const radius = Math.max(16, Math.min(targetWidth, targetHeight) * 0.035);

    for (let row = 0; row < ys.length - 1; row++) {
        for (let col = 0; col < xs.length - 1; col++) {
            const x1 = xs[col];
            const x2 = xs[col + 1];
            const y1 = ys[row];
            const y2 = ys[row + 1];

            const centerX = x2 - radius * 1.5;
            const centerY = y1 + radius * 1.5;

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(109, 40, 217, 0.9)';
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(pieceNumber), centerX, centerY);
            ctx.restore();

            pieceNumber++;
        }
    }
}

// ----------------------------------------------------------------------------
// 4. 분할 조각 실시간 계산 및 하단 카드 그리드 렌더링 (스크린샷 100% 일치)
// ----------------------------------------------------------------------------
async function generateAndRenderPieces() {
    if (!currentImage || !piecesGrid) return;

    const xs = [0, ...vLines.map(l => l.x).sort((a,b) => a - b), targetWidth];
    const ys = [0, ...hLines.map(l => l.y).sort((a,b) => a - b), targetHeight];

    currentPieces = [];
    piecesGrid.innerHTML = '';
    let pieceIndex = 1;

    for (let row = 0; row < ys.length - 1; row++) {
        for (let col = 0; col < xs.length - 1; col++) {
            const x1 = xs[col];
            const x2 = xs[col + 1];
            const y1 = ys[row];
            const y2 = ys[row + 1];
            const w = Math.round(x2 - x1);
            const h = Math.round(y2 - y1);

            if (w > 0 && h > 0) {
                const pieceCanvas = document.createElement('canvas');
                pieceCanvas.width = w;
                pieceCanvas.height = h;
                const pCtx = pieceCanvas.getContext('2d');

                if (exportFormat === 'jpeg') {
                    pCtx.fillStyle = '#ffffff';
                    pCtx.fillRect(0, 0, w, h);
                }

                pCtx.drawImage(
                    currentImage.imgElement,
                    (x1 / targetWidth) * currentImage.naturalWidth,
                    (y1 / targetHeight) * currentImage.naturalHeight,
                    (w / targetWidth) * currentImage.naturalWidth,
                    (h / targetHeight) * currentImage.naturalHeight,
                    0, 0, w, h
                );

                currentPieces.push({
                    index: pieceIndex,
                    width: w,
                    height: h,
                    canvas: pieceCanvas
                });

                // 카드 DOM 생성 (스크린샷 100% 일치 형태)
                const card = document.createElement('div');
                card.className = 'split-piece-card';
                card.innerHTML = `
                    <div class="piece-thumb-wrap">
                        <img class="piece-thumb" src="${pieceCanvas.toDataURL('image/jpeg', 0.85)}" alt="${pieceIndex}번 조각">
                    </div>
                    <button class="btn-piece-download" data-index="${pieceIndex}">
                        <span>${pieceIndex}번 · ${w} × ${h}px 다운로드</span>
                        <i data-lucide="download"></i>
                    </button>
                `;

                // 조각별 단독 다운로드 이벤트
                const btnDownloadPiece = card.querySelector('.btn-piece-download');
                btnDownloadPiece.addEventListener('click', () => {
                    downloadSinglePiece(pieceIndex);
                });

                piecesGrid.appendChild(card);
                pieceIndex++;
            }
        }
    }

    if (window.lucide) window.lucide.createIcons();

    // ZIP 파일 정보 비동기 계산
    updateZipFileInfo();
}

/** 조각 단독 다운로드 */
async function downloadSinglePiece(idx) {
    const piece = currentPieces.find(p => p.index === idx);
    if (!piece || !currentImage) return;

    const format = exportFormat;
    const mimeType = `image/${format}`;
    const ext = format === 'jpeg' ? 'jpg' : format;
    const cleanName = currentImage.name.replace(/\.[^/.]+$/, '');
    const padNum = String(piece.index).padStart(2, '0');
    const filename = `${cleanName}_part${padNum}.${ext}`;

    const blob = await canvasToBlob(piece.canvas, mimeType, 0.95);
    downloadBlob(blob, filename);
}

/** ZIP 압축 파일 정보 및 용량 계산 */
async function updateZipFileInfo() {
    if (!currentImage || currentPieces.length === 0 || !zipInfoText) return;

    try {
        const cleanName = currentImage.name.replace(/\.[^/.]+$/, '');
        latestZipFilename = `${cleanName}_분할.zip`;

        if (window.JSZip) {
            const zip = new JSZip();
            const format = exportFormat;
            const mimeType = `image/${format}`;
            const ext = format === 'jpeg' ? 'jpg' : format;

            for (const piece of currentPieces) {
                const blob = await canvasToBlob(piece.canvas, mimeType, 0.95);
                const padNum = String(piece.index).padStart(2, '0');
                zip.file(`${cleanName}_part${padNum}.${ext}`, blob);
            }

            latestZipBlob = await zip.generateAsync({ type: 'blob' });
            const sizeStr = formatBytes(latestZipBlob.size);
            zipInfoText.textContent = `${latestZipFilename} · ${sizeStr}`;
        } else {
            zipInfoText.textContent = `${latestZipFilename}`;
        }
    } catch (err) {
        console.error('ZIP 계산 오류:', err);
    }
}

/** ZIP 파일 일괄 다운로드 실행 */
async function downloadAllZip() {
    if (!currentImage || currentPieces.length === 0) {
        alert('분할할 사진을 먼저 추가해주세요.');
        return;
    }

    if (btnSaveZip) {
        btnSaveZip.disabled = true;
        btnSaveZip.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>ZIP 압축 저장 중...</span>`;
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        if (!latestZipBlob) {
            await updateZipFileInfo();
        }

        if (latestZipBlob) {
            downloadBlob(latestZipBlob, latestZipFilename);
        }
    } catch (err) {
        console.error('ZIP 다운로드 오류:', err);
        alert('ZIP 다운로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSaveZip) {
            btnSaveZip.disabled = false;
            btnSaveZip.innerHTML = `<i data-lucide="download"></i> <span>분할 사진 ZIP 저장</span>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// ----------------------------------------------------------------------------
// 5. 마우스 드래그 분할선 조작
// ----------------------------------------------------------------------------
function bindCanvasInteraction() {
    if (!canvas) return;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const HIT_RADIUS = 20;

    canvas.addEventListener('mousemove', (e) => {
        if (!currentImage) return;
        const pos = getPos(e);

        if (isDragging && draggingLine) {
            if (draggingLine.type === 'v') {
                const minX = 20;
                const maxX = targetWidth - 20;
                vLines[draggingLine.index].x = Math.max(minX, Math.min(pos.x, maxX));
            } else if (draggingLine.type === 'h') {
                const minY = 20;
                const maxY = targetHeight - 20;
                hLines[draggingLine.index].y = Math.max(minY, Math.min(pos.y, maxY));
            }
            updateLineSliders();
            renderCanvas();
            generateAndRenderPieces();
            return;
        }

        let hovered = null;
        vLines.forEach((line, index) => {
            if (Math.abs(line.x - pos.x) < HIT_RADIUS) hovered = { type: 'v', index };
        });
        hLines.forEach((line, index) => {
            if (Math.abs(line.y - pos.y) < HIT_RADIUS) hovered = { type: 'h', index };
        });

        if (hovered) {
            canvas.style.cursor = hovered.type === 'v' ? 'ew-resize' : 'ns-resize';
        } else {
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (!currentImage) return;
        const pos = getPos(e);

        vLines.forEach((line, index) => {
            if (Math.abs(line.x - pos.x) < HIT_RADIUS) {
                isDragging = true;
                draggingLine = { type: 'v', index };
            }
        });

        if (!isDragging) {
            hLines.forEach((line, index) => {
                if (Math.abs(line.y - pos.y) < HIT_RADIUS) {
                    isDragging = true;
                    draggingLine = { type: 'h', index };
                }
            });
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            draggingLine = null;
        }
    });
}

/** 우측 슬라이더 갱신 */
function updateLineSliders() {
    if (!sliderContainer) return;
    sliderContainer.innerHTML = '';

    vLines.forEach((line, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'setting-item mt-3';
        wrap.innerHTML = `
            <div class="setting-header-inline">
                <label class="setting-label">세로선 ${i + 1} · X ${Math.round(line.x)}px</label>
            </div>
            <input type="range" class="form-range" min="10" max="${targetWidth - 10}" value="${Math.round(line.x)}">
        `;
        const range = wrap.querySelector('input');
        range.addEventListener('input', (e) => {
            line.x = parseInt(e.target.value, 10);
            wrap.querySelector('.setting-label').textContent = `세로선 ${i + 1} · X ${Math.round(line.x)}px`;
            renderCanvas();
            generateAndRenderPieces();
        });
        sliderContainer.appendChild(wrap);
    });

    hLines.forEach((line, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'setting-item mt-3';
        wrap.innerHTML = `
            <div class="setting-header-inline">
                <label class="setting-label">가로선 ${i + 1} · Y ${Math.round(line.y)}px</label>
            </div>
            <input type="range" class="form-range" min="10" max="${targetHeight - 10}" value="${Math.round(line.y)}">
        `;
        const range = wrap.querySelector('input');
        range.addEventListener('input', (e) => {
            line.y = parseInt(e.target.value, 10);
            wrap.querySelector('.setting-label').textContent = `가로선 ${i + 1} · Y ${Math.round(line.y)}px`;
            renderCanvas();
            generateAndRenderPieces();
        });
        sliderContainer.appendChild(wrap);
    });
}

// ----------------------------------------------------------------------------
// 6. 우측 설정 사이드바 이벤트 바인딩
// ----------------------------------------------------------------------------
function bindSettingsUI() {
    // 1. 크기 조절
    const btnApplySize = document.getElementById('btn-apply-split-size');
    const btnOrigSize = document.getElementById('btn-size-orig');
    const btn2xSize = document.getElementById('btn-size-2x');
    const btn3xSize = document.getElementById('btn-size-3x');

    if (inputW && inputH && chkAspect) {
        inputW.addEventListener('input', () => {
            if (chkAspect.checked && currentImage) {
                const ratio = currentImage.naturalHeight / currentImage.naturalWidth;
                inputH.value = Math.round(parseInt(inputW.value, 10) * ratio) || '';
            }
        });
        inputH.addEventListener('input', () => {
            if (chkAspect.checked && currentImage) {
                const ratio = currentImage.naturalWidth / currentImage.naturalHeight;
                inputW.value = Math.round(parseInt(inputH.value, 10) * ratio) || '';
            }
        });
    }

    if (btnApplySize && inputW && inputH) {
        btnApplySize.addEventListener('click', () => {
            const w = parseInt(inputW.value, 10);
            const h = parseInt(inputH.value, 10);
            if (w > 10 && h > 10) {
                targetWidth = Math.min(w, 16384);
                targetHeight = Math.min(h, 16384);
                calculateEqualSplitLines();
                updateUI();
            }
        });
    }

    if (btnOrigSize) {
        btnOrigSize.addEventListener('click', () => {
            if (!currentImage) return;
            targetWidth = currentImage.naturalWidth;
            targetHeight = currentImage.naturalHeight;
            calculateEqualSplitLines();
            updateUI();
        });
    }
    if (btn2xSize) {
        btn2xSize.addEventListener('click', () => {
            if (!currentImage) return;
            targetWidth = currentImage.naturalWidth * 2;
            targetHeight = currentImage.naturalHeight * 2;
            calculateEqualSplitLines();
            updateUI();
        });
    }
    if (btn3xSize) {
        btn3xSize.addEventListener('click', () => {
            if (!currentImage) return;
            targetWidth = currentImage.naturalWidth * 3;
            targetHeight = currentImage.naturalHeight * 3;
            calculateEqualSplitLines();
            updateUI();
        });
    }

    // 2. 조각 수 변경
    const selectSplitType = document.getElementById('select-split-type');
    if (selectSplitType) {
        selectSplitType.addEventListener('change', (e) => {
            splitType = e.target.value;
            calculateEqualSplitLines();
            updateUI();
        });
    }

    // 3. 초기화
    const btnResetLines = document.getElementById('btn-reset-split-lines');
    if (btnResetLines) {
        btnResetLines.addEventListener('click', () => {
            calculateEqualSplitLines();
            updateUI();
        });
    }

    // 4. 저장 포맷
    const selectFormat = document.getElementById('select-split-format');
    if (selectFormat) {
        selectFormat.addEventListener('change', (e) => {
            exportFormat = e.target.value;
            generateAndRenderPieces();
        });
    }

    // 5. ZIP 다운로드 버튼 연결
    if (btnSaveZip) {
        btnSaveZip.addEventListener('click', downloadAllZip);
    }
    if (btnZipDownload) {
        btnZipDownload.addEventListener('click', downloadAllZip);
    }
}

// ----------------------------------------------------------------------------
// 초기화 실행
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);

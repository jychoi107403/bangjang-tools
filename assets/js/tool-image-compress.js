/**
 * ============================================================================
 * assets/js/tool-image-compress.js - [이미지 용량 줄이기] 전용 독립 ES 모듈
 * ============================================================================
 * [기능 요약]
 * 1. 다양한 이미지 추가: Win+Shift+S 캡처 후 Ctrl+V 붙여넣기, [붙여넣기] 버튼, [파일 추가], 드래그&드롭
 * 2. 100% 브라우저 로컬 초고속 스마트 압축 (Canvas API + WebP/JPEG/PNG)
 * 3. 품질(Quality), 리사이즈(최대 해상도), 목표 용량(500KB 등) 실시간 조절
 * 4. 원본 대비 압축 용량 및 절감률(-85%) 실시간 비교
 * 5. 개별 다운로드 및 JSZip 기반 일괄 ZIP 다운로드
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage, formatBytes } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 상태 변수 정의 (State Management)
// ----------------------------------------------------------------------------

/** 등록된 이미지 목록 배열 */
let images = [];

/** 현재 선택된 이미지 ID (대형 비교 뷰어용) */
let selectedId = null;

/** 압축 모드: 'smart' (권장 80% WebP) | 'custom' (사용자 지정) | 'target' (목표 용량 제한) */
let compressMode = 'smart';

/** 출력 포맷: 'webp' | 'jpeg' | 'png' | 'original' */
let outputFormat = 'webp';

/** 압축 품질: 10 ~ 100 (기본 80%) */
let qualityValue = 80;

/** 리사이즈 모드: 'original' | '1920' | '1280' | '800' | 'custom' */
let resizeMode = 'original';

/** 사용자 지정 리사이즈 너비 (px) */
let customResizeWidth = 1200;

/** 목표 용량 제한 (KB 단위, 기본 500KB) */
let targetSizeKB = 500;

/** 실시간 일괄 재압축 디바운스 타이머 */
let debounceTimer = null;

// ----------------------------------------------------------------------------
// 2. 초기화 및 이벤트 바인딩 (Initialization)
// ----------------------------------------------------------------------------

export function init() {
    // Lucide 아이콘 렌더링
    if (window.lucide) {
        window.lucide.createIcons();
    }

    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindSettingsEvents();
    bindActionButtons();
}

// DOM 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', init);

// ----------------------------------------------------------------------------
// 3. 이미지 입력 이벤트 (붙여넣기, 파일 선택, 드래그앤드롭)
// ----------------------------------------------------------------------------

/** Ctrl+V 키보드 붙여넣기 및 [붙여넣기] 버튼 이벤트 */
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
                    await addImageFromFile(file, `캡처_${formatTimestamp(Date.now())}`);
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
                            const file = new File([blob], `붙여넣기_${formatTimestamp(Date.now())}.${type.split('/')[1] || 'png'}`, { type });
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

/** 파일 선택 인풋 및 전체 삭제 */
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
            if (confirm('등록된 모든 이미지를 목록에서 삭제하시겠습니까?')) {
                images = [];
                selectedId = null;
                updateGalleryUI();
            }
        });
    }
}

/** 드래그 & 드롭 이벤트 */
function bindDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        for (const file of files) {
            await addImageFromFile(file);
        }
    });
}

// ----------------------------------------------------------------------------
// 4. 이미지 추가 및 코어 압축 처리 함수
// ----------------------------------------------------------------------------

/**
 * File 객체를 읽어 등록하고 압축을 실행합니다.
 * @param {File} file - 이미지 파일
 * @param {string} customName - 옵션 파일명
 */
async function addImageFromFile(file, customName = '') {
    if (images.length >= 50) {
        alert('한 번에 최대 50장까지 추가할 수 있습니다.');
        return;
    }

    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const originalName = customName || file.name || `이미지_${images.length + 1}`;

        const newImageItem = {
            id,
            name: originalName,
            origFile: file,
            origSrc: dataUrl,
            origSize: file.size,
            origWidth: img.naturalWidth || img.width,
            origHeight: img.naturalHeight || img.height,
            origType: file.type || 'image/png',
            
            // 압축 결과 속성들
            compressedBlob: null,
            compressedSrc: null,
            compressedSize: 0,
            compressedWidth: 0,
            compressedHeight: 0,
            savingsPercent: 0,
            targetMime: 'image/webp'
        };

        // 초기 압축 수행
        await compressSingleItem(newImageItem, img);

        images.push(newImageItem);

        // 첫 번째 이미지라면 자동 선택
        if (!selectedId) {
            selectedId = newImageItem.id;
        }

        updateGalleryUI();
    } catch (error) {
        console.error('이미지 로드/압축 실패:', error);
        alert('이미지를 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 단일 이미지 항목을 현재 설정에 맞춰 압축합니다.
 * @param {Object} item - 이미지 아이템 객체
 * @param {HTMLImageElement} loadedImg - 사전 로드된 이미지 객체 (선택)
 */
async function compressSingleItem(item, loadedImg = null) {
    const img = loadedImg || await loadImage(item.origSrc);

    // 1. 목표 해상도(너비, 높이) 계산
    let targetW = item.origWidth;
    let targetH = item.origHeight;

    if (resizeMode === '1920' && targetW > 1920) {
        targetH = Math.round((targetH * 1920) / targetW);
        targetW = 1920;
    } else if (resizeMode === '1280' && targetW > 1280) {
        targetH = Math.round((targetH * 1280) / targetW);
        targetW = 1280;
    } else if (resizeMode === '800' && targetW > 800) {
        targetH = Math.round((targetH * 800) / targetW);
        targetW = 800;
    } else if (resizeMode === 'custom' && customResizeWidth > 0 && targetW > customResizeWidth) {
        targetH = Math.round((targetH * customResizeWidth) / targetW);
        targetW = customResizeWidth;
    }

    // 2. 캔버스 생성 및 렌더링 (메타데이터 자동 제거 효과)
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // 투명 배경 PNG인 경우를 제외하고 필요시 흰색 배경 채우기 지원
    if (outputFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 3. MIME 타입 결정
    let mimeType = 'image/webp';
    if (outputFormat === 'jpeg') mimeType = 'image/jpeg';
    else if (outputFormat === 'png') mimeType = 'image/png';
    else if (outputFormat === 'original') {
        mimeType = item.origType && item.origType.startsWith('image/') ? item.origType : 'image/jpeg';
    }

    // 4. 품질 결정 (0.1 ~ 1.0)
    let q = qualityValue / 100;
    if (compressMode === 'smart') {
        mimeType = 'image/webp';
        q = 0.82; // 스마트 최적화 기본값
    }

    // 5. 압축 Blob 생성 (목표 용량 모드 대응)
    let blob = null;
    if (compressMode === 'target' && mimeType !== 'image/png') {
        const targetBytes = targetSizeKB * 1024;
        let low = 0.1;
        let high = 0.95;
        let bestBlob = null;

        // 이진 탐색으로 목표 크기 이하의 최적 품질 탐색
        for (let iter = 0; iter < 5; iter++) {
            const midQ = (low + high) / 2;
            const tempBlob = await canvasToBlob(canvas, mimeType, midQ);
            bestBlob = tempBlob;
            if (tempBlob.size > targetBytes) {
                high = midQ;
            } else {
                low = midQ;
            }
        }
        blob = bestBlob;
    } else {
        blob = await canvasToBlob(canvas, mimeType, q);
    }

    // 6. 결과 기록
    item.compressedBlob = blob;
    item.compressedSize = blob.size;
    item.compressedWidth = targetW;
    item.compressedHeight = targetH;
    item.targetMime = mimeType;

    // 절감률 계산: (원본 - 압축) / 원본 * 100
    const savings = ((item.origSize - item.compressedSize) / item.origSize) * 100;
    item.savingsPercent = Math.max(-99, Math.min(99.9, savings));

    // 메모리 URL 생성
    if (item.compressedSrc && item.compressedSrc.startsWith('blob:')) {
        URL.revokeObjectURL(item.compressedSrc);
    }
    item.compressedSrc = URL.createObjectURL(blob);
}

/**
 * 현재 설정값에 맞춰 등록된 모든 이미지를 일괄 재압축합니다.
 */
async function recompressAllImages() {
    if (images.length === 0) return;

    for (const item of images) {
        await compressSingleItem(item);
    }
    updateGalleryUI();
}

/** 디바운스를 적용한 일괄 재압축 호출 */
function triggerRecompressDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        await recompressAllImages();
    }, 200);
}

// ----------------------------------------------------------------------------
// 5. UI 렌더링 및 갱신 (Gallery & Dashboard & Viewers)
// ----------------------------------------------------------------------------

function updateGalleryUI() {
    const emptyState = document.getElementById('empty-state');
    const summaryBar = document.getElementById('compress-summary-bar');
    const imageGrid = document.getElementById('image-grid');
    const countBadge = document.getElementById('image-count-badge');
    const compareViewer = document.getElementById('compare-viewer-container');

    if (!imageGrid) return;

    if (images.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (summaryBar) summaryBar.style.display = 'none';
        if (imageGrid) imageGrid.style.display = 'none';
        if (compareViewer) compareViewer.style.display = 'none';
        if (countBadge) countBadge.textContent = '0 / 50장 · 한 장 30MB 이하';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryBar) summaryBar.style.display = 'grid';
    if (imageGrid) imageGrid.style.display = 'grid';
    if (compareViewer) compareViewer.style.display = 'flex';

    if (countBadge) countBadge.textContent = `${images.length} / 50장 · 로컬 100% 실행`;

    // 1. 전체 통계 계산 및 표시
    let totalOrigBytes = 0;
    let totalCompBytes = 0;
    images.forEach(img => {
        totalOrigBytes += img.origSize;
        totalCompBytes += img.compressedSize;
    });

    const totalSavedBytes = Math.max(0, totalOrigBytes - totalCompBytes);
    const totalSavingsPercent = totalOrigBytes > 0 ? ((totalSavedBytes / totalOrigBytes) * 100).toFixed(1) : 0;

    const summaryOrig = document.getElementById('sum-orig-size');
    const summaryComp = document.getElementById('sum-comp-size');
    const summarySavings = document.getElementById('sum-savings-rate');

    if (summaryOrig) summaryOrig.textContent = formatBytes(totalOrigBytes);
    if (summaryComp) summaryComp.textContent = formatBytes(totalCompBytes);
    if (summarySavings) summarySavings.textContent = `${formatBytes(totalSavedBytes)} 절약 (-${totalSavingsPercent}%)`;

    // 2. 카드 그리드 렌더링
    imageGrid.innerHTML = '';

    images.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `compress-card ${item.id === selectedId ? 'selected' : ''}`;
        card.dataset.id = item.id;

        const isSavingsPositive = item.savingsPercent > 0;
        const savingsText = isSavingsPositive 
            ? `-${item.savingsPercent.toFixed(1)}%` 
            : `${item.savingsPercent.toFixed(1)}%`;
        
        const ext = item.targetMime.split('/')[1].toUpperCase();

        card.innerHTML = `
            <div class="card-thumb-wrap">
                <span class="badge-format">${ext}</span>
                <span class="badge-savings ${isSavingsPositive ? '' : 'no-change'}">${savingsText}</span>
                <img src="${item.compressedSrc || item.origSrc}" class="card-thumb" alt="${escapeHtml(item.name)}">
            </div>
            <div class="card-body">
                <div class="card-title" title="${escapeHtml(item.name)}">${index + 1}. ${escapeHtml(item.name)}</div>
                <div class="size-compare-row">
                    <span class="size-orig">${formatBytes(item.origSize)}</span>
                    <i data-lucide="arrow-right" class="size-arrow" style="width: 12px; height: 12px;"></i>
                    <span class="size-comp">${formatBytes(item.compressedSize)}</span>
                </div>
                <div class="dimension-info">
                    <span>${item.origWidth}×${item.origHeight}</span>
                    <span>→</span>
                    <span>${item.compressedWidth}×${item.compressedHeight}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-card-download" data-id="${item.id}" type="button">
                        <i data-lucide="download" style="width: 13px; height: 13px;"></i>
                        <span>저장</span>
                    </button>
                    <button class="btn-card-delete" data-id="${item.id}" type="button" title="목록에서 삭제">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
            </div>
        `;

        // 카드 클릭 시 선택
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-card-download') || e.target.closest('.btn-card-delete')) return;
            selectedId = item.id;
            updateGalleryUI();
        });

        // 개별 다운로드 버튼
        const btnDownload = card.querySelector('.btn-card-download');
        if (btnDownload) {
            btnDownload.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadSingleImage(item);
            });
        }

        // 개별 삭제 버튼
        const btnDelete = card.querySelector('.btn-card-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                images = images.filter(img => img.id !== item.id);
                if (selectedId === item.id) {
                    selectedId = images.length > 0 ? images[0].id : null;
                }
                updateGalleryUI();
            });
        }

        imageGrid.appendChild(card);
    });

    // 3. 하단 비교 뷰어 갱신
    updateCompareViewer();

    // Lucide 아이콘 리프레시
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/** 하단 원본 vs 압축본 비교 뷰어 갱신 */
function updateCompareViewer() {
    const selectedItem = images.find(img => img.id === selectedId) || images[0];
    if (!selectedItem) return;

    const imgOrig = document.getElementById('compare-img-orig');
    const imgComp = document.getElementById('compare-img-comp');
    const metaOrig = document.getElementById('compare-meta-orig');
    const metaComp = document.getElementById('compare-meta-comp');

    if (imgOrig) imgOrig.src = selectedItem.origSrc;
    if (imgComp) imgComp.src = selectedItem.compressedSrc || selectedItem.origSrc;

    if (metaOrig) {
        metaOrig.textContent = `${formatBytes(selectedItem.origSize)} · ${selectedItem.origWidth}×${selectedItem.origHeight}px`;
    }
    if (metaComp) {
        const ext = selectedItem.targetMime.split('/')[1].toUpperCase();
        metaComp.textContent = `${formatBytes(selectedItem.compressedSize)} (-${selectedItem.savingsPercent.toFixed(1)}%) · ${ext} · ${selectedItem.compressedWidth}×${selectedItem.compressedHeight}px`;
    }
}

// ----------------------------------------------------------------------------
// 6. 우측 사이드바 설정 이벤트 바인딩
// ----------------------------------------------------------------------------

function bindSettingsEvents() {
    // 1. 압축 모드 버튼 (스마트 / 사용자지정 / 목표용량)
    const modeBtns = document.querySelectorAll('.mode-btn');
    const customOptionsWrap = document.getElementById('custom-options-wrap');
    const targetOptionsWrap = document.getElementById('target-options-wrap');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            compressMode = btn.dataset.mode || 'smart';

            if (customOptionsWrap) {
                customOptionsWrap.style.display = compressMode === 'custom' ? 'block' : 'none';
            }
            if (targetOptionsWrap) {
                targetOptionsWrap.style.display = compressMode === 'target' ? 'block' : 'none';
            }

            triggerRecompressDebounced();
        });
    });

    // 2. 포맷 라디오 버튼 (WebP / JPEG / PNG / 원본)
    const formatRadios = document.querySelectorAll('input[name="format-choice"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            outputFormat = radio.value;
            triggerRecompressDebounced();
        });
    });

    // 3. 품질 슬라이더
    const rangeQuality = document.getElementById('range-quality');
    const qualityBadge = document.getElementById('quality-badge');
    if (rangeQuality) {
        rangeQuality.addEventListener('input', (e) => {
            qualityValue = parseInt(e.target.value, 10);
            if (qualityBadge) qualityBadge.textContent = `${qualityValue}%`;
            triggerRecompressDebounced();
        });
    }

    // 4. 리사이즈 셀렉트박스
    const selectResize = document.getElementById('select-resize');
    const customWidthWrap = document.getElementById('custom-width-wrap');
    if (selectResize) {
        selectResize.addEventListener('change', (e) => {
            resizeMode = e.target.value;
            if (customWidthWrap) {
                customWidthWrap.style.display = resizeMode === 'custom' ? 'block' : 'none';
            }
            triggerRecompressDebounced();
        });
    }

    const inputCustomWidth = document.getElementById('input-custom-width');
    if (inputCustomWidth) {
        inputCustomWidth.addEventListener('input', (e) => {
            customResizeWidth = parseInt(e.target.value, 10) || 1200;
            triggerRecompressDebounced();
        });
    }

    // 5. 목표 용량 입력
    const inputTargetKB = document.getElementById('input-target-kb');
    if (inputTargetKB) {
        inputTargetKB.addEventListener('input', (e) => {
            targetSizeKB = parseInt(e.target.value, 10) || 500;
            triggerRecompressDebounced();
        });
    }
}

// ----------------------------------------------------------------------------
// 7. 하단 저장 및 다운로드 액션 (ZIP & Single & Clipboard)
// ----------------------------------------------------------------------------

function bindActionButtons() {
    // 전체 압축 이미지 ZIP 다운로드
    const btnSaveAllZip = document.getElementById('btn-save-images');
    if (btnSaveAllZip) {
        btnSaveAllZip.addEventListener('click', async () => {
            if (images.length === 0) {
                alert('압축할 이미지를 먼저 추가해 주세요.');
                return;
            }

            if (images.length === 1) {
                downloadSingleImage(images[0]);
                return;
            }

            if (typeof JSZip === 'undefined') {
                alert('ZIP 압축 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
                return;
            }

            btnSaveAllZip.disabled = true;
            const originalText = btnSaveAllZip.innerHTML;
            btnSaveAllZip.innerHTML = `<i data-lucide="loader-2" class="spin"></i> <span>ZIP 압축 생성 중...</span>`;
            if (window.lucide) window.lucide.createIcons();

            try {
                const zip = new JSZip();
                const folder = zip.folder("방장_압축이미지");

                for (let i = 0; i < images.length; i++) {
                    const item = images[i];
                    const ext = item.targetMime.split('/')[1] || 'webp';
                    const baseName = item.name.replace(/\.[^/.]+$/, "");
                    const filename = `${String(i + 1).padStart(2, '0')}_${baseName}.${ext}`;
                    folder.file(filename, item.compressedBlob);
                }

                const content = await zip.generateAsync({ type: "blob" });
                downloadBlob(content, `방장_용량압축_${formatDateForFilename(new Date())}.zip`);
            } catch (err) {
                console.error('ZIP 생성 실패:', err);
                alert('ZIP 파일 생성 중 오류가 발생했습니다.');
            } finally {
                btnSaveAllZip.disabled = false;
                btnSaveAllZip.innerHTML = originalText;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    // 선택 이미지 클립보드 복사 버튼
    const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
    if (btnCopyClipboard) {
        btnCopyClipboard.addEventListener('click', async () => {
            const selectedItem = images.find(img => img.id === selectedId) || images[0];
            if (!selectedItem) {
                alert('복사할 이미지를 선택해 주세요.');
                return;
            }

            try {
                // 클립보드 PNG 복사 지원
                if (navigator.clipboard && window.ClipboardItem) {
                    const canvas = document.createElement('canvas');
                    canvas.width = selectedItem.compressedWidth;
                    canvas.height = selectedItem.compressedHeight;
                    const ctx = canvas.getContext('2d');
                    const img = await loadImage(selectedItem.compressedSrc);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(async (blob) => {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        alert('압축된 이미지가 클립보드에 복사되었습니다!\n원하는 곳에 Ctrl+V로 붙여넣으세요.');
                    }, 'image/png');
                } else {
                    alert('현재 브라우저 환경에서는 클립보드 이미지 직접 복사를 지원하지 않습니다.');
                }
            } catch (err) {
                console.error('클립보드 복사 실패:', err);
                alert('클립보드 복사에 실패했습니다. [저장] 버튼을 이용해 주세요.');
            }
        });
    }
}

/** 단일 이미지 다운로드 */
function downloadSingleImage(item) {
    if (!item.compressedBlob) return;
    const ext = item.targetMime.split('/')[1] || 'webp';
    const baseName = item.name.replace(/\.[^/.]+$/, "");
    const filename = `${baseName}_압축.${ext}`;
    downloadBlob(item.compressedBlob, filename);
}

// ----------------------------------------------------------------------------
// 8. 헬퍼 유틸리티 함수
// ----------------------------------------------------------------------------

function formatTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}${d.getSeconds().toString().padStart(2, '0')}`;
}

function formatDateForFilename(d) {
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}_${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

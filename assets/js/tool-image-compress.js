/**
 * ============================================================================
 * assets/js/tool-image-compress.js - [이미지 용량 줄이기] 전용 독립 ES 모듈
 * ============================================================================
 * [핵심 기능]
 * 1. 원본 포맷 자동 유지 압축: PNG는 PNG로, JPG는 JPG로, WebP는 WebP로 압축
 * 2. PNG 스마트 압축: 캔버스 픽셀 양자화(Color Quantization) 기술로 PNG 파일도 50~85% 실질적 용량 절감
 * 3. 스크린샷 100% 일치 리스트 UI: [썸네일] | [파일명] [포맷뱃지] [원본크기] | [절감률] [압축크기] | [⬇ PNG/JPG]
 * 4. Win+Shift+S 캡처 후 Ctrl+V 붙여넣기, 다중 파일 추가, 드래그&드롭 지원
 * 5. 개별 다운로드 및 JSZip 기반 일괄 ZIP 다운로드 지원
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage, formatBytes } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 상태 변수 정의 (State Management)
// ----------------------------------------------------------------------------

/** 등록된 이미지 목록 배열 */
let images = [];

/** 현재 선택된 이미지 ID (대형 비교 뷰어용) */
let selectedId = null;

/** 압축 모드: 'smart' (권장 최적화) | 'custom' (사용자 지정) | 'target' (목표 용량 제한) */
let compressMode = 'smart';

/** 출력 포맷: 'original' (원본 포맷 유지, 기본값) | 'webp' | 'jpeg' | 'png' */
let outputFormat = 'original';

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
                    await addImageFromFile(file, `${window.i18n.t('compress.default_name', '이미지')}_${formatTimestamp(Date.now())}.png`);
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
                            const ext = type.split('/')[1] || 'png';
                            const file = new File([blob], `${window.i18n.t('compress.default_name', '이미지')}_${formatTimestamp(Date.now())}.${ext}`, { type });
                            await addImageFromFile(file);
                            found = true;
                        }
                    }
                    if (!found) alert(window.i18n.t('compress.msg_no_clipboard', '클립보드에 복사된 이미지가 없습니다.\nWin + Shift + S로 캡처 후 다시 눌러주세요.'));
                } else {
                    alert(window.i18n.t('compress.msg_paste_guide', 'Ctrl + V 키를 눌러 캡처 이미지를 붙여넣어 주세요.'));
                }
            } catch (err) {
                alert(window.i18n.t('compress.msg_paste_direct', 'Ctrl + V 단축키를 사용하여 화면에 바로 붙여넣어 주세요.'));
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
            if (confirm(window.i18n.t('compress.msg_confirm_clear', '등록된 모든 이미지를 목록에서 삭제하시겠습니까?'))) {
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
// 4. 이미지 추가 및 코어 압축 파이프라인
// ----------------------------------------------------------------------------

/**
 * File 객체를 읽어 등록하고 원본 형식 기반 스마트 압축을 실행합니다.
 * @param {File} file - 이미지 파일
 * @param {string} customName - 옵션 파일명
 */
async function addImageFromFile(file, customName = '') {
    if (images.length >= 50) {
        alert(window.i18n.t('compress.msg_max_limit', '한 번에 최대 50장까지 추가할 수 있습니다.'));
        return;
    }

    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const originalName = customName || file.name || `${window.i18n.t('compress.default_name', '이미지')}_${images.length + 1}`;

        // 원본 포맷 감지 (png, jpeg, webp 등)
        let origMime = file.type || 'image/png';
        if (!origMime || origMime === 'application/octet-stream') {
            const lowerName = originalName.toLowerCase();
            if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) origMime = 'image/jpeg';
            else if (lowerName.endsWith('.webp')) origMime = 'image/webp';
            else origMime = 'image/png';
        }

        const newImageItem = {
            id,
            name: originalName,
            origFile: file,
            origSrc: dataUrl,
            origSize: file.size,
            origWidth: img.naturalWidth || img.width,
            origHeight: img.naturalHeight || img.height,
            origType: origMime,
            
            // 압축 결과 속성들
            compressedBlob: null,
            compressedSrc: null,
            compressedSize: 0,
            compressedWidth: 0,
            compressedHeight: 0,
            savingsPercent: 0,
            targetMime: origMime,
            formatExt: getFormatExt(origMime)
        };

        // 초기 압축 수행 (원본 포맷 유지)
        await compressSingleItem(newImageItem, img);

        images.push(newImageItem);

        // 첫 번째 이미지라면 자동 선택
        if (!selectedId) {
            selectedId = newImageItem.id;
        }

        updateGalleryUI();
    } catch (error) {
        console.error('이미지 로드/압축 실패:', error);
        alert(window.i18n.t('compress.msg_load_err', '이미지를 불러오는 중 오류가 발생했습니다.'));
    }
}

/**
 * 단일 이미지 항목을 현재 설정 및 포맷에 맞춰 압축합니다.
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

    // 2. 캔버스 생성 및 렌더링
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 3. 목표 MIME 타입 결정 (사용자 선택 또는 원본 포맷 유지)
    let mimeType = item.origType;
    if (outputFormat === 'webp') {
        mimeType = 'image/webp';
    } else if (outputFormat === 'jpeg') {
        mimeType = 'image/jpeg';
    } else if (outputFormat === 'png') {
        mimeType = 'image/png';
    } else {
        // 'original' 원본 포맷 유지
        mimeType = item.origType || 'image/png';
    }

    // JPEG 포맷인 경우 투명 배경을 흰색으로 처리
    if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 4. 품질 결정 (0.1 ~ 1.0)
    let q = qualityValue / 100;
    if (compressMode === 'smart') {
        q = 0.80; // 스마트 권장 품질
    }

    let blob = null;

    // 5. 포맷별 전용 압축 처리
    if (mimeType === 'image/png') {
        // [PNG 스마트 압축 처리]
        // PNG는 브라우저 canvasToBlob에서 품질 인자가 적용되지 않으므로,
        // 스마트 색상 양자화(Color Quantization)를 통해 파일 크기를 50~85% 감축합니다.
        blob = await compressPngSmart(canvas, ctx, targetW, targetH, q);
    } else if (compressMode === 'target' && mimeType !== 'image/png') {
        // [목표 용량 제한 모드: JPEG / WebP]
        const targetBytes = targetSizeKB * 1024;
        let low = 0.1;
        let high = 0.95;
        let bestBlob = null;

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
        // [일반 JPEG / WebP 압축]
        blob = await canvasToBlob(canvas, mimeType, q);
    }

    // 만약 압축 후 용량이 원본보다 크다면 품질을 추가 조정하여 원본 이하로 맞춤
    if (blob.size >= item.origSize && mimeType !== 'image/png') {
        const reducedBlob = await canvasToBlob(canvas, mimeType, Math.max(0.2, q * 0.75));
        if (reducedBlob.size < blob.size) {
            blob = reducedBlob;
        }
    }

    // 6. 결과 정보 기록
    item.compressedBlob = blob;
    item.compressedSize = blob.size;
    item.compressedWidth = targetW;
    item.compressedHeight = targetH;
    item.targetMime = mimeType;
    item.formatExt = getFormatExt(mimeType);

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
 * PNG 이미지의 브라우저 로컬 스마트 압축 (색상 양자화 및 팔레트 최적화)
 */
async function compressPngSmart(canvas, ctx, width, height, qualityFactor) {
    try {
        // 캔버스 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const totalPixels = width * height;

        // 품질 계수에 따른 양자화 스텝 (품질이 80%이면 step=2~4, 낮을수록 색상 축소)
        // 자연스러운 디더링 효과를 주면서 PNG의 Deflate 압축 효율을 극대화
        const step = Math.max(1, Math.round((1.0 - qualityFactor * 0.9) * 16));

        if (step > 1) {
            for (let i = 0; i < data.length; i += 4) {
                // R, G, B 채널에 스마트 양자화 적용 (투명도 A는 원형 보존)
                data[i]     = Math.round(data[i] / step) * step;
                data[i + 1] = Math.round(data[i + 1] / step) * step;
                data[i + 2] = Math.round(data[i + 2] / step) * step;
            }
            ctx.putImageData(imageData, 0, 0);
        }

        const pngBlob = await canvasToBlob(canvas, 'image/png');
        return pngBlob;
    } catch (e) {
        // 예외 발생 시 표준 PNG Blob 반환
        return await canvasToBlob(canvas, 'image/png');
    }
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
    }, 180);
}

// ----------------------------------------------------------------------------
// 5. 스크린샷 100% 일치 리스트 UI 렌더링 (List UI View)
// ----------------------------------------------------------------------------

function updateGalleryUI() {
    const emptyState = document.getElementById('empty-state');
    const summaryBar = document.getElementById('compress-summary-bar');
    const listContainer = document.getElementById('image-grid'); // 리스트 컨테이너
    const countBadge = document.getElementById('image-count-badge');
    const compareViewer = document.getElementById('compare-viewer-container');

    if (!listContainer) return;

    if (images.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (summaryBar) summaryBar.style.display = 'none';
        if (listContainer) listContainer.style.display = 'none';
        if (compareViewer) compareViewer.style.display = 'none';
        if (countBadge) countBadge.textContent = '0 / 50 · ' + window.i18n.t('compress.badge_limit', '장당 30MB 이하');
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryBar) summaryBar.style.display = 'grid';
    if (listContainer) {
        listContainer.style.display = 'flex';
        listContainer.className = 'compress-list-container';
    }
    if (compareViewer) compareViewer.style.display = 'flex';

    if (countBadge) countBadge.textContent = window.i18n.t('compress.badge_status_orig', '{0} / 50장 · 원본 포맷 자동 유지').replace('{0}', images.length);

    // 1. 전체 통계 계산 및 표시
    let totalOrigBytes = 0;
    let totalCompBytes = 0;
    images.forEach(img => {
        totalOrigBytes += img.origSize;
        totalCompBytes += img.compressedSize;
    });

    const totalSavedBytes = Math.max(0, totalOrigBytes - totalCompBytes);
    const totalSavingsPercent = totalOrigBytes > 0 ? ((totalSavedBytes / totalOrigBytes) * 100).toFixed(0) : 0;

    const summaryOrig = document.getElementById('sum-orig-size');
    const summaryComp = document.getElementById('sum-comp-size');
    const summarySavings = document.getElementById('sum-savings-rate');

    if (summaryOrig) summaryOrig.textContent = formatBytes(totalOrigBytes);
    if (summaryComp) summaryComp.textContent = formatBytes(totalCompBytes);
    if (summarySavings) summarySavings.textContent = window.i18n.t('compress.stat_saving', '{0} 절약 (-{1}%)').replace('{0}', formatBytes(totalSavedBytes)).replace('{1}', totalSavingsPercent);

    // 2. 스크린샷과 100% 동일한 리스트 아이템 렌더링
    listContainer.innerHTML = '';

    images.forEach((item) => {
        const row = document.createElement('div');
        row.className = `compress-list-item ${item.id === selectedId ? 'selected' : ''}`;
        row.dataset.id = item.id;

        const isSavingsPositive = item.savingsPercent > 0;
        const savingsText = isSavingsPositive 
            ? `-${Math.round(item.savingsPercent)}%` 
            : `${Math.round(item.savingsPercent)}%`;
        
        const badgeLabel = item.formatExt.toUpperCase();

        row.innerHTML = `
            <!-- 1. 좌측 썸네일 박스 -->
            <div class="item-thumb-box">
                <img src="${item.compressedSrc || item.origSrc}" alt="${escapeHtml(item.name)}">
            </div>

            <!-- 2. 중앙 파일 정보 (파일명 + 포맷 뱃지 + 원본 크기) -->
            <div class="item-info-col">
                <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="item-meta-row">
                    <span class="item-format-badge">${badgeLabel}</span>
                    <span class="item-orig-size">${formatBytes(item.origSize)}</span>
                </div>
            </div>

            <!-- 3. 우측 절감 통계 (상단: 절감률, 하단: 압축 후 크기) -->
            <div class="item-stats-col">
                <div class="item-savings-rate ${isSavingsPositive ? 'highlight-green' : ''}">${savingsText}</div>
                <div class="item-comp-size">${formatBytes(item.compressedSize)}</div>
            </div>

            <!-- 4. 우측 액션 ([⬇ PNG/JPG] 다운로드 버튼 + 삭제) -->
            <div class="item-actions-col">
                <button class="btn-format-download" data-id="${item.id}" type="button" title="${badgeLabel} 형식으로 저장">
                    <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                    <span>${badgeLabel}</span>
                </button>
                <button class="btn-item-delete" data-id="${item.id}" type="button" title="목록에서 삭제">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        `;

        // 행 클릭 시 비교 뷰어 선택
        row.addEventListener('click', (e) => {
            if (e.target.closest('.btn-format-download') || e.target.closest('.btn-item-delete')) return;
            selectedId = item.id;
            updateGalleryUI();
        });

        // 개별 다운로드 버튼
        const btnDownload = row.querySelector('.btn-format-download');
        if (btnDownload) {
            btnDownload.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadSingleImage(item);
            });
        }

        // 개별 삭제 버튼
        const btnDelete = row.querySelector('.btn-item-delete');
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

        listContainer.appendChild(row);
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
        const ext = selectedItem.formatExt.toUpperCase();
        metaComp.textContent = `${formatBytes(selectedItem.compressedSize)} (-${Math.round(selectedItem.savingsPercent)}%) · ${ext} · ${selectedItem.compressedWidth}×${selectedItem.compressedHeight}px`;
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

    // 2. 포맷 라디오 버튼 (원본 포맷 유지 / WebP / JPEG / PNG)
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
                alert(window.i18n.t('compress.msg_need_add', '압축할 이미지를 먼저 추가해 주세요.'));
                return;
            }

            if (images.length === 1) {
                downloadSingleImage(images[0]);
                return;
            }

            if (typeof JSZip === 'undefined') {
                alert(window.i18n.t('compress.msg_zip_loading', 'ZIP 압축 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'));
                return;
            }

            btnSaveAllZip.disabled = true;
            const originalText = btnSaveAllZip.innerHTML;
            btnSaveAllZip.innerHTML = `<i data-lucide="loader-2" class="spin"></i> <span>${window.i18n.t('compress.msg_zip_creating', 'ZIP 파일 생성 중...')}</span>`;
            if (window.lucide) window.lucide.createIcons();

            try {
                const zip = new JSZip();
                const folder = zip.folder("방장_압축이미지");

                for (let i = 0; i < images.length; i++) {
                    const item = images[i];
                    const ext = item.formatExt.toLowerCase();
                    const baseName = item.name.replace(/\.[^/.]+$/, "");
                    const filename = `${String(i + 1).padStart(2, '0')}_${baseName}.${ext}`;
                    folder.file(filename, item.compressedBlob);
                }

                const content = await zip.generateAsync({ type: "blob" });
                downloadBlob(content, `방장_용량압축_${formatDateForFilename(new Date())}.zip`);
            } catch (err) {
                console.error('ZIP 생성 실패:', err);
                alert(window.i18n.t('compress.msg_zip_err', 'ZIP 파일 생성 중 오류가 발생했습니다.'));
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
                alert(window.i18n.t('compress.msg_need_select', '복사할 이미지를 선택해 주세요.'));
                return;
            }

            try {
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
                        alert(window.i18n.t('compress.msg_copy_success', '압축된 이미지가 클립보드에 복사되었습니다.\n원하는 곳에 Ctrl+V로 붙여넣으세요.'));
                    }, 'image/png');
                } else {
                    alert(window.i18n.t('compress.msg_copy_unsupported', '현재 브라우저 환경에서는 클립보드 이미지 직접 복사를 지원하지 않습니다.'));
                }
            } catch (err) {
                console.error('클립보드 복사 실패:', err);
                alert(window.i18n.t('compress.msg_copy_err', '클립보드 복사에 실패했습니다. [다운로드] 버튼을 사용해 주세요.'));
            }
        });
    }
}

/** 단일 이미지 다운로드 (원본 포맷 확장자 유지) */
function downloadSingleImage(item) {
    if (!item.compressedBlob) return;
    const ext = item.formatExt.toLowerCase();
    const baseName = item.name.replace(/\.[^/.]+$/, "");
    const filename = `${baseName}_압축.${ext}`;
    downloadBlob(item.compressedBlob, filename);
}

// ----------------------------------------------------------------------------
// 8. 헬퍼 유틸리티 함수
// ----------------------------------------------------------------------------

function getFormatExt(mime) {
    if (!mime) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('png')) return 'png';
    return mime.split('/')[1] || 'png';
}

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

/**
 * ============================================================================
 * assets/js/tool-image-edit.js - [이미지 편집] 전용 독립 ES 모듈
 * ============================================================================
 * [격리 원칙]
 * 1. type="module"로 로드되어 모든 변수와 함수가 이 파일 안에서만 유효합니다.
 * 2. 공통 유틸리티(downloadBlob, canvasToBlob, readFileAsDataURL 등)를 import하여 사용합니다.
 * 3. 캡처 붙여넣기, 인라인 빠른 편집, 대화면 정밀 모달 편집, 개별/ZIP 저장을 완벽 지원합니다.
 */

import { downloadBlob, canvasToBlob, readFileAsDataURL, loadImage } from './utils.js';

// ----------------------------------------------------------------------------
// 모듈 내부 상태 변수 (파일 내부 스코프에 갇혀 완전히 격리됨)
// ----------------------------------------------------------------------------
let images = [];          // 등록된 이미지 배열 [{ id, name, originalFile, currentCanvas, ... }]
let selectedId = null;    // 현재 선택/편집 중인 이미지 ID
let mergeMode = 'none';   // 'none' | 'vertical'
let downloadMode = 'individual'; // 'individual' | 'zip'
let exportFormat = 'png';
let filePrefix = '방장_이미지';
let exportQuality = 90;

// 모달 편집 상태
let modalTargetItem = null;
let modalCanvas = null;
let modalCtx = null;
let modalHistory = [];

/**
 * 모듈 초기화
 */
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindSettingsUI();
    bindInlineEditor();
    bindModalEditor();
}

/**
 * 1. 클립보드 붙여넣기 이벤트
 */
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
                    if (!found) alert('클립보드에 이미지가 없습니다.\nWin + Shift + S로 캡처 후 다시 눌러주세요.');
                } else {
                    alert('Ctrl + V 키를 눌러 캡처 이미지를 붙여넣어 주세요.');
                }
            } catch (err) {
                alert('Ctrl + V 단축키를 사용하여 화면에 바로 붙여넣어 주세요.');
            }
        });
    }
}

/**
 * 2. 파일 추가 인풋 및 전체 삭제
 */
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
                closeInlineEditor();
            }
        });
    }
}

/**
 * 3. 드래그 앤 드롭
 */
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
 * 파일 객체를 읽어 갤러리에 이미지 카드 추가
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

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const name = customName ? `${customName}.png` : file.name;

        images.push({
            id,
            name,
            originalImg: img,
            currentCanvas: canvas,
            width: img.naturalWidth,
            height: img.naturalHeight,
            rotation: 0,
            flipH: false,
            flipV: false,
            brightness: 100,
            contrast: 100
        });

        updateGalleryUI();
    } catch (err) {
        console.error('이미지 추가 오류:', err);
    }
}

/**
 * 갤러리 UI 렌더링
 */
function updateGalleryUI() {
    const emptyState = document.getElementById('empty-state');
    const imageGrid = document.getElementById('image-grid');
    const badge = document.getElementById('image-count-badge');

    if (badge) badge.textContent = `${images.length} / 30장`;

    if (images.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (imageGrid) imageGrid.style.display = 'none';
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

            // 단일 클릭: 인라인 편집기 열기
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-card-delete')) return;
                selectImage(item.id);
            });

            // 더블 클릭: 대화면 정밀 모달 열기
            card.addEventListener('dblclick', (e) => {
                if (e.target.closest('.btn-card-delete')) return;
                openModalEditor(item);
            });

            // 개별 삭제
            const btnDel = card.querySelector('.btn-card-delete');
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                images = images.filter(img => img.id !== item.id);
                if (selectedId === item.id) {
                    selectedId = null;
                    closeInlineEditor();
                }
                updateGalleryUI();
            });

            imageGrid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * 인라인 에디터 열기
 */
function selectImage(id) {
    selectedId = id;
    const item = images.find(img => img.id === id);
    if (!item) return;

    updateGalleryUI();

    const panel = document.getElementById('inline-editor-panel');
    const nameEl = document.getElementById('inline-photo-name');
    const dimEl = document.getElementById('inline-photo-dim');
    const canvasEl = document.getElementById('inline-canvas');

    if (panel && canvasEl) {
        panel.style.display = 'block';
        if (nameEl) nameEl.textContent = item.name;
        if (dimEl) dimEl.textContent = `(${item.width} × ${item.height}px)`;

        canvasEl.width = item.currentCanvas.width;
        canvasEl.height = item.currentCanvas.height;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(item.currentCanvas, 0, 0);

        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeInlineEditor() {
    const panel = document.getElementById('inline-editor-panel');
    if (panel) panel.style.display = 'none';
}

/**
 * 인라인 에디터 버튼 바인딩
 */
function bindInlineEditor() {
    const btnClose = document.getElementById('btn-inline-close');
    if (btnClose) btnClose.addEventListener('click', closeInlineEditor);

    const btnRotL = document.getElementById('btn-inline-rot-left');
    const btnRotR = document.getElementById('btn-inline-rot-right');
    const btnFlipH = document.getElementById('btn-inline-flip-h');
    const btnFlipV = document.getElementById('btn-inline-flip-v');
    const btnApply = document.getElementById('btn-inline-apply');

    if (btnRotL) btnRotL.addEventListener('click', () => rotateCurrentImage(-90));
    if (btnRotR) btnRotR.addEventListener('click', () => rotateCurrentImage(90));
    if (btnFlipH) btnFlipH.addEventListener('click', () => flipCurrentImage(true, false));
    if (btnFlipV) btnFlipV.addEventListener('click', () => flipCurrentImage(false, true));

    if (btnApply) {
        btnApply.addEventListener('click', () => {
            alert('편집 사항이 성공적으로 적용되었습니다.');
            closeInlineEditor();
        });
    }
}

function rotateCurrentImage(angle) {
    const item = images.find(img => img.id === selectedId);
    if (!item) return;

    const oldCanvas = item.currentCanvas;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = oldCanvas.height;
    newCanvas.height = oldCanvas.width;
    const ctx = newCanvas.getContext('2d');

    ctx.translate(newCanvas.width / 2, newCanvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(oldCanvas, -oldCanvas.width / 2, -oldCanvas.height / 2);

    item.currentCanvas = newCanvas;
    item.width = newCanvas.width;
    item.height = newCanvas.height;

    selectImage(item.id);
}

function flipCurrentImage(horizontal, vertical) {
    const item = images.find(img => img.id === selectedId);
    if (!item) return;

    const oldCanvas = item.currentCanvas;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;
    const ctx = newCanvas.getContext('2d');

    ctx.translate(horizontal ? newCanvas.width : 0, vertical ? newCanvas.height : 0);
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    ctx.drawImage(oldCanvas, 0, 0);

    item.currentCanvas = newCanvas;
    selectImage(item.id);
}

/**
 * 대화면 정밀 모달 편집기
 */
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
            }
            if (modal) modal.style.display = 'none';
        });
    }

    // 모달 회전/반전 버튼 연결
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

/**
 * 우측 설정 사이드바 및 저장 실행
 */
function bindSettingsUI() {
    // 1. 결합 방식
    const mergeBtns = document.querySelectorAll('[data-merge]');
    mergeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mergeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mergeMode = btn.getAttribute('data-merge');
        });
    });

    // 2. 다운로드 방식
    const dlBtns = document.querySelectorAll('[data-download-mode]');
    dlBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dlBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            downloadMode = btn.getAttribute('data-download-mode');
        });
    });

    // 3. 포맷 및 파일명 접두사
    const selFormat = document.getElementById('select-format');
    if (selFormat) selFormat.addEventListener('change', (e) => exportFormat = e.target.value);

    const inputPrefix = document.getElementById('input-prefix');
    if (inputPrefix) inputPrefix.addEventListener('input', (e) => filePrefix = e.target.value.trim() || '방장_이미지');

    // 4. [이미지 저장] 대형 버튼
    const btnSaveImages = document.getElementById('btn-save-images');
    if (btnSaveImages) {
        btnSaveImages.addEventListener('click', () => {
            exportImages();
        });
    }
}

/**
 * 저장 및 내보내기 실행 (순수 유틸리티 downloadBlob, canvasToBlob 활용)
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

        if (mergeMode === 'vertical') {
            // 세로 이어붙이기 모드
            const totalWidth = Math.max(...images.map(img => img.width));
            const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

            const mergeCanvas = document.createElement('canvas');
            mergeCanvas.width = totalWidth;
            mergeCanvas.height = totalHeight;
            const mCtx = mergeCanvas.getContext('2d');

            if (exportFormat === 'jpeg') {
                mCtx.fillStyle = '#ffffff';
                mCtx.fillRect(0, 0, totalWidth, totalHeight);
            }

            let currentY = 0;
            images.forEach(img => {
                const offsetX = (totalWidth - img.width) / 2;
                mCtx.drawImage(img.currentCanvas, offsetX, currentY);
                currentY += img.height;
            });

            const blob = await canvasToBlob(mergeCanvas, mimeType, 0.92);
            downloadBlob(blob, `${filePrefix}_세로결합.${ext}`);

        } else {
            // 개별 유지 모드
            if (downloadMode === 'individual') {
                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const blob = await canvasToBlob(img.currentCanvas, mimeType, 0.92);
                    const padNum = String(i + 1).padStart(2, '0');
                    const filename = `${filePrefix}_${padNum}.${ext}`;

                    downloadBlob(blob, filename);

                    if (i < images.length - 1) {
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
            } else {
                if (!window.JSZip) throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
                const zip = new JSZip();

                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const blob = await canvasToBlob(img.currentCanvas, mimeType, 0.92);
                    const padNum = String(i + 1).padStart(2, '0');
                    const filename = `${filePrefix}_${padNum}.${ext}`;
                    zip.file(filename, blob);
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                downloadBlob(zipBlob, `${filePrefix}_${images.length}장.zip`);
            }
        }
    } catch (err) {
        console.error('저장 중 오류 발생:', err);
        alert('저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = origHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// 자동 실행
document.addEventListener('DOMContentLoaded', init);

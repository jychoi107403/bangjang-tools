/**
 * ============================================================================
 * assets/js/tool-batch-rename.js - [파일명 일괄 변경] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. Win+Shift+S 캡처(Ctrl+V), 파일 드래그앤드롭 및 파일 선택 지원
 * 2. 캡처 이미지 등록 시 스크린샷과 동일한 타임스탬프 파일명 자동 생성
 * 3. 공통 이름, 시작 번호, 번호 자릿수(패딩) 실시간 미리보기 테이블 렌더링
 * 4. 위/아래(↑/↓) 순서 변경, 개별 삭제 및 원본 이름순 정렬
 * 5. JSZip 라이브러리를 활용한 원본 파일 무손실 일괄 ZIP 압축 다운로드
 */

import { downloadBlob } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 상태 변수
// ----------------------------------------------------------------------------
let filesList = []; // [ { id, file, originalName, size, ext } ]
let fileIdCounter = 1;

// DOM 요소 캐싱 변수
let btnPaste = null;
let fileInput = null;
let btnClear = null;
let statusBadge = null;
let dropZone = null;
let inputCommonName = null;
let inputStartNum = null;
let inputDigitCount = null;
let btnSortByName = null;
let tableBody = null;
let emptyRow = null;
let btnSaveZip = null;
let noticeMsg = null;

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
    btnPaste = document.getElementById('btn-rename-paste');
    fileInput = document.getElementById('rename-file-input');
    btnClear = document.getElementById('btn-rename-clear');
    statusBadge = document.getElementById('rename-status-badge');
    dropZone = document.getElementById('rename-drop-zone');
    inputCommonName = document.getElementById('input-common-name');
    inputStartNum = document.getElementById('input-start-num');
    inputDigitCount = document.getElementById('input-digit-count');
    btnSortByName = document.getElementById('btn-sort-by-name');
    tableBody = document.getElementById('rename-table-body');
    emptyRow = document.getElementById('rename-empty-row');
    btnSaveZip = document.getElementById('btn-save-zip');
    noticeMsg = document.getElementById('action-notice-msg');

    // 이벤트 리스너 바인딩
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDrop();
    bindOptionInputs();
    bindSortAndClear();
    bindZipDownload();

    updateUI();
}

/**
 * ============================================================================
 * 3. 입력 처리 (클립보드 붙여넣기, 파일 선택, 드래그앤드롭)
 * ============================================================================
 */
function bindPasteEvents() {
    // Win+Shift+S 캡처 후 Ctrl+V 붙여넣기
    window.addEventListener('paste', async (e) => {
        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        let addedCount = 0;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    // 스크린샷과 동일한 타임스탬프 파일명 포맷: 캡처_YYYYMMDDHHmmssfff_N.png
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const date = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const mins = String(now.getMinutes()).padStart(2, '0');
                    const secs = String(now.getSeconds()).padStart(2, '0');
                    const ms = String(now.getMilliseconds()).padStart(3, '0');
                    const timeStr = `${year}${month}${date}${hours}${mins}${secs}${ms}_1`;
                    const captureName = `캡처_${timeStr}.png`;

                    addFileToList(file, captureName);
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            showNoticeMessage('목록에 추가했습니다. 확장자와 파일 내용은 그대로 유지됩니다.');
            updateUI();
        }
    });

    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    let added = false;
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        if (types.length > 0) {
                            const blob = await item.getType(types[0]);
                            const now = new Date();
                            const captureName = `캡처_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}${String(now.getMilliseconds()).padStart(3,'0')}_1.png`;
                            const file = new File([blob], captureName, { type: types[0] });
                            addFileToList(file, captureName);
                            added = true;
                        }
                    }
                    if (added) {
                        showNoticeMessage('목록에 추가했습니다. 확장자와 파일 내용은 그대로 유지됩니다.');
                        updateUI();
                        return;
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
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                files.forEach(f => addFileToList(f, f.name));
                showNoticeMessage('목록에 추가했습니다. 확장자와 파일 내용은 그대로 유지됩니다.');
                updateUI();
            }
            fileInput.value = '';
        });
    }
}

function bindDragAndDrop() {
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

    dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files && files.length > 0) {
            files.forEach(f => addFileToList(f, f.name));
            showNoticeMessage('목록에 추가했습니다. 확장자와 파일 내용은 그대로 유지됩니다.');
            updateUI();
        }
    });

    // 드롭존 클릭 시 파일 선택창 오픈
    dropZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });
}

/**
 * 단일 파일을 내부 리스트에 추가
 */
function addFileToList(file, originalName) {
    if (filesList.length >= 2000) {
        alert('최대 등록 가능한 파일 개수는 2,000개입니다.');
        return;
    }

    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex + 1) : 'png';

    filesList.push({
        id: fileIdCounter++,
        file: file,
        originalName: originalName,
        size: file.size,
        ext: ext
    });
}

/**
 * ============================================================================
 * 4. 옵션 변경 및 테이블 렌더링
 * ============================================================================
 */
function bindOptionInputs() {
    [inputCommonName, inputStartNum, inputDigitCount].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            updateTableRowsOnly();
        });
    });
}

function bindSortAndClear() {
    // 원본 이름순 정렬 버튼
    if (btnSortByName) {
        btnSortByName.addEventListener('click', () => {
            if (filesList.length <= 1) return;
            filesList.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true, sensitivity: 'base' }));
            updateUI();
        });
    }

    // 전체 삭제 버튼
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (filesList.length === 0) return;
            if (confirm('등록된 모든 파일을 목록에서 삭제하시겠습니까?')) {
                filesList.length = 0;
                if (noticeMsg) noticeMsg.textContent = '';
                updateUI();
            }
        });
    }
}

/**
 * 전체 UI 동기화 (배지, 테이블, 버튼 상태)
 */
function updateUI() {
    updateStatusBadge();
    renderTable();
    updateSaveButtonState();
}

/**
 * 상단 개수 및 총 용량 배지 갱신 (예: 3개 · 56 KB)
 */
function updateStatusBadge() {
    if (!statusBadge) return;
    const count = filesList.length;
    const totalBytes = filesList.reduce((acc, cur) => acc + cur.size, 0);

    let sizeStr = '0 KB';
    if (totalBytes > 0) {
        if (totalBytes < 1024 * 1024) {
            sizeStr = `${Math.round(totalBytes / 1024)} KB`;
        } else {
            sizeStr = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }

    statusBadge.textContent = `${count}개 · ${sizeStr}`;
}

/**
 * 변경 후 파일명 계산 로직
 */
function calculateNewFilename(index, ext) {
    const commonName = inputCommonName ? (inputCommonName.value.trim() || '상품이미지') : '상품이미지';
    const startNum = inputStartNum ? (parseInt(inputStartNum.value, 10) || 1) : 1;
    const digitCount = inputDigitCount ? Math.max(1, Math.min(10, parseInt(inputDigitCount.value, 10) || 3)) : 3;

    const currentNumber = startNum + index;
    const formattedNum = String(currentNumber).padStart(digitCount, '0');

    return `${commonName}_${formattedNum}.${ext}`;
}

/**
 * 전체 테이블 렌더링
 */
function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (filesList.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'empty-row';
        tr.id = 'rename-empty-row';
        tr.innerHTML = `
            <td colspan="3" class="empty-cell">
                Ctrl+V로 캡처를 붙여넣거나 상단에서 파일을 추가하세요.
            </td>
        `;
        tableBody.appendChild(tr);
        return;
    }

    filesList.forEach((item, index) => {
        const newFilename = calculateNewFilename(index, item.ext);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><span class="orig-name-text">${escapeHtml(item.originalName)}</span></td>
            <td><span class="renamed-text" id="renamed-name-${item.id}">${escapeHtml(newFilename)}</span></td>
            <td>
                <div class="row-action-group">
                    <button class="btn-row-action btn-order-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="위로 이동">↑</button>
                    <button class="btn-row-action btn-order-down" data-index="${index}" ${index === filesList.length - 1 ? 'disabled' : ''} title="아래로 이동">↓</button>
                    <button class="btn-row-action delete-action btn-item-delete" data-index="${index}">삭제</button>
                </div>
            </td>
        `;

        // 위로 이동
        tr.querySelector('.btn-order-up').addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (idx > 0) {
                const temp = filesList[idx];
                filesList[idx] = filesList[idx - 1];
                filesList[idx - 1] = temp;
                updateUI();
            }
        });

        // 아래로 이동
        tr.querySelector('.btn-order-down').addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (idx < filesList.length - 1) {
                const temp = filesList[idx];
                filesList[idx] = filesList[idx + 1];
                filesList[idx + 1] = temp;
                updateUI();
            }
        });

        // 개별 삭제
        tr.querySelector('.btn-item-delete').addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            filesList.splice(idx, 1);
            updateUI();
        });

        tableBody.appendChild(tr);
    });
}

/**
 * 인풋 값 변경 시 테이블의 '변경 후 이름' 텍스트만 고속 업데이트
 */
function updateTableRowsOnly() {
    if (filesList.length === 0) return;
    filesList.forEach((item, index) => {
        const el = document.getElementById(`renamed-name-${item.id}`);
        if (el) {
            el.textContent = calculateNewFilename(index, item.ext);
        }
    });
}

function updateSaveButtonState() {
    if (btnSaveZip) {
        btnSaveZip.disabled = filesList.length === 0;
    }
}

function showNoticeMessage(msg) {
    if (noticeMsg) {
        noticeMsg.textContent = msg;
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * ============================================================================
 * 5. 새 이름으로 ZIP 일괄 다운로드
 * ============================================================================
 */
function bindZipDownload() {
    if (!btnSaveZip) return;

    btnSaveZip.addEventListener('click', async () => {
        if (filesList.length === 0) {
            alert('저장할 파일이 없습니다. 먼저 파일을 추가해주세요.');
            return;
        }

        if (!window.JSZip) {
            alert('ZIP 압축 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const originalBtnHtml = btnSaveZip.innerHTML;
        btnSaveZip.disabled = true;
        btnSaveZip.innerHTML = `<i data-lucide="loader-2" class="spin-icon"></i> <span>ZIP 압축 중...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
            const zip = new window.JSZip();

            // 변경된 이름으로 파일들을 ZIP에 추가
            for (let i = 0; i < filesList.length; i++) {
                const item = filesList[i];
                const newName = calculateNewFilename(i, item.ext);
                zip.file(newName, item.file);
            }

            // ZIP 생성
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const commonName = inputCommonName ? (inputCommonName.value.trim() || '파일명_일괄변경') : '파일명_일괄변경';
            const zipFilename = `${commonName}_일괄저장.zip`;

            downloadBlob(zipBlob, zipFilename);

            showNoticeMessage(`총 ${filesList.length}개 파일이 '${zipFilename}'으로 저장되었습니다.`);

        } catch (err) {
            console.error('ZIP 저장 오류:', err);
            alert('ZIP 압축 다운로드 중 오류가 발생했습니다: ' + err.message);
        } finally {
            btnSaveZip.disabled = false;
            btnSaveZip.innerHTML = originalBtnHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    });
}

// ----------------------------------------------------------------------------
// 6. 브라우저 로드 시 자동 실행
// ----------------------------------------------------------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

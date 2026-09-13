/**
 * ============================================================================
 * assets/js/tool-batch-rename.js - [파일명 일괄 변경] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. Win+Shift+S 캡처(Ctrl+V), [붙여넣기] 버튼, [파일 추가], 드래그앤드롭 다중 파일 등록
 * 2. 공통 이름, 시작 번호, 번호 자릿수 실시간 Before/After 리네이밍 계산 및 테이블 반영
 * 3. 파일 순서 이동 (위/아래), 개별 삭제, 원본 이름순 일괄 정렬, 전체 삭제
 * 4. JSZip을 활용한 변경된 새 파일명 100% 로컬 ZIP 일괄 압축 및 다운로드 (서버 전송 0%)
 */

import { downloadBlob, formatFileSize } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
/**
 * 등록된 파일 목록 배열
 * 각 항목 형태: { id, file, originalName, extension, size }
 */
let fileList = [];
let pasteCounter = 1;

// DOM 요소 캐싱 변수
let dropZone = null;
let emptyState = null;
let tableBody = null;
let emptyTableRow = null;
let countBadge = null;
let inputCommonName = null;
let inputStartNum = null;
let inputNumDigits = null;
let btnPaste = null;
let btnClear = null;
let fileInput = null;
let btnSort = null;
let btnSaveZip = null;
let zipNoticeMsg = null;

/**
 * ============================================================================
 * 2. 초기화 함수 (DOM 로드 후 1회 실행)
 * ============================================================================
 */
function init() {
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // DOM 요소 연결
    dropZone = document.getElementById('rename-drop-zone');
    emptyState = document.getElementById('rename-empty-state');
    tableBody = document.getElementById('rename-table-body');
    emptyTableRow = document.getElementById('empty-table-row');
    countBadge = document.getElementById('rename-count-badge');
    inputCommonName = document.getElementById('input-common-name');
    inputStartNum = document.getElementById('input-start-num');
    inputNumDigits = document.getElementById('input-num-digits');
    btnPaste = document.getElementById('btn-rename-paste');
    btnClear = document.getElementById('btn-rename-clear');
    fileInput = document.getElementById('rename-file-input');
    btnSort = document.getElementById('btn-sort-original-name');
    btnSaveZip = document.getElementById('btn-save-zip');
    zipNoticeMsg = document.getElementById('zip-notice-msg');

    // 이벤트 리스너 바인딩
    bindPasteEvents();
    bindFileInputEvents();
    bindDragAndDropEvents();
    bindSettingsInputEvents();
    bindActionEvents();

    renderTable();
}

/**
 * ============================================================================
 * 3. 이벤트 바인딩 함수들
 * ============================================================================
 */

/**
 * 클립보드 붙여넣기 이벤트 바인딩 (Ctrl+V 및 붙여넣기 버튼)
 */
function bindPasteEvents() {
    // 키보드 Ctrl+V 단축키 감지
    window.addEventListener('paste', async (e) => {
        // 인풋이나 텍스트에 포커스된 경우는 기본 붙여넣기 허용
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        const items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        const filesToAdd = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const now = new Date();
                    const timeStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}${String(now.getMilliseconds()).padStart(3,'0')}`;
                    const customName = `캡처_${timeStr}_${pasteCounter++}.png`;
                    const newFile = new File([blob], customName, { type: blob.type });
                    filesToAdd.push(newFile);
                }
            }
        }

        if (filesToAdd.length > 0) {
            e.preventDefault();
            addFiles(filesToAdd);
        }
    });

    // 상단 [붙여넣기] 버튼 클릭
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.read) {
                    const items = await navigator.clipboard.read();
                    const filesToAdd = [];
                    for (const item of items) {
                        const types = item.types.filter(t => t.startsWith('image/'));
                        if (types.length > 0) {
                            const blob = await item.getType(types[0]);
                            const now = new Date();
                            const timeStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
                            const ext = types[0].split('/')[1] || 'png';
                            const customName = `붙여넣기_${timeStr}_${pasteCounter++}.${ext}`;
                            const file = new File([blob], customName, { type: types[0] });
                            filesToAdd.push(file);
                        }
                    }
                    if (filesToAdd.length > 0) {
                        addFiles(filesToAdd);
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

/**
 * 파일 선택창 및 전체 삭제 이벤트 바인딩
 */
function bindFileInputEvents() {
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                addFiles(files);
            }
            fileInput.value = '';
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (fileList.length === 0) return;
            if (confirm('등록된 모든 파일을 목록에서 삭제하시겠습니까?')) {
                fileList = [];
                pasteCounter = 1;
                renderTable();
            }
        });
    }
}

/**
 * 드래그 앤 드롭 이벤트 바인딩
 */
function bindDragAndDropEvents() {
    if (!dropZone) return;

    // 드롭존 클릭 시에도 파일 선택창 열기
    dropZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(name => {
        window.addEventListener(name, (e) => {
            e.preventDefault();
            if (dropZone) dropZone.classList.add('drag-active');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        window.addEventListener(name, (e) => {
            e.preventDefault();
            if (dropZone) dropZone.classList.remove('drag-active');
        });
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
    });
}

/**
 * 공통 이름, 시작 번호, 번호 자릿수 인풋 변경 이벤트
 */
function bindSettingsInputEvents() {
    const inputs = [inputCommonName, inputStartNum, inputNumDigits];
    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            renderTable();
        });
    });
}

/**
 * 정렬 및 ZIP 저장 버튼 액션 바인딩
 */
function bindActionEvents() {
    // [원본 이름순 정렬] 버튼
    if (btnSort) {
        btnSort.addEventListener('click', () => {
            if (fileList.length <= 1) return;
            fileList.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true, sensitivity: 'base' }));
            renderTable();
        });
    }

    // [새 이름으로 ZIP 저장] 버튼
    if (btnSaveZip) {
        btnSaveZip.addEventListener('click', executeSaveZip);
    }
}

/**
 * ============================================================================
 * 4. 파일 등록 및 리네이밍 계산 로직
 * ============================================================================
 */

/**
 * 파일 목록에 새 파일들 추가
 */
function addFiles(newFiles) {
    let addedCount = 0;
    for (const file of newFiles) {
        if (fileList.length >= 2000) {
            alert('최대 등록 가능한 파일 개수는 2,000개입니다.');
            break;
        }

        const fullName = file.name;
        const lastDot = fullName.lastIndexOf('.');
        const baseName = lastDot !== -1 ? fullName.substring(0, lastDot) : fullName;
        const ext = lastDot !== -1 ? fullName.substring(lastDot + 1) : '';

        fileList.push({
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file: file,
            originalName: fullName,
            baseName: baseName,
            extension: ext,
            size: file.size
        });
        addedCount++;
    }

    if (addedCount > 0) {
        renderTable();
    }
}

/**
 * 규칙에 따른 변경 후 새 파일명 계산
 */
function computeNewFileName(index) {
    const commonName = inputCommonName ? (inputCommonName.value.trim() || '파일') : '파일';
    const startNum = inputStartNum ? Math.max(0, parseInt(inputStartNum.value, 10) || 1) : 1;
    const digits = inputNumDigits ? Math.max(1, Math.min(10, parseInt(inputNumDigits.value, 10) || 3)) : 3;

    const currentNum = startNum + index;
    const paddedNum = String(currentNum).padStart(digits, '0');

    const item = fileList[index];
    const ext = item ? item.extension : '';

    if (ext) {
        return `${commonName}_${paddedNum}.${ext}`;
    }
    return `${commonName}_${paddedNum}`;
}

/**
 * ============================================================================
 * 5. 테이블 렌더링 & UI 갱신
 * ============================================================================
 */
function renderTable() {
    if (!tableBody) return;

    // 1. 배지 및 상태 업데이트
    const totalCount = fileList.length;
    let totalSize = 0;
    fileList.forEach(f => { totalSize += f.size; });

    if (countBadge) {
        countBadge.textContent = `${totalCount}개 · ${formatFileSize(totalSize)}`;
    }

    if (btnSaveZip) {
        btnSaveZip.disabled = totalCount === 0;
    }

    // 2. 테이블 비우기
    tableBody.innerHTML = '';

    // 빈 상태 처리
    if (totalCount === 0) {
        if (emptyState) emptyState.style.display = 'block';
        const emptyTr = document.createElement('tr');
        emptyTr.className = 'empty-table-row';
        emptyTr.innerHTML = `
            <td colspan="3" class="empty-table-cell">
                Ctrl+V로 캡처를 붙여넣거나 상단에서 파일을 추가하세요.
            </td>
        `;
        tableBody.appendChild(emptyTr);
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 3. 파일 목록 행 추가
    fileList.forEach((item, index) => {
        const newName = computeNewFileName(index);

        const tr = document.createElement('tr');
        tr.className = 'rename-table-row';

        // 원본 이름
        const tdOrig = document.createElement('td');
        tdOrig.className = 'col-orig-name';
        tdOrig.textContent = item.originalName;

        // 변경 후 이름
        const tdNew = document.createElement('td');
        tdNew.className = 'col-new-name';
        tdNew.textContent = newName;

        // 조작 버튼 (위로, 아래로, 삭제)
        const tdActions = document.createElement('td');
        tdActions.className = 'col-actions';

        const actionGroup = document.createElement('div');
        actionGroup.className = 'row-action-group';

        // 위로 이동 버튼
        const btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.className = 'btn-row-action';
        btnUp.textContent = '↑';
        btnUp.title = '위로 이동';
        btnUp.disabled = index === 0;
        btnUp.addEventListener('click', () => moveItem(index, -1));

        // 아래로 이동 버튼
        const btnDown = document.createElement('button');
        btnDown.type = 'button';
        btnDown.className = 'btn-row-action';
        btnDown.textContent = '↓';
        btnDown.title = '아래로 이동';
        btnDown.disabled = index === totalCount - 1;
        btnDown.addEventListener('click', () => moveItem(index, 1));

        // 삭제 버튼
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn-row-action btn-del';
        btnDel.textContent = '삭제';
        btnDel.title = '목록에서 삭제';
        btnDel.addEventListener('click', () => deleteItem(index));

        actionGroup.appendChild(btnUp);
        actionGroup.appendChild(btnDown);
        actionGroup.appendChild(btnDel);
        tdActions.appendChild(actionGroup);

        tr.appendChild(tdOrig);
        tr.appendChild(tdNew);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * 항목 위치 변경 (위 / 아래)
 */
function moveItem(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fileList.length) return;

    const temp = fileList[index];
    fileList[index] = fileList[targetIndex];
    fileList[targetIndex] = temp;

    renderTable();
}

/**
 * 개별 항목 삭제
 */
function deleteItem(index) {
    fileList.splice(index, 1);
    renderTable();
}

/**
 * ============================================================================
 * 6. JSZip을 이용한 일괄 ZIP 다운로드 (100% 브라우저 로컬 패키징)
 * ============================================================================
 */
async function executeSaveZip() {
    if (fileList.length === 0) {
        alert('저장할 파일이 없습니다. 먼저 파일을 등록해주세요.');
        return;
    }

    if (!window.JSZip) {
        alert('ZIP 생성 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
        return;
    }

    const origBtnContent = btnSaveZip.innerHTML;
    btnSaveZip.disabled = true;
    btnSaveZip.innerHTML = `<span class="spin-icon">⏳</span> <span>ZIP 압축 중 (0 / ${fileList.length})...</span>`;

    try {
        const zip = new window.JSZip();

        // 각 파일을 변경된 이름으로 ZIP에 추가
        for (let i = 0; i < fileList.length; i++) {
            const item = fileList[i];
            const newName = computeNewFileName(i);

            // 파일 데이터를 ArrayBuffer로 읽기
            const arrayBuffer = await item.file.arrayBuffer();
            zip.file(newName, arrayBuffer);

            // 진행 상태 업데이트
            btnSaveZip.innerHTML = `<span class="spin-icon">⏳</span> <span>ZIP 압축 중 (${i + 1} / ${fileList.length})...</span>`;
        }

        // ZIP 바이너리 생성
        const commonName = inputCommonName ? (inputCommonName.value.trim() || '파일') : '파일';
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const zipFilename = `${commonName}_일괄변경_${Date.now()}.zip`;
        downloadBlob(zipBlob, zipFilename);

        if (zipNoticeMsg) {
            zipNoticeMsg.textContent = `품목이 저장되었습니다. *${fileList.length}개 파일이 성공적으로 압축되었습니다.`;
        }

    } catch (err) {
        console.error('ZIP 생성 실패:', err);
        alert('ZIP 파일 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
        btnSaveZip.disabled = false;
        btnSaveZip.innerHTML = origBtnContent;
        if (window.lucide) window.lucide.createIcons();
    }
}

// ----------------------------------------------------------------------------
// 7. 브라우저 로드 시 자동 초기화
// ----------------------------------------------------------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

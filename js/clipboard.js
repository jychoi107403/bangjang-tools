/**
 * ============================================================================
 * clipboard.js - 클립보드 캡처 붙여넣기 및 파일 드래그앤드롭 관리
 * ============================================================================
 * 역할:
 * 1. Win+Shift+S로 캡처한 이미지의 Ctrl+V 단축키 붙여넣기 감지
 * 2. 상단 [붙여넣기] 버튼 클릭 시 Clipboard API로 클립보드 이미지 추출
 * 3. 파일 드래그 & 드롭(Drag & Drop) 및 [파일 추가] 파일 탐색기 연동
 * 4. 파일 크기(25MB 이하) 및 최대 장수(30장) 유효성 검사
 */

const ClipboardManager = {
    // 최대 등록 가능 사진 수 및 용량 제한 (25MB)
    MAX_COUNT: 30,
    MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,

    /**
     * 클립보드 및 드래그앤드롭 이벤트 리스너 초기화
     */
    init() {
        this.bindPasteShortcuts();
        this.bindDragAndDrop();
        this.bindFileInput();
        this.bindPasteButton();
    },

    /**
     * 1. 전역 Ctrl + V 붙여넣기 단축키 이벤트 리스너
     */
    bindPasteShortcuts() {
        window.addEventListener('paste', (e) => {
            // 텍스트 인풋 등에서 작업 중일 때는 기본 붙여넣기 동작 유지
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' && document.activeElement.type === 'text') {
                return;
            }

            const items = e.clipboardData ? e.clipboardData.items : null;
            if (!items) return;

            let hasImage = false;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        hasImage = true;
                        this.processFile(file, `캡처_이미지_${Date.now()}`);
                    }
                }
            }

            if (hasImage) {
                e.preventDefault();
            }
        });
    },

    /**
     * 2. [붙여넣기] 버튼 클릭 시 비동기 클립보드 읽기
     */
    bindPasteButton() {
        const btnPaste = document.getElementById('btn-paste');
        if (!btnPaste) return;

        btnPaste.addEventListener('click', async () => {
            try {
                // 최신 브라우저의 navigator.clipboard API 사용
                if (navigator.clipboard && navigator.clipboard.read) {
                    const clipboardItems = await navigator.clipboard.read();
                    let found = false;

                    for (const item of clipboardItems) {
                        const imageTypes = item.types.filter(type => type.startsWith('image/'));
                        for (const type of imageTypes) {
                            const blob = await item.getType(type);
                            const file = new File([blob], `붙여넣기_${Date.now()}.${type.split('/')[1]}`, { type });
                            this.processFile(file);
                            found = true;
                        }
                    }

                    if (!found) {
                        alert('클립보드에 복사된 이미지가 없습니다.\nWin + Shift + S로 영역을 캡처한 후 다시 눌러주세요.');
                    }
                } else {
                    alert('Ctrl + V 키를 눌러 캡처 이미지를 붙여넣어 주세요.');
                }
            } catch (err) {
                console.warn('클립보드 접근 권한 오류 또는 미지원 브라우저:', err);
                alert('Ctrl + V 단축키를 사용하여 화면에 바로 붙여넣어 주세요.');
            }
        });
    },

    /**
     * 3. 파일 드래그 & 드롭 이벤트
     */
    bindDragAndDrop() {
        const dropZone = document.getElementById('drop-zone');
        if (!dropZone) return;

        // 드래그가 영역 위로 올라왔을 때
        ['dragenter', 'dragover'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        // 드래그가 영역을 벗어났을 때
        ['dragleave', 'dragend'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        // 파일을 떨어뜨렸을 때 (Drop)
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');

            const files = e.dataTransfer ? e.dataTransfer.files : null;
            if (files && files.length > 0) {
                this.handleFiles(Array.from(files));
            }
        });
    },

    /**
     * 4. [파일 추가] input file 연결
     */
    bindFileInput() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                this.handleFiles(Array.from(files));
            }
            // 같은 파일을 다시 선택할 수 있도록 인풋 초기화
            fileInput.value = '';
        });
    },

    /**
     * 파일 목록 일괄 검증 및 처리
     * @param {Array<File>} files 
     */
    handleFiles(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('이미지 파일(PNG, JPG, WebP, GIF 등)만 추가할 수 있습니다.');
            return;
        }

        imageFiles.forEach(file => this.processFile(file));
    },

    /**
     * 개별 파일 유효성 검사 후 에디터 매니저로 전달
     * @param {File} file 
     * @param {string} customName 
     */
    processFile(file, customName = '') {
        // 장수 제한 확인
        if (ImageEditor.images.length >= this.MAX_COUNT) {
            alert(`최대 ${this.MAX_COUNT}장까지만 추가할 수 있습니다.`);
            return;
        }

        // 용량 제한 확인 (25MB)
        if (file.size > this.MAX_FILE_SIZE_BYTES) {
            alert(`'${file.name}' 파일이 25MB를 초과하여 추가할 수 없습니다.`);
            return;
        }

        const fileName = customName ? `${customName}.${file.type.split('/')[1] || 'png'}` : file.name;
        
        // ImageEditor에 이미지 추가 요청
        ImageEditor.addImage(file, fileName);
    }
};

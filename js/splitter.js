/**
 * ============================================================================
 * splitter.js - 사진 분할(2·4·8·16 분할 및 분할선 직접 조절) 전용 엔진
 * ============================================================================
 * [주요 기능]
 * 1. 사진 한 장을 붙여넣거나 업로드하여 2·4·8·16조각 등으로 균등 분할
 * 2. 캔버스 위에서 마우스로 분할선을 직접 드래그하여 조각 크기/비율 실시간 조절
 * 3. 오른쪽 사이드바의 슬라이더를 통해서도 픽셀 단위로 정밀하게 분할선 이동 가능
 * 4. 가로/세로 크기 변경 및 [원본 크기], [2배], [3배] 확대/축소 프리셋 지원
 * 5. 분할된 조각들을 번호 순서대로 개별 순차 다운로드 또는 ZIP 압축 다운로드
 * 6. 번호 뱃지(①, ②, ③, ④) 및 분할선은 화면 가이드용이며 저장 시에는 순수 이미지만 깔끔하게 크롭 저장
 * 7. EXIF 메타데이터 자동 제거 (브라우저 순수 Canvas Blob 생성 방식)
 */

const ImageSplitter = {
    // ------------------------------------------------------------------------
    // 상태 변수
    // ------------------------------------------------------------------------
    currentImage: null, // { name, file, imgElement, width, height, naturalWidth, naturalHeight, dataUrl }

    // 분할 설정
    splitType: '4', // '2v'(세로2), '2h'(가로2), '4'(2x2), '6'(3x2), '8'(4x2), '9'(3x3), '16'(4x4)
    
    // 분할선 위치 (픽셀 단위 좌표)
    vLines: [], // [{ x: 565, id: 'v1' }]
    hLines: [], // [{ y: 400, id: 'h1' }]

    // 사진 크기 조절 (가로 x 세로)
    targetWidth: 0,
    targetHeight: 0,

    // 저장 설정
    exportFormat: 'png', // 'png' | 'jpeg' | 'webp'
    downloadMode: 'individual', // 'individual' | 'zip'

    // 마우스 드래그 상태
    draggingLine: null, // { type: 'v'|'h', index: 0 }
    isDragging: false,

    /**
     * 모듈 초기화
     */
    init() {
        this.bindEvents();
        this.bindSettingsUI();
    },

    /**
     * 분할 탭 활성화 여부 확인 헬퍼
     */
    isSplitViewActive() {
        const splitView = document.getElementById('view-image-split');
        return splitView && splitView.style.display !== 'none';
    },

    /**
     * 기본 이벤트 바인딩 (붙여넣기, 파일 선택, 드롭존 등)
     */
    bindEvents() {
        // 1. 전역 붙여넣기 이벤트 가로채기 (캡처 단계에서 사진분할 탭일 때만 우선 처리)
        window.addEventListener('paste', (e) => {
            if (!this.isSplitViewActive()) return;

            const items = e.clipboardData ? e.clipboardData.items : null;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.stopImmediatePropagation();
                        e.preventDefault();
                        this.loadImage(file, `캡처_분할_${Date.now()}`);
                        break;
                    }
                }
            }
        }, true); // 캡처링 모드로 기존 리스너보다 먼저 실행

        // 2. [붙여넣기] 버튼 클릭 이벤트
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
                                this.loadImage(file);
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

        // 3. [파일 추가] input file 변경 이벤트
        const fileInput = document.getElementById('split-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadImage(file);
                }
                fileInput.value = '';
            });
        }

        // 4. [전체 삭제] 버튼 클릭
        const btnClear = document.getElementById('btn-split-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (!this.currentImage) return;
                if (confirm('현재 분할 작업을 초기화하고 사진을 삭제하시겠습니까?')) {
                    this.currentImage = null;
                    this.updateUI();
                }
            });
        }

        // 5. 드래그 앤 드롭 영역 이벤트 바인딩
        const dropZone = document.getElementById('split-drop-zone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    if (!this.isSplitViewActive()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('dragover');
                });
            });

            ['dragleave', 'dragend'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    if (!this.isSplitViewActive()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('dragover');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                if (!this.isSplitViewActive()) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                dropZone.classList.remove('dragover');

                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.loadImage(file);
                }
            }, true);
        }

        // 6. 캔버스 마우스 인터랙션 (분할선 드래그 조절)
        this.bindCanvasInteraction();
    },

    /**
     * 이미지 로드 및 초기 분할선 계산
     * @param {File} file 
     * @param {string} customName 
     */
    loadImage(file, customName = '') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = {
                    name: customName ? `${customName}.png` : file.name,
                    file: file,
                    imgElement: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    dataUrl: e.target.result
                };

                // 기본 크기를 원본 이미지 해상도로 초기화
                this.targetWidth = img.naturalWidth;
                this.targetHeight = img.naturalHeight;

                // 4분할(기본) 균등 분할선 생성
                this.calculateEqualSplitLines();
                this.updateUI();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * 조각 수에 맞춰 균등 분할선 위치 자동 계산
     */
    calculateEqualSplitLines() {
        if (!this.currentImage) return;
        const w = this.targetWidth;
        const h = this.targetHeight;

        this.vLines = [];
        this.hLines = [];

        switch (this.splitType) {
            case '2v': // 세로 2분할 (가로 1선으로 상/하 나눔)
                this.hLines = [{ y: Math.round(h / 2), id: 'h1' }];
                break;
            case '2h': // 가로 2분할 (세로 1선으로 좌/우 나눔)
                this.vLines = [{ x: Math.round(w / 2), id: 'v1' }];
                break;
            case '4': // 4분할 (2x2) - 기본값
            default:
                this.vLines = [{ x: Math.round(w / 2), id: 'v1' }];
                this.hLines = [{ y: Math.round(h / 2), id: 'h1' }];
                break;
            case '6': // 6분할 (3x2)
                this.vLines = [
                    { x: Math.round(w / 3), id: 'v1' },
                    { x: Math.round((w * 2) / 3), id: 'v2' }
                ];
                this.hLines = [{ y: Math.round(h / 2), id: 'h1' }];
                break;
            case '8': // 8분할 (4x2)
                this.vLines = [
                    { x: Math.round(w / 4), id: 'v1' },
                    { x: Math.round((w * 2) / 4), id: 'v2' },
                    { x: Math.round((w * 3) / 4), id: 'v3' }
                ];
                this.hLines = [{ y: Math.round(h / 2), id: 'h1' }];
                break;
            case '9': // 9분할 (3x3)
                this.vLines = [
                    { x: Math.round(w / 3), id: 'v1' },
                    { x: Math.round((w * 2) / 3), id: 'v2' }
                ];
                this.hLines = [
                    { y: Math.round(h / 3), id: 'h1' },
                    { y: Math.round((h * 2) / 3), id: 'h2' }
                ];
                break;
            case '16': // 16분할 (4x4)
                this.vLines = [
                    { x: Math.round(w / 4), id: 'v1' },
                    { x: Math.round((w * 2) / 4), id: 'v2' },
                    { x: Math.round((w * 3) / 4), id: 'v3' }
                ];
                this.hLines = [
                    { y: Math.round(h / 4), id: 'h1' },
                    { y: Math.round((h * 2) / 4), id: 'h2' },
                    { y: Math.round((h * 3) / 4), id: 'h3' }
                ];
                break;
        }

        this.updateLineSliders();
    },

    /**
     * UI 및 작업대 표시 상태 갱신
     */
    updateUI() {
        const emptyState = document.getElementById('split-empty-state');
        const workspace = document.getElementById('split-workspace');
        const stateBanner = document.getElementById('split-status-banner');
        const inputW = document.getElementById('input-split-width');
        const inputH = document.getElementById('input-split-height');
        const footerInfo = document.getElementById('split-footer-info');

        if (!this.currentImage) {
            if (emptyState) emptyState.style.display = 'block';
            if (workspace) workspace.style.display = 'none';
            if (stateBanner) stateBanner.textContent = '사진을 추가해주세요.';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (workspace) workspace.style.display = 'block';

        if (stateBanner) {
            stateBanner.textContent = `원본 ${this.currentImage.naturalWidth} × ${this.currentImage.naturalHeight}px → 분할 크기 ${this.targetWidth} × ${this.targetHeight}px`;
        }

        if (inputW) inputW.value = this.targetWidth;
        if (inputH) inputH.value = this.targetHeight;

        // 분할 정보 하단 상태 텍스트
        if (footerInfo) {
            const cols = this.vLines.length + 1;
            const rows = this.hLines.length + 1;
            const total = cols * rows;
            footerInfo.textContent = `가로 ${cols} × 세로 ${rows} · ${total}조각 · 번호·분할선은 저장되지 않습니다.`;
        }

        this.renderCanvas();
    },

    /**
     * 캔버스 렌더링 (이미지 + 분할선 + 원형 번호 뱃지 가이드)
     */
    renderCanvas() {
        const canvas = document.getElementById('split-canvas');
        if (!canvas || !this.currentImage) return;

        canvas.width = this.targetWidth;
        canvas.height = this.targetHeight;
        const ctx = canvas.getContext('2d');

        // 1. 원본 이미지 그리기
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.currentImage.imgElement, 0, 0, this.targetWidth, this.targetHeight);

        // 2. 외곽 테두리 (스크린샷 노란색 가이드)
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // 3. 분할선 그리기 (밝은 보라색 + 그림자 효과)
        ctx.save();
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 6;

        // 세로 분할선
        this.vLines.forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.x, 0);
            ctx.lineTo(line.x, canvas.height);
            ctx.stroke();
        });

        // 가로 분할선
        this.hLines.forEach(line => {
            ctx.beginPath();
            ctx.moveTo(0, line.y);
            ctx.lineTo(canvas.width, line.y);
            ctx.stroke();
        });
        ctx.restore();

        // 4. 각 조각별 번호 뱃지 그리기 (①, ②, ③, ④ ...)
        this.drawPieceBadges(ctx);
    },

    /**
     * 각 분할 조각의 상단 우측에 번호 뱃지 그리기
     */
    drawPieceBadges(ctx) {
        const xs = [0, ...this.vLines.map(l => l.x).sort((a,b) => a - b), this.targetWidth];
        const ys = [0, ...this.hLines.map(l => l.y).sort((a,b) => a - b), this.targetHeight];

        let pieceNumber = 1;
        // 해상도에 비례하는 뱃지 크기 (최소 16px, 최대 40px)
        const radius = Math.max(16, Math.min(this.targetWidth, this.targetHeight) * 0.035);

        for (let row = 0; row < ys.length - 1; row++) {
            for (let col = 0; col < xs.length - 1; col++) {
                const x1 = xs[col];
                const x2 = xs[col + 1];
                const y1 = ys[row];
                const y2 = ys[row + 1];

                // 뱃지 위치: 각 조각의 우측 상단 모서리 안쪽
                const centerX = x2 - radius * 1.5;
                const centerY = y1 + radius * 1.5;

                ctx.save();
                // 뱃지 그림자
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;

                // 보라색 원형 배경
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(109, 40, 217, 0.9)';
                ctx.fill();

                // 흰색 테두리
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 조각 번호 텍스트
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
    },

    /**
     * 캔버스 마우스 드래그 분할선 조절 이벤트 바인딩
     */
    bindCanvasInteraction() {
        const canvas = document.getElementById('split-canvas');
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

        const HIT_RADIUS = 20; // 마우스 클릭 감지 반경(px)

        // 마우스 이동 시: 커서 변경 및 드래그 중인 선 좌표 갱신
        canvas.addEventListener('mousemove', (e) => {
            if (!this.currentImage) return;
            const pos = getCanvasPos(e);

            if (this.isDragging && this.draggingLine) {
                if (this.draggingLine.type === 'v') {
                    const minX = 20;
                    const maxX = this.targetWidth - 20;
                    this.vLines[this.draggingLine.index].x = Math.max(minX, Math.min(pos.x, maxX));
                } else if (this.draggingLine.type === 'h') {
                    const minY = 20;
                    const maxY = this.targetHeight - 20;
                    this.hLines[this.draggingLine.index].y = Math.max(minY, Math.min(pos.y, maxY));
                }
                this.updateLineSliders();
                this.renderCanvas();
                return;
            }

            // 마우스 호버 시 커서 모양 변경 (좌우/상하 리사이즈 아이콘)
            let hovered = null;
            this.vLines.forEach((line, index) => {
                if (Math.abs(line.x - pos.x) < HIT_RADIUS) {
                    hovered = { type: 'v', index };
                }
            });
            this.hLines.forEach((line, index) => {
                if (Math.abs(line.y - pos.y) < HIT_RADIUS) {
                    hovered = { type: 'h', index };
                }
            });

            if (hovered) {
                canvas.style.cursor = hovered.type === 'v' ? 'ew-resize' : 'ns-resize';
            } else {
                canvas.style.cursor = 'default';
            }
        });

        // 마우스 누름: 분할선 선택 및 드래그 시작
        canvas.addEventListener('mousedown', (e) => {
            if (!this.currentImage) return;
            const pos = getCanvasPos(e);

            this.vLines.forEach((line, index) => {
                if (Math.abs(line.x - pos.x) < HIT_RADIUS) {
                    this.isDragging = true;
                    this.draggingLine = { type: 'v', index };
                }
            });

            if (!this.isDragging) {
                this.hLines.forEach((line, index) => {
                    if (Math.abs(line.y - pos.y) < HIT_RADIUS) {
                        this.isDragging = true;
                        this.draggingLine = { type: 'h', index };
                    }
                });
            }
        });

        // 마우스 뗌: 드래그 종료
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.draggingLine = null;
            }
        });
    },

    /**
     * 우측 분할선 위치 슬라이더 동적 생성 및 동기화
     */
    updateLineSliders() {
        const sliderContainer = document.getElementById('split-line-sliders-container');
        if (!sliderContainer) return;

        sliderContainer.innerHTML = '';

        // 세로 분할선 슬라이더
        this.vLines.forEach((line, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'setting-item mt-3';
            wrap.innerHTML = `
                <div class="setting-header-inline">
                    <label class="setting-label">세로선 ${i + 1} · X ${Math.round(line.x)}px</label>
                </div>
                <input type="range" class="form-range" min="10" max="${this.targetWidth - 10}" value="${Math.round(line.x)}">
            `;
            const range = wrap.querySelector('input');
            range.addEventListener('input', (e) => {
                line.x = parseInt(e.target.value, 10);
                wrap.querySelector('.setting-label').textContent = `세로선 ${i + 1} · X ${Math.round(line.x)}px`;
                this.renderCanvas();
            });
            sliderContainer.appendChild(wrap);
        });

        // 가로 분할선 슬라이더
        this.hLines.forEach((line, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'setting-item mt-3';
            wrap.innerHTML = `
                <div class="setting-header-inline">
                    <label class="setting-label">가로선 ${i + 1} · Y ${Math.round(line.y)}px</label>
                </div>
                <input type="range" class="form-range" min="10" max="${this.targetHeight - 10}" value="${Math.round(line.y)}">
            `;
            const range = wrap.querySelector('input');
            range.addEventListener('input', (e) => {
                line.y = parseInt(e.target.value, 10);
                wrap.querySelector('.setting-label').textContent = `가로선 ${i + 1} · Y ${Math.round(line.y)}px`;
                this.renderCanvas();
            });
            sliderContainer.appendChild(wrap);
        });
    },

    /**
     * 우측 설정 사이드바 UI 이벤트 바인딩
     */
    bindSettingsUI() {
        // 1. 크기 조절 인풋 및 비율 고정
        const inputW = document.getElementById('input-split-width');
        const inputH = document.getElementById('input-split-height');
        const chkAspect = document.getElementById('chk-split-aspect');
        const btnApplySize = document.getElementById('btn-apply-split-size');

        const btnOrigSize = document.getElementById('btn-size-orig');
        const btn2xSize = document.getElementById('btn-size-2x');
        const btn3xSize = document.getElementById('btn-size-3x');

        if (inputW && inputH && chkAspect) {
            inputW.addEventListener('input', () => {
                if (chkAspect.checked && this.currentImage) {
                    const ratio = this.currentImage.naturalHeight / this.currentImage.naturalWidth;
                    inputH.value = Math.round(parseInt(inputW.value, 10) * ratio) || '';
                }
            });
            inputH.addEventListener('input', () => {
                if (chkAspect.checked && this.currentImage) {
                    const ratio = this.currentImage.naturalWidth / this.currentImage.naturalHeight;
                    inputW.value = Math.round(parseInt(inputH.value, 10) * ratio) || '';
                }
            });
        }

        if (btnApplySize && inputW && inputH) {
            btnApplySize.addEventListener('click', () => {
                const w = parseInt(inputW.value, 10);
                const h = parseInt(inputH.value, 10);
                if (w > 10 && h > 10) {
                    this.targetWidth = Math.min(w, 16384);
                    this.targetHeight = Math.min(h, 16384);
                    this.calculateEqualSplitLines();
                    this.updateUI();
                }
            });
        }

        // [원본 크기], [2배], [3배] 확대 프리셋 버튼
        if (btnOrigSize) {
            btnOrigSize.addEventListener('click', () => {
                if (!this.currentImage) return;
                this.targetWidth = this.currentImage.naturalWidth;
                this.targetHeight = this.currentImage.naturalHeight;
                this.calculateEqualSplitLines();
                this.updateUI();
            });
        }
        if (btn2xSize) {
            btn2xSize.addEventListener('click', () => {
                if (!this.currentImage) return;
                this.targetWidth = this.currentImage.naturalWidth * 2;
                this.targetHeight = this.currentImage.naturalHeight * 2;
                this.calculateEqualSplitLines();
                this.updateUI();
            });
        }
        if (btn3xSize) {
            btn3xSize.addEventListener('click', () => {
                if (!this.currentImage) return;
                this.targetWidth = this.currentImage.naturalWidth * 3;
                this.targetHeight = this.currentImage.naturalHeight * 3;
                this.calculateEqualSplitLines();
                this.updateUI();
            });
        }

        // 2. 조각 수 선택 드롭다운 (2, 4, 6, 8, 9, 16분할)
        const selectSplitType = document.getElementById('select-split-type');
        if (selectSplitType) {
            selectSplitType.addEventListener('change', (e) => {
                this.splitType = e.target.value;
                this.calculateEqualSplitLines();
                this.updateUI();
            });
        }

        // 3. 균등 분할로 초기화 버튼
        const btnResetLines = document.getElementById('btn-reset-split-lines');
        if (btnResetLines) {
            btnResetLines.addEventListener('click', () => {
                this.calculateEqualSplitLines();
                this.updateUI();
            });
        }

        // 4. 저장 형식 및 다운로드 방식 선택
        const selectFormat = document.getElementById('select-split-format');
        if (selectFormat) {
            selectFormat.addEventListener('change', (e) => {
                this.exportFormat = e.target.value;
            });
        }

        const selectDownload = document.getElementById('select-split-download-mode');
        if (selectDownload) {
            selectDownload.addEventListener('change', (e) => {
                this.downloadMode = e.target.value;
            });
        }

        // 5. [이미지 분할 저장] 대형 버튼 클릭
        const btnSave = document.getElementById('btn-save-split-images');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                this.exportSplitPieces();
            });
        }
    },

    /**
     * ========================================================================
     * 분할 조각 추출 및 다운로드 실행 (순수 이미지 크롭 + EXIF 메타데이터 제거)
     * ========================================================================
     */
    async exportSplitPieces() {
        if (!this.currentImage) {
            alert('분할할 사진을 먼저 추가해주세요.');
            return;
        }

        const btnSave = document.getElementById('btn-save-split-images');
        const originalHTML = btnSave ? btnSave.innerHTML : '';
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>조각 분할 저장 중...</span>`;
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            // 정렬된 가로/세로 분할선 좌표 배열 생성
            const xs = [0, ...this.vLines.map(l => l.x).sort((a,b) => a - b), this.targetWidth];
            const ys = [0, ...this.hLines.map(l => l.y).sort((a,b) => a - b), this.targetHeight];

            const pieces = [];
            let pieceIndex = 1;

            for (let row = 0; row < ys.length - 1; row++) {
                for (let col = 0; col < xs.length - 1; col++) {
                    const x1 = xs[col];
                    const x2 = xs[col + 1];
                    const y1 = ys[row];
                    const y2 = ys[row + 1];
                    const w = x2 - x1;
                    const h = y2 - y1;

                    if (w > 0 && h > 0) {
                        // 개별 조각 캔버스 생성 (분할선/번호 뱃지 없이 순수 이미지만 크롭)
                        const pieceCanvas = document.createElement('canvas');
                        pieceCanvas.width = w;
                        pieceCanvas.height = h;
                        const ctx = pieceCanvas.getContext('2d');

                        // JPG 형식일 때 투명 배경을 흰색으로 처리
                        if (this.exportFormat === 'jpeg') {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, w, h);
                        }

                        // 원본 이미지 비율에 맞춰 정밀하게 크롭 드로잉
                        ctx.drawImage(
                            this.currentImage.imgElement,
                            (x1 / this.targetWidth) * this.currentImage.naturalWidth,
                            (y1 / this.targetHeight) * this.currentImage.naturalHeight,
                            (w / this.targetWidth) * this.currentImage.naturalWidth,
                            (h / this.targetHeight) * this.currentImage.naturalHeight,
                            0, 0, w, h
                        );

                        pieces.push({
                            index: pieceIndex,
                            canvas: pieceCanvas
                        });
                        pieceIndex++;
                    }
                }
            }

            // 다운로드 실행
            const format = this.exportFormat; // 'png', 'jpeg', 'webp'
            const mimeType = `image/${format}`;
            const ext = format === 'jpeg' ? 'jpg' : format;
            const cleanName = (this.currentImage.name || 'image').replace(/\.[^/.]+$/, '');

            if (this.downloadMode === 'individual') {
                // [개별 다운로드]: 각 조각 파일을 순차적으로 다운로드
                for (let i = 0; i < pieces.length; i++) {
                    const p = pieces[i];
                    const blob = await this.canvasToBlob(p.canvas, mimeType, 0.95);
                    const padNum = String(p.index).padStart(2, '0');
                    const filename = `${cleanName}_part${padNum}.${ext}`;

                    this.downloadBlob(blob, filename);

                    // 브라우저 다운로드 팝업 간섭 방지를 위해 200ms 지연
                    if (i < pieces.length - 1) {
                        await new Promise(r => setTimeout(r, 200));
                    }
                }
            } else {
                // [ZIP 압축 다운로드]: JSZip 라이브러리로 묶어서 단일 파일 다운로드
                if (!window.JSZip) throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
                const zip = new JSZip();

                for (let i = 0; i < pieces.length; i++) {
                    const p = pieces[i];
                    const blob = await this.canvasToBlob(p.canvas, mimeType, 0.95);
                    const padNum = String(p.index).padStart(2, '0');
                    const filename = `${cleanName}_part${padNum}.${ext}`;
                    zip.file(filename, blob);
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const zipFilename = `${cleanName}_split_${pieces.length}pieces.zip`;
                this.downloadBlob(zipBlob, zipFilename);
            }

        } catch (error) {
            console.error('사진 분할 저장 오류:', error);
            alert('사진 분할 저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    },

    /**
     * 캔버스를 이미지 Blob 객체로 변환 (EXIF 메타데이터 제거)
     */
    canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas Blob 변환 실패'));
            }, mimeType, quality);
        });
    },

    /**
     * 브라우저 파일 다운로드 트리거
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
};

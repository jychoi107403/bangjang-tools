/**
 * ============================================================================
 * editor.js - 이미지 상태 관리, 하단 인라인 실시간 뷰어 및 Fabric.js 정밀 편집 모달
 * ============================================================================
 * [기능 요약]
 * 1. 카드 단일 클릭 시: 하단 인라인 캔버스에 실시간 설정(크기, 밝기, 테두리, 워터마크) 렌더링
 * 2. 카드 더블클릭 또는 [편집] 클릭 시: 팝업 정밀 편집 모달 오픈 (10대 도구)
 * 3. 카드 [저장] 클릭 시: 해당 사진 1장 즉시 가공 다운로드
 * 4. 100% 브라우저 로컬 그래픽 프로세싱 파이프라인
 */

const ImageEditor = {
    // ------------------------------------------------------------------------
    // 메인 작업대 이미지 상태
    // ------------------------------------------------------------------------
    images: [],
    selectedId: null,
    watermarkImgElement: null,

    // 글로벌 설정값
    settings: {
        resizeHeightEnabled: false,
        targetHeight: 800,
        brightness: 100,
        borderWidth: 0,
        borderColor: '#000000',
        watermarkEnabled: false,
        watermarkType: 'image', // 'image' | 'text'
        watermarkText: '',
        watermarkWidth: 300,
        watermarkPos: 'bottom-right',
        watermarkOpacity: 70,
        watermarkMargin: 30,
        exportFormat: 'jpeg',
        jpgQuality: 90
    },

    /**
     * 초기화
     */
    init() {
        this.bindSettingsEvents();
        this.updateUI();
        ModalEditor.init();
    },

    /**
     * 새 이미지를 목록에 추가
     */
    addImage(file, name) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const imageItem = {
                    id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: name || file.name,
                    file: file,
                    imgElement: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    originalDataUrl: e.target.result,
                    dataUrl: e.target.result
                };

                this.images.push(imageItem);
                this.selectedId = imageItem.id;
                this.updateUI();
                this.renderInlinePreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * 특정 이미지 삭제
     */
    removeImage(id) {
        this.images = this.images.filter(img => img.id !== id);
        if (this.selectedId === id) {
            this.selectedId = this.images.length > 0 ? this.images[0].id : null;
        }
        this.updateUI();
        this.renderInlinePreview();
    },

    /**
     * 전체 이미지 삭제
     */
    clearAll() {
        if (this.images.length === 0) return;
        if (confirm('추가된 모든 이미지를 삭제하시겠습니까?')) {
            this.images = [];
            this.selectedId = null;
            this.updateUI();
            this.renderInlinePreview();
        }
    },

    /**
     * 출력 해상도 계산 헬퍼
     */
    calcOutputDimensions(item) {
        let outW = item.width;
        let outH = item.height;

        if (this.settings.resizeHeightEnabled && this.settings.targetHeight > 0) {
            const targetH = Math.min(Math.max(this.settings.targetHeight, 50), 4096);
            const scale = targetH / item.height;
            outH = targetH;
            outW = Math.round(item.width * scale);
        }

        if (outW > 4096) {
            const ratio = 4096 / outW;
            outW = 4096;
            outH = Math.round(outH * ratio);
        }
        if (outH > 4096) {
            const ratio = 4096 / outH;
            outH = 4096;
            outW = Math.round(outW * ratio);
        }

        return { width: outW, height: outH };
    },

    /**
     * 메인 작업대 UI 및 카드 갱신
     */
    updateUI() {
        const emptyState = document.getElementById('empty-state');
        const imagesContainer = document.getElementById('images-container');
        const imageGrid = document.getElementById('image-grid');
        const counter = document.getElementById('image-counter');
        const btnDetailEdit = document.getElementById('btn-detail-edit');

        if (counter) {
            counter.textContent = `${this.images.length} / 30장 · 한 장 25MB 이하`;
        }

        if (window.Exporter && typeof window.Exporter.updateSaveButtonText === 'function') {
            window.Exporter.updateSaveButtonText();
        }

        if (btnDetailEdit) {
            btnDetailEdit.disabled = !this.selectedId;
        }

        if (this.images.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (imagesContainer) imagesContainer.style.display = 'none';
            if (imageGrid) imageGrid.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (imagesContainer) imagesContainer.style.display = 'block';

        if (imageGrid) {
            imageGrid.innerHTML = '';

            this.images.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = `image-card ${item.id === this.selectedId ? 'selected' : ''}`;
                card.setAttribute('data-id', item.id);

                const outDim = this.calcOutputDimensions(item);

                card.innerHTML = `
                    <div class="image-thumb-wrap">
                        <img src="${item.dataUrl}" alt="${item.name}" loading="lazy">
                    </div>
                    <div class="image-info">
                        <div class="image-title-text" title="${item.name}">${index + 1}. ${item.name}</div>
                        <div class="image-res-text">${item.width} × ${item.height} → ${outDim.width} × ${outDim.height}px</div>
                    </div>
                    <div class="image-card-actions">
                        <span class="card-action-edit" data-id="${item.id}" title="상세 편집 모달 열기">편집</span>
                        <span class="card-action-save" data-id="${item.id}" title="이 사진 1장 바로 다운로드">저장</span>
                        <span class="card-action-delete" data-id="${item.id}" title="사진 삭제">삭제</span>
                    </div>
                `;

                // 1. 단일 클릭 시: 하단 뷰어에 실시간 캔버스 표시
                card.addEventListener('click', (e) => {
                    // 삭제 클릭 시
                    if (e.target.closest('.card-action-delete')) {
                        e.stopPropagation();
                        this.removeImage(item.id);
                        return;
                    }
                    // 편집 클릭 시
                    if (e.target.closest('.card-action-edit')) {
                        e.stopPropagation();
                        this.selectedId = item.id;
                        this.updateSelectedCardHighlight();
                        ModalEditor.open(item);
                        return;
                    }
                    // 1장 개별 저장 클릭 시
                    if (e.target.closest('.card-action-save')) {
                        e.stopPropagation();
                        if (window.Exporter) {
                            window.Exporter.exportSingleImage(item, index + 1);
                        }
                        return;
                    }

                    this.selectedId = item.id;
                    this.updateSelectedCardHighlight();
                    this.renderInlinePreview();
                });

                // 2. 더블클릭 시: 사진 정밀 편집 팝업 모달 오픈
                card.addEventListener('dblclick', () => {
                    this.selectedId = item.id;
                    this.updateSelectedCardHighlight();
                    ModalEditor.open(item);
                });

                imageGrid.appendChild(card);
            });

            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    },

    updateSelectedCardHighlight() {
        const cards = document.querySelectorAll('#image-grid .image-card');
        cards.forEach(card => {
            const id = card.getAttribute('data-id');
            if (id === this.selectedId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        const btnDetailEdit = document.getElementById('btn-detail-edit');
        if (btnDetailEdit) btnDetailEdit.disabled = !this.selectedId;
    },

    /**
     * ========================================================================
     * 하단 인라인 실시간 뷰어 렌더링
     * ========================================================================
     */
    renderInlinePreview() {
        const inlineSection = document.getElementById('inline-preview-section');
        const titleEl = document.getElementById('inline-preview-title');
        const inlineCanvas = document.getElementById('inline-canvas');
        if (!inlineSection || !inlineCanvas) return;

        if (!this.selectedId || this.images.length === 0) {
            inlineSection.style.display = 'none';
            return;
        }

        const selectedItem = this.images.find(img => img.id === this.selectedId);
        if (!selectedItem) {
            inlineSection.style.display = 'none';
            return;
        }

        inlineSection.style.display = 'block';

        // 우측 설정들이 실시간 적용된 캔버스 생성
        const processedCanvas = this.renderProcessedCanvas(selectedItem);

        inlineCanvas.width = processedCanvas.width;
        inlineCanvas.height = processedCanvas.height;

        const ctx = inlineCanvas.getContext('2d');
        ctx.clearRect(0, 0, inlineCanvas.width, inlineCanvas.height);
        ctx.drawImage(processedCanvas, 0, 0);

        if (titleEl) {
            const idx = this.images.findIndex(img => img.id === this.selectedId) + 1;
            titleEl.textContent = `${idx}. ${selectedItem.name} 미리보기 (${processedCanvas.width} × ${processedCanvas.height}px)`;
        }
    },

    /**
     * ========================================================================
     * 실시간 이미지 가공 파이프라인 (Canvas 변환)
     * ========================================================================
     */
    renderProcessedCanvas(imageItem) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let baseWidth = imageItem.width;
        let baseHeight = imageItem.height;

        // 1. 세로 크기 맞춤(Resize) 계산
        let outputWidth = baseWidth;
        let outputHeight = baseHeight;

        if (this.settings.resizeHeightEnabled && this.settings.targetHeight > 0) {
            const targetH = Math.min(Math.max(this.settings.targetHeight, 50), 4096);
            const scaleRatio = targetH / baseHeight;
            outputHeight = targetH;
            outputWidth = Math.round(baseWidth * scaleRatio);
        }

        if (outputWidth > 4096) {
            const ratio = 4096 / outputWidth;
            outputWidth = 4096;
            outputHeight = Math.round(outputHeight * ratio);
        }
        if (outputHeight > 4096) {
            const ratio = 4096 / outputHeight;
            outputHeight = 4096;
            outputWidth = Math.round(outputWidth * ratio);
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        // 2. 배경 채우기 (JPG 포맷 시 투명 영역을 흰색으로)
        if (this.settings.exportFormat === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outputWidth, outputHeight);
        }

        // 3. 밝기(Brightness) 필터
        ctx.save();
        if (this.settings.brightness !== 100) {
            ctx.filter = `brightness(${this.settings.brightness}%)`;
        }

        // 4. 이미지 드로잉
        ctx.drawImage(imageItem.imgElement, 0, 0, outputWidth, outputHeight);
        ctx.restore();

        // 5. 테두리(Border) 적용
        if (this.settings.borderWidth > 0) {
            ctx.save();
            ctx.lineWidth = this.settings.borderWidth * 2;
            ctx.strokeStyle = this.settings.borderColor;
            ctx.strokeRect(0, 0, outputWidth, outputHeight);
            ctx.restore();
        }

        // 6. 워터마크 합성
        if (this.settings.watermarkEnabled) {
            this.drawWatermark(ctx, outputWidth, outputHeight);
        }

        return canvas;
    },

    /**
     * 워터마크 그리기 (9분할 위치)
     */
    drawWatermark(ctx, canvasW, canvasH) {
        ctx.save();
        ctx.globalAlpha = Math.min(Math.max(this.settings.watermarkOpacity / 100, 0.05), 1);
        const margin = Math.max(this.settings.watermarkMargin, 0);

        if (this.settings.watermarkType === 'image' && this.watermarkImgElement) {
            const targetLogoW = Math.min(this.settings.watermarkWidth, canvasW - margin * 2);
            const logoAspect = this.watermarkImgElement.naturalHeight / this.watermarkImgElement.naturalWidth;
            const targetLogoH = targetLogoW * logoAspect;

            const pos = this.calculatePosition(canvasW, canvasH, targetLogoW, targetLogoH, margin, this.settings.watermarkPos);
            ctx.drawImage(this.watermarkImgElement, pos.x, pos.y, targetLogoW, targetLogoH);

        } else if (this.settings.watermarkType === 'text' && this.settings.watermarkText.trim()) {
            const fontSize = Math.max(Math.round(canvasH * 0.04), 16);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            const text = this.settings.watermarkText;
            const textMetrics = ctx.measureText(text);
            const textW = textMetrics.width;
            const textH = fontSize;

            const pos = this.calculatePosition(canvasW, canvasH, textW, textH, margin, this.settings.watermarkPos);
            ctx.fillText(text, pos.x, pos.y + textH);
        }

        ctx.restore();
    },

    calculatePosition(canvasW, canvasH, itemW, itemH, margin, positionKey) {
        let x = 0, y = 0;
        switch (positionKey) {
            case 'top-left': x = margin; y = margin; break;
            case 'top-center': x = (canvasW - itemW) / 2; y = margin; break;
            case 'top-right': x = canvasW - itemW - margin; y = margin; break;
            case 'middle-left': x = margin; y = (canvasH - itemH) / 2; break;
            case 'center': x = (canvasW - itemW) / 2; y = (canvasH - itemH) / 2; break;
            case 'middle-right': x = canvasW - itemW - margin; y = (canvasH - itemH) / 2; break;
            case 'bottom-left': x = margin; y = canvasH - itemH - margin; break;
            case 'bottom-center': x = (canvasW - itemW) / 2; y = canvasH - itemH - margin; break;
            case 'bottom-right':
            default: x = canvasW - itemW - margin; y = canvasH - itemH - margin; break;
        }
        return { x, y };
    },

    /**
     * 우측 사이드바 설정 이벤트 바인딩
     */
    bindSettingsEvents() {
        const chkResize = document.getElementById('chk-resize-height');
        const inputHeight = document.getElementById('input-target-height');
        const helperText = document.getElementById('resize-helper-text');

        if (chkResize && inputHeight) {
            chkResize.addEventListener('change', (e) => {
                this.settings.resizeHeightEnabled = e.target.checked;
                if (helperText) {
                    helperText.textContent = e.target.checked 
                        ? `전체 사진을 세로 ${this.settings.targetHeight}px로 비율 맞춤` 
                        : '크기 변경 없음 - 사진별 편집 크기 유지';
                }
                this.updateUI();
                this.renderInlinePreview();
            });

            inputHeight.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 800;
                this.settings.targetHeight = val;
                if (chkResize.checked && helperText) {
                    helperText.textContent = `전체 사진을 세로 ${val}px로 비율 맞춤`;
                }
                this.updateUI();
                this.renderInlinePreview();
            });
        }

        const rangeBrightness = document.getElementById('range-brightness');
        const valBrightness = document.getElementById('val-brightness');
        if (rangeBrightness && valBrightness) {
            rangeBrightness.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.settings.brightness = val;
                valBrightness.textContent = `${val}%`;
                this.renderInlinePreview();
            });
        }

        const inputBorderWidth = document.getElementById('input-border-width');
        const inputBorderColor = document.getElementById('input-border-color');
        if (inputBorderWidth) {
            inputBorderWidth.addEventListener('input', (e) => {
                this.settings.borderWidth = parseInt(e.target.value, 10) || 0;
                this.renderInlinePreview();
            });
        }
        if (inputBorderColor) {
            inputBorderColor.addEventListener('input', (e) => {
                this.settings.borderColor = e.target.value;
                this.renderInlinePreview();
            });
        }

        const chkWatermark = document.getElementById('chk-watermark');
        const watermarkOptions = document.getElementById('watermark-options');
        const selectWatermarkType = document.getElementById('select-watermark-type');
        const watermarkImgSection = document.getElementById('watermark-image-section');
        const watermarkTextSection = document.getElementById('watermark-text-section');
        const watermarkFileInput = document.getElementById('watermark-file-input');
        const watermarkFileName = document.getElementById('watermark-file-name');
        const btnRemoveWatermark = document.getElementById('btn-remove-watermark');
        const inputWatermarkText = document.getElementById('input-watermark-text');
        const inputWatermarkWidth = document.getElementById('input-watermark-width');
        const inputWatermarkOpacity = document.getElementById('input-watermark-opacity');
        const inputWatermarkMargin = document.getElementById('input-watermark-margin');

        if (chkWatermark && watermarkOptions) {
            chkWatermark.addEventListener('change', (e) => {
                this.settings.watermarkEnabled = e.target.checked;
                watermarkOptions.style.display = e.target.checked ? 'block' : 'none';
                this.renderInlinePreview();
            });
        }

        if (selectWatermarkType) {
            selectWatermarkType.addEventListener('change', (e) => {
                this.settings.watermarkType = e.target.value;
                if (e.target.value === 'image') {
                    watermarkImgSection.style.display = 'block';
                    watermarkTextSection.style.display = 'none';
                } else {
                    watermarkImgSection.style.display = 'none';
                    watermarkTextSection.style.display = 'block';
                }
                this.renderInlinePreview();
            });
        }

        if (watermarkFileInput && watermarkFileName) {
            watermarkFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    watermarkFileName.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            this.watermarkImgElement = img;
                            this.renderInlinePreview();
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (btnRemoveWatermark && watermarkFileName) {
            btnRemoveWatermark.addEventListener('click', () => {
                this.watermarkImgElement = null;
                watermarkFileName.textContent = '선택한 파일 없음';
                if (watermarkFileInput) watermarkFileInput.value = '';
                this.renderInlinePreview();
            });
        }

        if (inputWatermarkText) {
            inputWatermarkText.addEventListener('input', (e) => {
                this.settings.watermarkText = e.target.value;
                this.renderInlinePreview();
            });
        }

        if (inputWatermarkWidth) {
            inputWatermarkWidth.addEventListener('input', (e) => {
                this.settings.watermarkWidth = parseInt(e.target.value, 10) || 300;
                this.renderInlinePreview();
            });
        }

        if (inputWatermarkOpacity) {
            inputWatermarkOpacity.addEventListener('input', (e) => {
                this.settings.watermarkOpacity = parseInt(e.target.value, 10) || 70;
                this.renderInlinePreview();
            });
        }

        if (inputWatermarkMargin) {
            inputWatermarkMargin.addEventListener('input', (e) => {
                this.settings.watermarkMargin = parseInt(e.target.value, 10) || 30;
                this.renderInlinePreview();
            });
        }

        const gridButtons = document.querySelectorAll('#watermark-grid .pos-btn');
        const posLabel = document.getElementById('watermark-pos-label');
        gridButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                gridButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const pos = btn.getAttribute('data-pos');
                this.settings.watermarkPos = pos;
                if (posLabel) {
                    posLabel.textContent = btn.getAttribute('title') || pos;
                }
                this.renderInlinePreview();
            });
        });

        const selectExportFormat = document.getElementById('select-export-format');
        const jpgQualitySection = document.getElementById('jpg-quality-section');
        const rangeQuality = document.getElementById('range-quality');
        const valQuality = document.getElementById('val-quality');

        if (selectExportFormat) {
            selectExportFormat.addEventListener('change', (e) => {
                this.settings.exportFormat = e.target.value;
                if (jpgQualitySection) {
                    jpgQualitySection.style.display = e.target.value === 'jpeg' ? 'block' : 'none';
                }
                this.renderInlinePreview();
            });
        }

        if (rangeQuality && valQuality) {
            rangeQuality.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.settings.jpgQuality = val;
                valQuality.textContent = `${val}%`;
            });
        }
    }
};

/**
 * ============================================================================
 * ModalEditor - Fabric.js 기반의 풀스크린 사진 정밀 편집기
 * ============================================================================
 */
const ModalEditor = {
    currentImageItem: null,
    fabricCanvas: null,
    currentTool: 'crop',
    
    toolColor: '#ef4444',
    toolStrokeWidth: 4,
    toolFill: false,
    mosaicSize: 16,

    isDrawingShape: false,
    origX: 0,
    origY: 0,
    activeShape: null,

    historyUndo: [],
    historyRedo: [],
    isProcessingHistory: false,

    cropBox: { x: 0, y: 0, w: 0, h: 0 },
    isDraggingCrop: false,
    activeHandle: null,

    init() {
        this.bindModalUI();
        this.bindKeyboardShortcuts();
    },

    open(imageItem) {
        this.currentImageItem = imageItem;
        const modal = document.getElementById('edit-modal');
        const fileNameEl = document.getElementById('modal-file-name');
        if (fileNameEl) fileNameEl.textContent = imageItem.name;

        const inputW = document.getElementById('input-modal-width');
        const inputH = document.getElementById('input-modal-height');
        if (inputW) inputW.value = imageItem.width;
        if (inputH) inputH.value = imageItem.height;

        if (modal) modal.style.display = 'flex';

        setTimeout(() => {
            this.setupCanvas(imageItem.dataUrl, imageItem.width, imageItem.height);
        }, 50);
    },

    setupCanvas(dataUrl, width, height) {
        if (this.fabricCanvas) {
            this.fabricCanvas.dispose();
            this.fabricCanvas = null;
        }

        this.fabricCanvas = new fabric.Canvas('fabric-canvas', {
            width: width,
            height: height,
            selection: true
        });

        fabric.Image.fromURL(dataUrl, (img) => {
            img.set({
                originX: 'left',
                originY: 'top',
                left: 0,
                top: 0,
                selectable: false,
                evented: false
            });
            this.fabricCanvas.setBackgroundImage(img, this.fabricCanvas.renderAll.bind(this.fabricCanvas));
            
            this.historyUndo = [this.exportCanvasState()];
            this.historyRedo = [];

            this.setTool(this.currentTool);
        });

        this.bindCanvasEvents();
    },

    bindModalUI() {
        const btnClose = document.getElementById('btn-close-modal');
        const btnCancel = document.getElementById('btn-modal-cancel-bottom');
        const btnApply = document.getElementById('btn-modal-apply-bottom');

        const closeModal = () => {
            const modal = document.getElementById('edit-modal');
            if (modal) modal.style.display = 'none';
            if (this.fabricCanvas) {
                this.fabricCanvas.dispose();
                this.fabricCanvas = null;
            }
        };

        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModal);

        if (btnApply) {
            btnApply.addEventListener('click', () => {
                this.applyChanges();
                closeModal();
            });
        }

        const toolButtons = document.querySelectorAll('.modal-toolbar .tool-btn');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tool = btn.getAttribute('data-tool');
                this.setTool(tool);

                if (['pen', 'highlighter', 'line', 'arrow', 'rect', 'circle', 'text', 'mosaic'].includes(tool)) {
                    this.switchTab('format');
                } else {
                    this.switchTab('photo');
                }
            });
        });

        const tabFormat = document.getElementById('tab-btn-format');
        const tabPhoto = document.getElementById('tab-btn-photo');
        if (tabFormat) tabFormat.addEventListener('click', () => this.switchTab('format'));
        if (tabPhoto) tabPhoto.addEventListener('click', () => this.switchTab('photo'));

        const inputToolColor = document.getElementById('input-tool-color');
        const rangeStroke = document.getElementById('range-tool-stroke');
        const valStroke = document.getElementById('val-tool-stroke');
        const chkFill = document.getElementById('chk-tool-fill');
        const rangeMosaic = document.getElementById('range-mosaic-size');
        const valMosaic = document.getElementById('val-mosaic-size');

        if (inputToolColor) {
            inputToolColor.addEventListener('input', (e) => {
                this.toolColor = e.target.value;
                this.updateActiveObjectFormat();
            });
        }

        document.querySelectorAll('.color-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const color = chip.getAttribute('data-color');
                this.toolColor = color;
                if (inputToolColor) inputToolColor.value = color;
                this.updateActiveObjectFormat();
            });
        });

        if (rangeStroke && valStroke) {
            rangeStroke.addEventListener('input', (e) => {
                this.toolStrokeWidth = parseInt(e.target.value, 10);
                valStroke.textContent = `${this.toolStrokeWidth}px`;
                this.updateActiveObjectFormat();
            });
        }

        if (chkFill) {
            chkFill.addEventListener('change', (e) => {
                this.toolFill = e.target.checked;
                this.updateActiveObjectFormat();
            });
        }

        if (rangeMosaic && valMosaic) {
            rangeMosaic.addEventListener('input', (e) => {
                this.mosaicSize = parseInt(e.target.value, 10);
                valMosaic.textContent = `${this.mosaicSize}px`;
            });
        }

        this.bindTransformActions();
        this.bindHistoryActions();
    },

    switchTab(tabName) {
        const tabFormat = document.getElementById('tab-btn-format');
        const tabPhoto = document.getElementById('tab-btn-photo');
        const contentFormat = document.getElementById('tab-format-content');
        const contentPhoto = document.getElementById('tab-photo-content');

        if (tabName === 'format') {
            tabFormat.classList.add('active');
            tabPhoto.classList.remove('active');
            contentFormat.style.display = 'block';
            contentPhoto.style.display = 'none';
        } else {
            tabPhoto.classList.add('active');
            tabFormat.classList.remove('active');
            contentPhoto.style.display = 'block';
            contentFormat.style.display = 'none';
        }
    },

    setTool(tool) {
        this.currentTool = tool;
        if (!this.fabricCanvas) return;

        const cropOverlay = document.getElementById('crop-overlay');
        const sectionCrop = document.getElementById('section-crop-actions');

        this.fabricCanvas.isDrawingMode = false;
        this.fabricCanvas.selection = (tool === 'select');
        this.fabricCanvas.forEachObject(obj => {
            obj.selectable = (tool === 'select');
            obj.evented = (tool === 'select');
        });

        if (tool === 'crop') {
            if (cropOverlay) cropOverlay.style.display = 'block';
            if (sectionCrop) sectionCrop.style.display = 'block';
            this.initCropBox();
        } else {
            if (cropOverlay) cropOverlay.style.display = 'none';
            if (sectionCrop) sectionCrop.style.display = 'none';
        }

        if (tool === 'pen') {
            this.fabricCanvas.isDrawingMode = true;
            this.fabricCanvas.freeDrawingBrush.color = this.toolColor;
            this.fabricCanvas.freeDrawingBrush.width = this.toolStrokeWidth;
        } else if (tool === 'highlighter') {
            this.fabricCanvas.isDrawingMode = true;
            this.fabricCanvas.freeDrawingBrush.color = this.hexToRgba(this.toolColor, 0.35);
            this.fabricCanvas.freeDrawingBrush.width = Math.max(this.toolStrokeWidth * 3, 16);
        }
    },

    initCropBox() {
        const cropOverlay = document.getElementById('crop-overlay');
        if (!cropOverlay || !this.fabricCanvas) return;

        const w = this.fabricCanvas.getWidth();
        const h = this.fabricCanvas.getHeight();

        this.cropBox = {
            x: Math.round(w * 0.05),
            y: Math.round(h * 0.05),
            w: Math.round(w * 0.9),
            h: Math.round(h * 0.9)
        };

        this.updateCropOverlayStyle();
        this.bindCropOverlayEvents();
    },

    updateCropOverlayStyle() {
        const cropOverlay = document.getElementById('crop-overlay');
        if (!cropOverlay) return;
        cropOverlay.style.left = `${this.cropBox.x}px`;
        cropOverlay.style.top = `${this.cropBox.y}px`;
        cropOverlay.style.width = `${this.cropBox.w}px`;
        cropOverlay.style.height = `${this.cropBox.h}px`;
    },

    bindCropOverlayEvents() {
        const cropOverlay = document.getElementById('crop-overlay');
        if (!cropOverlay) return;

        let startX = 0, startY = 0;
        let startBox = null;
        let handleType = null;

        const onMouseDown = (e) => {
            const handle = e.target.closest('.crop-handle');
            handleType = handle ? handle.className.replace('crop-handle ', '').trim() : 'move';
            startX = e.clientX;
            startY = e.clientY;
            startBox = { ...this.cropBox };
            e.preventDefault();

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!startBox) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const maxW = this.fabricCanvas.getWidth();
            const maxH = this.fabricCanvas.getHeight();

            if (handleType === 'move') {
                this.cropBox.x = Math.max(0, Math.min(startBox.x + dx, maxW - startBox.w));
                this.cropBox.y = Math.max(0, Math.min(startBox.y + dy, maxH - startBox.h));
            } else {
                if (handleType.includes('e')) {
                    this.cropBox.w = Math.max(30, Math.min(startBox.w + dx, maxW - startBox.x));
                }
                if (handleType.includes('s')) {
                    this.cropBox.h = Math.max(30, Math.min(startBox.h + dy, maxH - startBox.y));
                }
                if (handleType.includes('w')) {
                    const newW = Math.max(30, startBox.w - dx);
                    if (startBox.x + dx >= 0) {
                        this.cropBox.x = startBox.x + dx;
                        this.cropBox.w = newW;
                    }
                }
                if (handleType.includes('n')) {
                    const newH = Math.max(30, startBox.h - dy);
                    if (startBox.y + dy >= 0) {
                        this.cropBox.y = startBox.y + dy;
                        this.cropBox.h = newH;
                    }
                }
            }

            this.updateCropOverlayStyle();
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            startBox = null;
        };

        cropOverlay.onmousedown = onMouseDown;
    },

    applyCrop() {
        if (!this.fabricCanvas) return;

        const croppedDataUrl = this.fabricCanvas.toDataURL({
            left: this.cropBox.x,
            top: this.cropBox.y,
            width: this.cropBox.w,
            height: this.cropBox.h
        });

        this.setupCanvas(croppedDataUrl, this.cropBox.w, this.cropBox.h);
        
        const inputW = document.getElementById('input-modal-width');
        const inputH = document.getElementById('input-modal-height');
        if (inputW) inputW.value = this.cropBox.w;
        if (inputH) inputH.value = this.cropBox.h;
    },

    bindCanvasEvents() {
        this.fabricCanvas.on('mouse:down', (o) => {
            if (this.currentTool === 'select' || this.currentTool === 'crop' || this.fabricCanvas.isDrawingMode) return;

            const pointer = this.fabricCanvas.getPointer(o.e);
            this.isDrawingShape = true;
            this.origX = pointer.x;
            this.origY = pointer.y;

            if (this.currentTool === 'rect') {
                this.activeShape = new fabric.Rect({
                    left: this.origX,
                    top: this.origY,
                    originX: 'left',
                    originY: 'top',
                    width: 0,
                    height: 0,
                    fill: this.toolFill ? this.toolColor : 'transparent',
                    stroke: this.toolColor,
                    strokeWidth: this.toolStrokeWidth,
                    selectable: false
                });
                this.fabricCanvas.add(this.activeShape);

            } else if (this.currentTool === 'circle') {
                this.activeShape = new fabric.Ellipse({
                    left: this.origX,
                    top: this.origY,
                    originX: 'left',
                    originY: 'top',
                    rx: 0,
                    ry: 0,
                    fill: this.toolFill ? this.toolColor : 'transparent',
                    stroke: this.toolColor,
                    strokeWidth: this.toolStrokeWidth,
                    selectable: false
                });
                this.fabricCanvas.add(this.activeShape);

            } else if (this.currentTool === 'line') {
                this.activeShape = new fabric.Line([this.origX, this.origY, this.origX, this.origY], {
                    stroke: this.toolColor,
                    strokeWidth: this.toolStrokeWidth,
                    selectable: false
                });
                this.fabricCanvas.add(this.activeShape);

            } else if (this.currentTool === 'arrow') {
                this.activeShape = new fabric.Line([this.origX, this.origY, this.origX, this.origY], {
                    stroke: this.toolColor,
                    strokeWidth: this.toolStrokeWidth,
                    selectable: false
                });
                this.fabricCanvas.add(this.activeShape);

            } else if (this.currentTool === 'text') {
                const text = new fabric.IText('텍스트 입력', {
                    left: this.origX,
                    top: this.origY,
                    fontFamily: 'Pretendard, sans-serif',
                    fill: this.toolColor,
                    fontSize: Math.max(this.toolStrokeWidth * 5, 20),
                    selectable: true
                });
                this.fabricCanvas.add(text);
                this.fabricCanvas.setActiveObject(text);
                text.enterEditing();
                this.isDrawingShape = false;
                this.saveHistory();

            } else if (this.currentTool === 'mosaic') {
                this.activeShape = new fabric.Rect({
                    left: this.origX,
                    top: this.origY,
                    originX: 'left',
                    originY: 'top',
                    width: 0,
                    height: 0,
                    fill: 'rgba(100, 100, 100, 0.4)',
                    stroke: '#8b5cf6',
                    strokeDashArray: [4, 4],
                    selectable: false
                });
                this.fabricCanvas.add(this.activeShape);
            }
        });

        this.fabricCanvas.on('mouse:move', (o) => {
            if (!this.isDrawingShape || !this.activeShape) return;
            const pointer = this.fabricCanvas.getPointer(o.e);

            if (this.currentTool === 'rect' || this.currentTool === 'mosaic') {
                if (this.origX > pointer.x) {
                    this.activeShape.set({ left: Math.abs(pointer.x) });
                }
                if (this.origY > pointer.y) {
                    this.activeShape.set({ top: Math.abs(pointer.y) });
                }
                this.activeShape.set({
                    width: Math.abs(this.origX - pointer.x),
                    height: Math.abs(this.origY - pointer.y)
                });

            } else if (this.currentTool === 'circle') {
                const rx = Math.abs(this.origX - pointer.x) / 2;
                const ry = Math.abs(this.origY - pointer.y) / 2;
                this.activeShape.set({
                    left: Math.min(this.origX, pointer.x),
                    top: Math.min(this.origY, pointer.y),
                    rx: rx,
                    ry: ry
                });

            } else if (this.currentTool === 'line' || this.currentTool === 'arrow') {
                this.activeShape.set({ x2: pointer.x, y2: pointer.y });
            }

            this.fabricCanvas.renderAll();
        });

        this.fabricCanvas.on('mouse:up', () => {
            if (!this.isDrawingShape) return;
            this.isDrawingShape = false;

            if (this.currentTool === 'arrow' && this.activeShape) {
                const dx = this.activeShape.x2 - this.activeShape.x1;
                const dy = this.activeShape.y2 - this.activeShape.y1;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                const head = new fabric.Triangle({
                    left: this.activeShape.x2,
                    top: this.activeShape.y2,
                    originX: 'center',
                    originY: 'center',
                    pointType: 'arrow_head',
                    angle: angle + 90,
                    width: this.toolStrokeWidth * 3.5,
                    height: this.toolStrokeWidth * 3.5,
                    fill: this.toolColor,
                    selectable: false
                });

                const group = new fabric.Group([this.activeShape, head], {
                    selectable: (this.currentTool === 'select')
                });
                this.fabricCanvas.remove(this.activeShape);
                this.fabricCanvas.add(group);

            } else if (this.currentTool === 'mosaic' && this.activeShape) {
                this.applyMosaicArea(this.activeShape);
            }

            this.activeShape = null;
            this.saveHistory();
        });

        this.fabricCanvas.on('object:modified', () => this.saveHistory());
        this.fabricCanvas.on('path:created', () => this.saveHistory());
    },

    applyMosaicArea(rectObj) {
        const x = Math.round(rectObj.left);
        const y = Math.round(rectObj.top);
        const w = Math.round(rectObj.width);
        const h = Math.round(rectObj.height);

        this.fabricCanvas.remove(rectObj);
        if (w < 5 || h < 5) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.fabricCanvas.getWidth();
        tempCanvas.height = this.fabricCanvas.getHeight();
        const ctx = tempCanvas.getContext('2d');

        const currentDataUrl = this.fabricCanvas.toDataURL();
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(x, y, w, h);
            const data = imgData.data;
            const size = this.mosaicSize;

            for (let py = 0; py < h; py += size) {
                for (let px = 0; px < w; px += size) {
                    const i = (py * w + px) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    for (let sy = 0; sy < size && py + sy < h; sy++) {
                        for (let sx = 0; sx < size && px + sx < w; sx++) {
                            const targetIdx = ((py + sy) * w + (px + sx)) * 4;
                            data[targetIdx] = r;
                            data[targetIdx + 1] = g;
                            data[targetIdx + 2] = b;
                        }
                    }
                }
            }

            ctx.putImageData(imgData, x, y);
            const mosaicDataUrl = tempCanvas.toDataURL();
            this.setupCanvas(mosaicDataUrl, tempCanvas.width, tempCanvas.height);
        };
        img.src = currentDataUrl;
    },

    updateActiveObjectFormat() {
        if (!this.fabricCanvas) return;
        const activeObj = this.fabricCanvas.getActiveObject();
        if (!activeObj) return;

        if (activeObj.type === 'i-text' || activeObj.type === 'text') {
            activeObj.set({ fill: this.toolColor });
        } else if (activeObj.type === 'group') {
            activeObj.forEachObject(obj => {
                obj.set({ stroke: this.toolColor, fill: this.toolColor });
            });
        } else {
            activeObj.set({
                stroke: this.toolColor,
                strokeWidth: this.toolStrokeWidth,
                fill: this.toolFill ? this.toolColor : 'transparent'
            });
        }
        this.fabricCanvas.renderAll();
        this.saveHistory();
    },

    bindTransformActions() {
        const btnRotLeft = document.getElementById('btn-modal-rot-left');
        const btnRotRight = document.getElementById('btn-modal-rot-right');
        const btnFlipH = document.getElementById('btn-modal-flip-h');
        const btnFlipV = document.getElementById('btn-modal-flip-v');

        if (btnRotLeft) btnRotLeft.addEventListener('click', () => this.rotateCanvas(-90));
        if (btnRotRight) btnRotRight.addEventListener('click', () => this.rotateCanvas(90));
        if (btnFlipH) btnFlipH.addEventListener('click', () => this.flipCanvas(true, false));
        if (btnFlipV) btnFlipV.addEventListener('click', () => this.flipCanvas(false, true));

        const btnApplyAngle = document.getElementById('btn-apply-angle');
        const inputAngle = document.getElementById('input-fine-angle');
        if (btnApplyAngle && inputAngle) {
            btnApplyAngle.addEventListener('click', () => {
                const angle = parseFloat(inputAngle.value) || 0;
                if (angle !== 0) this.rotateCanvas(angle);
            });
        }

        const btnApplyResize = document.getElementById('btn-apply-resize');
        const inputW = document.getElementById('input-modal-width');
        const inputH = document.getElementById('input-modal-height');
        const chkAspect = document.getElementById('chk-modal-aspect-ratio');

        if (inputW && inputH && chkAspect) {
            inputW.addEventListener('input', () => {
                if (chkAspect.checked && this.fabricCanvas) {
                    const ratio = this.fabricCanvas.getHeight() / this.fabricCanvas.getWidth();
                    inputH.value = Math.round(parseInt(inputW.value, 10) * ratio) || '';
                }
            });
            inputH.addEventListener('input', () => {
                if (chkAspect.checked && this.fabricCanvas) {
                    const ratio = this.fabricCanvas.getWidth() / this.fabricCanvas.getHeight();
                    inputW.value = Math.round(parseInt(inputH.value, 10) * ratio) || '';
                }
            });
        }

        if (btnApplyResize && inputW && inputH) {
            btnApplyResize.addEventListener('click', () => {
                const targetW = parseInt(inputW.value, 10);
                const targetH = parseInt(inputH.value, 10);
                if (targetW > 10 && targetH > 10) {
                    this.resizeCanvas(targetW, targetH);
                }
            });
        }

        const btnApplyCrop = document.getElementById('btn-apply-crop');
        const btnCancelCrop = document.getElementById('btn-cancel-crop');
        if (btnApplyCrop) btnApplyCrop.addEventListener('click', () => this.applyCrop());
        if (btnCancelCrop) btnCancelCrop.addEventListener('click', () => this.setTool('select'));
    },

    rotateCanvas(degree) {
        if (!this.fabricCanvas) return;
        const currentDataUrl = this.fabricCanvas.toDataURL();
        const img = new Image();
        img.onload = () => {
            const rad = (degree * Math.PI) / 180;
            const is90 = Math.abs(degree) === 90 || Math.abs(degree) === 270;
            const newW = is90 ? img.height : img.width;
            const newH = is90 ? img.width : img.height;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = newW;
            tempCanvas.height = newH;
            const ctx = tempCanvas.getContext('2d');

            ctx.translate(newW / 2, newH / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            this.setupCanvas(tempCanvas.toDataURL(), newW, newH);
        };
        img.src = currentDataUrl;
    },

    flipCanvas(flipH, flipV) {
        if (!this.fabricCanvas) return;
        const currentDataUrl = this.fabricCanvas.toDataURL();
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const ctx = tempCanvas.getContext('2d');

            ctx.translate(flipH ? w : 0, flipV ? h : 0);
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            ctx.drawImage(img, 0, 0);

            this.setupCanvas(tempCanvas.toDataURL(), w, h);
        };
        img.src = currentDataUrl;
    },

    resizeCanvas(targetW, targetH) {
        if (!this.fabricCanvas) return;
        const currentDataUrl = this.fabricCanvas.toDataURL();
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetW;
            tempCanvas.height = targetH;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetW, targetH);

            this.setupCanvas(tempCanvas.toDataURL(), targetW, targetH);
        };
        img.src = currentDataUrl;
    },

    bindHistoryActions() {
        const btnUndo = document.getElementById('btn-history-undo');
        const btnRedo = document.getElementById('btn-history-redo');
        const btnReset = document.getElementById('btn-history-reset');

        if (btnUndo) {
            btnUndo.addEventListener('click', () => {
                if (this.historyUndo.length > 1) {
                    this.isProcessingHistory = true;
                    const current = this.historyUndo.pop();
                    this.historyRedo.push(current);
                    const prevState = this.historyUndo[this.historyUndo.length - 1];
                    this.loadCanvasState(prevState);
                }
            });
        }

        if (btnRedo) {
            btnRedo.addEventListener('click', () => {
                if (this.historyRedo.length > 0) {
                    this.isProcessingHistory = true;
                    const nextState = this.historyRedo.pop();
                    this.historyUndo.push(nextState);
                    this.loadCanvasState(nextState);
                }
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm('모든 수정을 취소하고 원본 사진으로 되돌리시겠습니까?')) {
                    if (this.currentImageItem) {
                        this.setupCanvas(
                            this.currentImageItem.originalDataUrl,
                            this.currentImageItem.imgElement.naturalWidth,
                            this.currentImageItem.imgElement.naturalHeight
                        );
                    }
                }
            });
        }
    },

    bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            const modal = document.getElementById('edit-modal');
            if (!modal || modal.style.display === 'none' || !this.fabricCanvas) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeObj = this.fabricCanvas.getActiveObject();
                if (activeObj && !(activeObj.isEditing)) {
                    this.fabricCanvas.remove(activeObj);
                    this.saveHistory();
                    e.preventDefault();
                }
            }

            if (e.ctrlKey && e.key === 'z') {
                document.getElementById('btn-history-undo')?.click();
                e.preventDefault();
            } else if (e.ctrlKey && e.key === 'y') {
                document.getElementById('btn-history-redo')?.click();
                e.preventDefault();
            }
        });
    },

    exportCanvasState() {
        return {
            json: JSON.stringify(this.fabricCanvas.toJSON()),
            width: this.fabricCanvas.getWidth(),
            height: this.fabricCanvas.getHeight()
        };
    },

    saveHistory() {
        if (this.isProcessingHistory || !this.fabricCanvas) return;
        this.historyUndo.push(this.exportCanvasState());
        this.historyRedo = [];
        if (this.historyUndo.length > 30) this.historyUndo.shift();
    },

    loadCanvasState(state) {
        if (!this.fabricCanvas) return;
        this.fabricCanvas.setWidth(state.width);
        this.fabricCanvas.setHeight(state.height);
        this.fabricCanvas.loadFromJSON(state.json, () => {
            this.fabricCanvas.renderAll();
            this.isProcessingHistory = false;
        });
    },

    applyChanges() {
        if (!this.fabricCanvas || !this.currentImageItem) return;

        const finalDataUrl = this.fabricCanvas.toDataURL();
        const finalW = this.fabricCanvas.getWidth();
        const finalH = this.fabricCanvas.getHeight();

        const img = new Image();
        img.onload = () => {
            this.currentImageItem.imgElement = img;
            this.currentImageItem.dataUrl = finalDataUrl;
            this.currentImageItem.width = finalW;
            this.currentImageItem.height = finalH;

            ImageEditor.updateUI();
            ImageEditor.renderInlinePreview();
        };
        img.src = finalDataUrl;
    },

    hexToRgba(hex, alpha) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
        }
        return hex;
    }
};

/**
 * ============================================================================
 * exporter.js - 이미지 일괄 가공 및 개별 파일 순차 다운로드 / ZIP 압축 다운로드
 * ============================================================================
 * 역할:
 * 1. 개별 파일 다운로드 (기본 모드):
 *    - 1장이든 여러 장이든 각 이미지를 0.25초 간격으로 순차 다운로드하여
 *      브라우저 다운로드 폴더에 바로바로 개별 파일(JPG/PNG/WebP)로 저장
 * 2. ZIP 압축 다운로드 (선택 모드):
 *    - JSZip을 통해 모든 이미지를 하나의 .zip 압축 파일로 패키징하여 다운로드
 * 3. EXIF 메타데이터 제거 (Canvas 추출 과정에서 자동으로 제거됨)
 */

const Exporter = {
    // 다운로드 모드: 'individual' (개별 파일) | 'zip' (ZIP 압축)
    downloadMode: 'individual',

    init() {
        this.bindExportButton();
        this.bindDownloadModeSelect();
    },

    bindDownloadModeSelect() {
        const selectMode = document.getElementById('select-download-mode');
        if (selectMode) {
            selectMode.addEventListener('change', (e) => {
                this.downloadMode = e.target.value;
                this.updateSaveButtonText();
            });
        }
    },

    updateSaveButtonText() {
        const saveBtnText = document.getElementById('save-btn-text');
        if (!saveBtnText) return;

        const count = ImageEditor.images.length;
        if (count > 1) {
            if (this.downloadMode === 'individual') {
                saveBtnText.textContent = `이미지 ${count}장 개별 저장 (순차 다운로드)`;
            } else {
                saveBtnText.textContent = `이미지 ${count}장 ZIP 압축 저장`;
            }
        } else {
            saveBtnText.textContent = '이미지 저장';
        }
    },

    bindExportButton() {
        const btnSave = document.getElementById('btn-save-images');
        if (!btnSave) return;

        btnSave.addEventListener('click', async () => {
            if (ImageEditor.images.length === 0) {
                alert('편집할 이미지를 먼저 추가해주세요.\n(Win+Shift+S로 캡처 후 Ctrl+V로 붙여넣거나 파일을 끌어다 놓으세요)');
                return;
            }

            // 버튼 로딩 상태 피드백
            const originalHTML = btnSave.innerHTML;
            btnSave.disabled = true;
            btnSave.innerHTML = `<i data-lucide="loader" class="spin-icon"></i> <span>이미지 가공 및 저장 중...</span>`;
            if (window.lucide) window.lucide.createIcons();

            try {
                if (ImageEditor.images.length === 1) {
                    await this.exportSingleImage(ImageEditor.images[0], 1);
                } else {
                    if (this.downloadMode === 'individual') {
                        // [개별 파일 순차 다운로드]
                        await this.exportMultipleImagesIndividually(ImageEditor.images);
                    } else {
                        // [ZIP 압축 다운로드]
                        await this.exportMultipleImagesAsZip(ImageEditor.images);
                    }
                }
            } catch (error) {
                console.error('이미지 저장 오류:', error);
                alert('이미지 저장 중 오류가 발생했습니다: ' + error.message);
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    },

    /**
     * 1장 단일 이미지 다운로드
     * @param {Object} imageItem 
     * @param {number} index 
     */
    async exportSingleImage(imageItem, index = 1) {
        const canvas = ImageEditor.renderProcessedCanvas(imageItem);
        const format = ImageEditor.settings.exportFormat; // 'jpeg', 'png', 'webp'
        const quality = format === 'jpeg' ? ImageEditor.settings.jpgQuality / 100 : 0.92;
        const mimeType = `image/${format}`;

        const blob = await this.canvasToBlob(canvas, mimeType, quality);
        const ext = format === 'jpeg' ? 'jpg' : format;
        const padNum = String(index).padStart(2, '0');
        const cleanName = (imageItem.name || 'image').replace(/\.[^/.]+$/, '');
        const filename = `${padNum}_${cleanName}_edited.${ext}`;

        this.downloadBlob(blob, filename);
    },

    /**
     * 여러 장의 사진을 개별 파일로 0.25초 간격 순차 다운로드
     * @param {Array<Object>} images 
     */
    async exportMultipleImagesIndividually(images) {
        const format = ImageEditor.settings.exportFormat;
        const quality = format === 'jpeg' ? ImageEditor.settings.jpgQuality / 100 : 0.92;
        const mimeType = `image/${format}`;
        const ext = format === 'jpeg' ? 'jpg' : format;

        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            const canvas = ImageEditor.renderProcessedCanvas(item);
            const blob = await this.canvasToBlob(canvas, mimeType, quality);

            const padNum = String(i + 1).padStart(2, '0');
            const cleanName = (item.name || 'image').replace(/\.[^/.]+$/, '');
            const filename = `${padNum}_${cleanName}_edited.${ext}`;

            this.downloadBlob(blob, filename);

            // 브라우저 다중 다운로드 차단 방지를 위한 지연 (250ms)
            if (i < images.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }
    },

    /**
     * 여러 장의 사진을 하나의 ZIP 압축 파일로 다운로드
     * @param {Array<Object>} images 
     */
    async exportMultipleImagesAsZip(images) {
        if (!window.JSZip) {
            throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
        }

        const zip = new JSZip();
        const format = ImageEditor.settings.exportFormat;
        const quality = format === 'jpeg' ? ImageEditor.settings.jpgQuality / 100 : 0.92;
        const mimeType = `image/${format}`;
        const ext = format === 'jpeg' ? 'jpg' : format;

        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            const canvas = ImageEditor.renderProcessedCanvas(item);
            const blob = await this.canvasToBlob(canvas, mimeType, quality);

            const padNum = String(i + 1).padStart(2, '0');
            const cleanName = (item.name || 'image').replace(/\.[^/.]+$/, '');
            const filename = `${padNum}_${cleanName}_edited.${ext}`;

            zip.file(filename, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const zipFilename = `images_edited_${dateStr}.zip`;

        this.downloadBlob(zipBlob, zipFilename);
    },

    /**
     * Canvas -> Blob 비동기 변환
     */
    canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas Blob 변환에 실패했습니다.'));
                }
            }, mimeType, quality);
        });
    },

    /**
     * 가상 링크 생성 및 다운로드 트리거
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

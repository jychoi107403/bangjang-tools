/**
 * ============================================================================
 * assets/js/tool-video-to-gif.js - [영상 → GIF 고속 변환기] 전용 독립 모듈
 * ============================================================================
 * [주요 기능]
 * 1. MP4, MOV, WebM 동영상 드래그앤드롭 및 원클릭 업로드 (서버 전송 0%)
 * 2. 3종 스마트 용량·화질 프리셋:
 *    - 표준 균형 (480px · 12 FPS): 네이버/티스토리 블로그 본문 최적화
 *    - 고화질 우선 (640px · 18 FPS): 선명한 화질 및 부드러운 프레임
 *    - 최소 용량 압축 (360px · 8 FPS): 초경량 메신저/썸네일 공유용
 * 3. 최대 변환 길이 제한(5~20초), 배속(1x~2x), 역재생(Reverse GIF) 옵션 지원
 * 4. 원본 영상 vs 변환된 GIF 나란히 비교 뷰어 및 원클릭 다운로드
 */

const PRESET_CONFIG = {
    balanced: { width: 480, fps: 12, sampleInterval: 10, label: '표준 균형 (480px · 12FPS)' },
    high:     { width: 640, fps: 18, sampleInterval: 6,  label: '고화질 우선 (640px · 18FPS)' },
    compact:  { width: 360, fps: 8,  sampleInterval: 14, label: '최소 용량 압축 (360px · 8FPS)' }
};

class VideoToGifTool {
    constructor() {
        this.videoFile = null;
        this.videoUrl = null;
        this.duration = 0;
        this.isConverting = false;
        this.gifDataUrl = null;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        // 업로드 및 샘플 영역
        this.fileInput = document.getElementById('v2gif-file-input');
        this.dropZone = document.getElementById('v2gif-drop-zone');
        this.btnSelect = document.getElementById('btn-v2gif-select');
        this.btnSample = document.getElementById('btn-v2gif-sample');
        this.btnChange = document.getElementById('btn-v2gif-change');

        // 비교 워크스페이스
        this.workspaceSection = document.getElementById('v2gif-workspace-section');
        this.videoEl = document.getElementById('v2gif-video');
        this.origMetaText = document.getElementById('v2gif-orig-meta');

        // 인코딩 상태 및 GIF 미리보기
        this.statusBox = document.getElementById('v2gif-status-box');
        this.progressBar = document.getElementById('v2gif-progress-bar');
        this.progressLabel = document.getElementById('v2gif-progress-label');

        this.gifPreviewBox = document.getElementById('v2gif-gif-preview-box');
        this.gifImg = document.getElementById('v2gif-result-img');
        this.gifMetaText = document.getElementById('v2gif-gif-meta');
        this.btnDownload = document.getElementById('btn-v2gif-download');
        this.btnConvertInline = document.getElementById('btn-v2gif-convert-inline');

        // 우측 설정 사이드바
        this.selectPreset = document.getElementById('v2gif-select-preset');
        this.selectMaxLen = document.getElementById('v2gif-select-maxlen');
        this.selectSpeed = document.getElementById('v2gif-select-speed');
        this.checkReverse = document.getElementById('v2gif-check-reverse');
        this.inputFilename = document.getElementById('v2gif-input-filename');
        this.btnConvertSidebar = document.getElementById('btn-v2gif-convert-sidebar');
    }

    bindEvents() {
        if (this.btnSelect) {
            this.btnSelect.addEventListener('click', () => this.fileInput && this.fileInput.click());
        }
        if (this.btnChange) {
            this.btnChange.addEventListener('click', () => this.fileInput && this.fileInput.click());
        }
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this.loadVideo(file);
                this.fileInput.value = '';
            });
        }

        if (this.dropZone) {
            ['dragenter', 'dragover'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.add('drag-over');
                });
            });
            ['dragleave', 'drop'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('drag-over');
                });
            });
            this.dropZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files || []);
                const vFile = files.find(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(f.name));
                if (vFile) {
                    this.loadVideo(vFile);
                } else {
                    alert('동영상 파일(MP4, WebM, MOV 등)을 선택해 주세요.');
                }
            });
        }

        if (this.btnSample) {
            this.btnSample.addEventListener('click', () => this.loadSampleVideoAndConvert());
        }

        if (this.videoEl) {
            this.videoEl.addEventListener('loadedmetadata', () => {
                this.onMetadataReady();
            });
        }

        if (this.btnConvertSidebar) {
            this.btnConvertSidebar.addEventListener('click', () => this.convertVideoToGif());
        }
        if (this.btnConvertInline) {
            this.btnConvertInline.addEventListener('click', () => this.convertVideoToGif());
        }
        if (this.btnDownload) {
            this.btnDownload.addEventListener('click', () => this.downloadGif());
        }
    }

    /**
     * 비디오 파일을 로드하고 메타데이터 준비 후 자동 변환을 시작합니다.
     */
    loadVideo(file) {
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
        }
        this.videoFile = file;
        this.videoUrl = URL.createObjectURL(file);
        this.videoEl.src = this.videoUrl;
        this.videoEl.load();

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        if (this.inputFilename) {
            this.inputFilename.value = `${baseName}_고속움짤`;
        }
    }

    /**
     * 샘플 영상을 생성하여 즉시 변환까지 시연합니다.
     */
    async loadSampleVideoAndConvert() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext('2d');

            const stream = canvas.captureStream(20);
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.start();
            const totalFrames = 30;
            for (let i = 0; i < totalFrames; i++) {
                const p = i / totalFrames;
                const grad = ctx.createLinearGradient(0, 0, 480, 270);
                grad.addColorStop(0, '#0ea5e9');
                grad.addColorStop(1, '#6366f1');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 480, 270);

                // 회전하는 사각형 & 원 애니메이션
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(100 + p * 280, 135 + Math.cos(p * Math.PI * 4) * 40, 28, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 20px sans-serif';
                ctx.fillText(`Bangjang Auto GIF #${i + 1}`, 24, 40);

                await new Promise(r => setTimeout(r, 30));
            }
            recorder.stop();
            await new Promise(resolve => { recorder.onstop = resolve; });

            const blob = new Blob(chunks, { type: mimeType });
            const file = new File([blob], 'sample_auto_video.webm', { type: mimeType });
            this.loadVideo(file);
        } catch (err) {
            console.error('샘플 생성 실패:', err);
            alert('샘플 영상 자동 생성 중 오류가 발생했습니다.');
        }
    }

    onMetadataReady() {
        let dur = this.videoEl.duration;
        if (!isFinite(dur) || dur <= 0) dur = 2.0;
        this.duration = Math.round(dur * 10) / 10;

        const w = this.videoEl.videoWidth || 480;
        const h = this.videoEl.videoHeight || 270;
        const sizeKB = this.videoFile ? Math.max(1, Math.round(this.videoFile.size / 1024)) : 0;
        const sizeStr = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

        if (this.origMetaText) {
            this.origMetaText.textContent = `${this.videoFile?.name || 'video.webm'} · ${w}×${h}px · ${this.duration.toFixed(1)}초 · ${sizeStr}`;
        }

        if (this.dropZone) this.dropZone.style.display = 'none';
        if (this.workspaceSection) this.workspaceSection.style.display = 'flex';
        if (this.btnChange) this.btnChange.style.display = 'inline-flex';

        // 영상 로드 즉시 자동으로 첫 GIF 변환 수행
        this.convertVideoToGif();
    }

    seekToTime(timeSec) {
        return new Promise((resolve) => {
            if (!this.videoEl) return resolve();
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                this.videoEl.removeEventListener('seeked', done);
                resolve();
            };
            this.videoEl.addEventListener('seeked', done, { once: true });
            setTimeout(done, 400);
            try {
                this.videoEl.currentTime = Math.min(this.duration, Math.max(0, timeSec));
            } catch (e) {
                done();
            }
        });
    }

    /**
     * 선택된 프리셋에 맞춰 동영상을 고화질 GIF로 변환합니다.
     */
    async convertVideoToGif() {
        if (!this.videoEl || !this.videoUrl) {
            alert('변환할 동영상을 먼저 선택해 주세요.');
            return;
        }
        if (this.isConverting) return;

        if (typeof gifshot === 'undefined') {
            alert('GIF 인코딩 엔진(gifshot)이 로드되지 않았습니다.');
            return;
        }

        this.isConverting = true;
        this.videoEl.pause();

        if (this.btnConvertSidebar) this.btnConvertSidebar.disabled = true;
        if (this.btnConvertInline) this.btnConvertInline.disabled = true;
        if (this.statusBox) this.statusBox.style.display = 'flex';
        if (this.gifPreviewBox) this.gifPreviewBox.style.display = 'none';

        try {
            const presetKey = this.selectPreset?.value || 'balanced';
            const preset = PRESET_CONFIG[presetKey] || PRESET_CONFIG.balanced;
            const maxLenSec = parseFloat(this.selectMaxLen?.value || '10');
            const speed = parseFloat(this.selectSpeed?.value || '1');
            const isReverse = Boolean(this.checkReverse?.checked);

            const origW = this.videoEl.videoWidth || 480;
            const origH = this.videoEl.videoHeight || 270;
            const outW = Math.min(origW, preset.width);
            const outH = Math.max(2, Math.round((outW / origW) * origH));

            const targetDuration = Math.min(this.duration, maxLenSec);
            const stepSec = speed / preset.fps;
            const timestamps = [];
            for (let t = 0; t <= targetDuration + 0.001; t += stepSec) {
                timestamps.push(Math.min(targetDuration, t));
                if (timestamps.length >= 100) break;
            }
            if (timestamps.length < 2) timestamps.push(targetDuration);

            if (isReverse) {
                timestamps.reverse();
            }

            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');

            const frames = [];
            for (let i = 0; i < timestamps.length; i++) {
                const pct = Math.round(((i + 1) / timestamps.length) * 55);
                if (this.progressBar) this.progressBar.style.width = `${pct}%`;
                if (this.progressLabel) {
                    this.progressLabel.textContent = `영상 프레임 고속 추출 중... (${i + 1} / ${timestamps.length})`;
                }

                await this.seekToTime(timestamps[i]);
                ctx.clearRect(0, 0, outW, outH);
                ctx.drawImage(this.videoEl, 0, 0, outW, outH);
                frames.push(canvas.toDataURL('image/jpeg', 0.86));
            }

            if (this.progressBar) this.progressBar.style.width = '65%';
            if (this.progressLabel) {
                this.progressLabel.textContent = `${preset.label}로 GIF 최적화 인코딩 중...`;
            }

            const gifBase64 = await new Promise((resolve, reject) => {
                gifshot.createGIF({
                    images: frames,
                    gifWidth: outW,
                    gifHeight: outH,
                    interval: 1 / preset.fps,
                    numWorkers: 2,
                    sampleInterval: preset.sampleInterval,
                    progressCallback: (prog) => {
                        const pct = Math.round(65 + prog * 35);
                        if (this.progressBar) this.progressBar.style.width = `${pct}%`;
                    }
                }, (obj) => {
                    if (obj.error) reject(new Error(obj.errorMsg || 'GIF 변환 오류'));
                    else resolve(obj.image);
                });
            });

            this.gifDataUrl = gifBase64;
            if (this.gifImg) this.gifImg.src = gifBase64;

            const sizeBytes = Math.round((gifBase64.length * 3) / 4);
            const sizeStr = sizeBytes >= 1024 * 1024
                ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;

            if (this.gifMetaText) {
                this.gifMetaText.textContent = `${outW}×${outH}px · ${frames.length}프레임 (${preset.fps}FPS) · 용량: ${sizeStr}`;
            }

            if (this.statusBox) this.statusBox.style.display = 'none';
            if (this.gifPreviewBox) this.gifPreviewBox.style.display = 'flex';
        } catch (err) {
            console.error('GIF 고속 변환 오류:', err);
            alert(`GIF 변환 중 오류가 발생했습니다: ${err.message}`);
            if (this.statusBox) this.statusBox.style.display = 'none';
        } finally {
            this.isConverting = false;
            if (this.btnConvertSidebar) this.btnConvertSidebar.disabled = false;
            if (this.btnConvertInline) this.btnConvertInline.disabled = false;
        }
    }

    downloadGif() {
        if (!this.gifDataUrl) return;
        const rawName = (this.inputFilename?.value || '방장_고속움짤').trim();
        const link = document.createElement('a');
        link.href = this.gifDataUrl;
        link.download = rawName.endsWith('.gif') ? rawName : `${rawName}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.videoToGifTool = new VideoToGifTool();
});


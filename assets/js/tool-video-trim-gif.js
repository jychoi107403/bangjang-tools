/**
 * ============================================================================
 * assets/js/tool-video-trim-gif.js - [영상 구간 → GIF] 전용 독립 모듈
 * ============================================================================
 * [주요 기능]
 * 1. 로컬 동영상(MP4, WebM, MOV) 드래그앤드롭 및 파일 선택 로드 (서버 전송 0%)
 * 2. 시작 시간(Start) ~ 종료 시간(End) 슬라이더/숫자 입력 및 [현재 위치 지정] 버튼
 * 3. 선택 구간 반복 재생(Loop Preview) 실시간 확인
 * 4. 초당 프레임(FPS), 출력 해상도(360p~원본), 재생 배속(0.5x~2.0x) 커스터마이징
 * 5. Canvas 프레임 정밀 추출 + gifshot 웹 워커 기반 고화질 GIF 인코딩 및 다운로드
 */

class VideoTrimToGifTool {
    constructor() {
        // 비디오 및 구간 상태 변수
        this.videoFile = null;
        this.videoUrl = null;
        this.duration = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.isLoopingRange = true;
        this.isEncoding = false;
        this.generatedGifDataUrl = null;

        this.initDOM();
        this.bindEvents();
    }

    /** 다국어 안전 호출 헬퍼 */
    t(key, fallback = '') {
        if (window.i18n && typeof window.i18n.t === 'function') {
            return window.i18n.t(key, fallback);
        }
        return fallback || key;
    }

    initDOM() {
        // 파일 입력 및 드롭존
        this.fileInput = document.getElementById('vtrim-file-input');
        this.dropZone = document.getElementById('vtrim-drop-zone');
        this.btnSelectVideo = document.getElementById('btn-vtrim-select');
        this.btnChangeVideo = document.getElementById('btn-vtrim-change');
        this.btnLoadSample = document.getElementById('btn-vtrim-sample');

        // 플레이어 및 타임라인 워크스페이스
        this.editorSection = document.getElementById('vtrim-editor-section');
        this.videoEl = document.getElementById('vtrim-video');
        this.fileNameBadge = document.getElementById('vtrim-file-name');
        this.videoMetaBadge = document.getElementById('vtrim-video-meta');

        // 구간 슬라이더 및 입력 컨트롤
        this.rangeStart = document.getElementById('vtrim-range-start');
        this.rangeEnd = document.getElementById('vtrim-range-end');
        this.inputStart = document.getElementById('vtrim-input-start');
        this.inputEnd = document.getElementById('vtrim-input-end');
        this.btnSetCurStart = document.getElementById('btn-set-cur-start');
        this.btnSetCurEnd = document.getElementById('btn-set-cur-end');
        this.btnPreviewLoop = document.getElementById('btn-preview-loop');
        this.highlightBar = document.getElementById('vtrim-range-highlight');
        this.selectedDurationBadge = document.getElementById('vtrim-selected-duration');
        this.curTimeLabel = document.getElementById('vtrim-cur-time');

        // 우측 설정 사이드바
        this.selectFps = document.getElementById('vtrim-select-fps');
        this.selectWidth = document.getElementById('vtrim-select-width');
        this.selectSpeed = document.getElementById('vtrim-select-speed');
        this.inputOutputName = document.getElementById('vtrim-output-name');
        this.btnCreateGif = document.getElementById('btn-vtrim-create-gif');
        this.btnCreateInline = document.getElementById('btn-vtrim-create-inline');

        // 인코딩 진행률 오버레이
        this.encodingBox = document.getElementById('vtrim-encoding-box');
        this.progressBar = document.getElementById('vtrim-progress-bar');
        this.progressText = document.getElementById('vtrim-progress-text');

        // 완성된 GIF 결과 영역
        this.resultSection = document.getElementById('vtrim-result-section');
        this.resultImg = document.getElementById('vtrim-result-img');
        this.resultInfo = document.getElementById('vtrim-result-info');
        this.btnDownloadGif = document.getElementById('btn-vtrim-download');
    }

    bindEvents() {
        // 1. 파일 선택 버튼 클릭
        if (this.btnSelectVideo) {
            this.btnSelectVideo.addEventListener('click', () => this.fileInput && this.fileInput.click());
        }
        if (this.btnChangeVideo) {
            this.btnChangeVideo.addEventListener('click', () => this.fileInput && this.fileInput.click());
        }
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this.loadVideoFile(file);
                this.fileInput.value = '';
            });
        }

        // 2. 드래그 앤 드롭 이벤트
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
                const videoFile = files.find(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(f.name));
                if (videoFile) {
                    this.loadVideoFile(videoFile);
                } else {
                    alert('지원되는 동영상 파일(MP4, WebM, MOV 등)을 선택해 주세요.');
                }
            });
        }

        // 3. 샘플 동영상 생성 및 로드 버튼 (원클릭 체험용)
        if (this.btnLoadSample) {
            this.btnLoadSample.addEventListener('click', () => this.loadSampleVideo());
        }

        // 4. 비디오 메타데이터 로드 및 재생 시간 추적
        if (this.videoEl) {
            this.videoEl.addEventListener('loadedmetadata', () => {
                this.onVideoMetadataLoaded();
            });

            this.videoEl.addEventListener('timeupdate', () => {
                if (this.isEncoding) return;
                const cur = this.videoEl.currentTime;
                if (this.curTimeLabel) {
                    this.curTimeLabel.textContent = `${cur.toFixed(1)}s / ${this.duration.toFixed(1)}s`;
                }
                // 구간 반복 재생이 켜져 있으면 종료 시간 도달 시 시작 시간으로 이동
                if (this.isLoopingRange && cur >= this.endTime) {
                    this.videoEl.currentTime = this.startTime;
                    if (!this.videoEl.paused) {
                        this.videoEl.play().catch(() => {});
                    }
                }
            });
        }

        // 5. 시작/종료 슬라이더 및 숫자 입력 동기화
        if (this.rangeStart) {
            this.rangeStart.addEventListener('input', () => {
                let val = parseFloat(this.rangeStart.value) || 0;
                if (val >= this.endTime - 0.2) {
                    val = Math.max(0, this.endTime - 0.2);
                    this.rangeStart.value = val.toFixed(1);
                }
                this.startTime = val;
                if (this.inputStart) this.inputStart.value = val.toFixed(1);
                if (this.videoEl) this.videoEl.currentTime = val;
                this.updateTimelineUI();
            });
        }

        if (this.rangeEnd) {
            this.rangeEnd.addEventListener('input', () => {
                let val = parseFloat(this.rangeEnd.value) || 0;
                if (val <= this.startTime + 0.2) {
                    val = Math.min(this.duration, this.startTime + 0.2);
                    this.rangeEnd.value = val.toFixed(1);
                }
                this.endTime = val;
                if (this.inputEnd) this.inputEnd.value = val.toFixed(1);
                if (this.videoEl) this.videoEl.currentTime = Math.max(this.startTime, val - 0.3);
                this.updateTimelineUI();
            });
        }

        if (this.inputStart) {
            this.inputStart.addEventListener('change', () => {
                let val = Math.max(0, Math.min(this.duration - 0.2, parseFloat(this.inputStart.value) || 0));
                if (val >= this.endTime - 0.2) val = Math.max(0, this.endTime - 0.2);
                this.startTime = val;
                this.inputStart.value = val.toFixed(1);
                if (this.rangeStart) this.rangeStart.value = val.toFixed(1);
                if (this.videoEl) this.videoEl.currentTime = val;
                this.updateTimelineUI();
            });
        }

        if (this.inputEnd) {
            this.inputEnd.addEventListener('change', () => {
                let val = Math.max(0.2, Math.min(this.duration, parseFloat(this.inputEnd.value) || this.duration));
                if (val <= this.startTime + 0.2) val = Math.min(this.duration, this.startTime + 0.2);
                this.endTime = val;
                this.inputEnd.value = val.toFixed(1);
                if (this.rangeEnd) this.rangeEnd.value = val.toFixed(1);
                this.updateTimelineUI();
            });
        }

        // 6. [현재 위치를 시작점으로] / [현재 위치를 종료점으로] 버튼
        if (this.btnSetCurStart) {
            this.btnSetCurStart.addEventListener('click', () => {
                if (!this.videoEl || !this.duration) return;
                let cur = this.videoEl.currentTime;
                if (cur >= this.endTime - 0.2) {
                    this.endTime = Math.min(this.duration, cur + 1.0);
                    if (this.rangeEnd) this.rangeEnd.value = this.endTime.toFixed(1);
                    if (this.inputEnd) this.inputEnd.value = this.endTime.toFixed(1);
                }
                this.startTime = Math.max(0, Math.min(cur, this.endTime - 0.2));
                if (this.rangeStart) this.rangeStart.value = this.startTime.toFixed(1);
                if (this.inputStart) this.inputStart.value = this.startTime.toFixed(1);
                this.updateTimelineUI();
            });
        }

        if (this.btnSetCurEnd) {
            this.btnSetCurEnd.addEventListener('click', () => {
                if (!this.videoEl || !this.duration) return;
                let cur = this.videoEl.currentTime;
                if (cur <= this.startTime + 0.2) {
                    this.startTime = Math.max(0, cur - 1.0);
                    if (this.rangeStart) this.rangeStart.value = this.startTime.toFixed(1);
                    if (this.inputStart) this.inputStart.value = this.startTime.toFixed(1);
                }
                this.endTime = Math.min(this.duration, Math.max(cur, this.startTime + 0.2));
                if (this.rangeEnd) this.rangeEnd.value = this.endTime.toFixed(1);
                if (this.inputEnd) this.inputEnd.value = this.endTime.toFixed(1);
                this.updateTimelineUI();
            });
        }

        // 7. [선택 구간 반복 재생] 버튼
        if (this.btnPreviewLoop) {
            this.btnPreviewLoop.addEventListener('click', () => {
                if (!this.videoEl || !this.duration) return;
                this.isLoopingRange = true;
                this.videoEl.currentTime = this.startTime;
                this.videoEl.play().catch(() => {});
            });
        }

        // 8. [선택 구간 GIF 만들기] 실행 버튼
        if (this.btnCreateGif) {
            this.btnCreateGif.addEventListener('click', () => this.createGifFromRange());
        }
        if (this.btnCreateInline) {
            this.btnCreateInline.addEventListener('click', () => this.createGifFromRange());
        }

        // 9. [GIF 다운로드] 버튼
        if (this.btnDownloadGif) {
            this.btnDownloadGif.addEventListener('click', () => this.downloadGif());
        }
    }

    /**
     * 로컬 비디오 파일을 읽어 플레이어에 바인딩합니다.
     */
    loadVideoFile(file) {
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
        }
        this.videoFile = file;
        this.videoUrl = URL.createObjectURL(file);
        this.videoEl.src = this.videoUrl;
        this.videoEl.load();

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        if (this.inputOutputName) {
            this.inputOutputName.value = `${baseName}_구간움짤`;
        }
        if (this.fileNameBadge) {
            this.fileNameBadge.textContent = file.name;
        }
        if (this.resultSection) {
            this.resultSection.style.display = 'none';
        }
    }

    /**
     * 테스트/체험을 위한 3초 분량의 캔버스 애니메이션 샘플 영상을 브라우저에서 즉시 생성합니다.
     */
    async loadSampleVideo() {
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
            const totalFrames = 40; // 약 2초 분량
            for (let i = 0; i < totalFrames; i++) {
                const progress = i / totalFrames;
                // 배경 그라데이션
                const grad = ctx.createLinearGradient(0, 0, 480, 270);
                grad.addColorStop(0, '#4f46e5');
                grad.addColorStop(1, '#7c3aed');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 480, 270);

                // 움직이는 원형 애니메이션
                const cx = 80 + progress * 320;
                const cy = 135 + Math.sin(progress * Math.PI * 4) * 45;
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(cx, cy, 32, 0, Math.PI * 2);
                ctx.fill();

                // 타임코드 텍스트 표시
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(`Bangjang Sample ${(i / 20).toFixed(1)}s`, 24, 42);

                await new Promise(r => setTimeout(r, 35));
            }
            recorder.stop();

            await new Promise(resolve => { recorder.onstop = resolve; });
            const blob = new Blob(chunks, { type: mimeType });
            const sampleFile = new File([blob], 'sample_demo_clip.webm', { type: mimeType });
            this.loadVideoFile(sampleFile);
        } catch (err) {
            console.error('샘플 영상 생성 오류:', err);
            alert('현재 브라우저에서 샘플 자동 생성을 지원하지 않습니다. 직접 동영상 파일을 선택해 주세요.');
        }
    }

    /**
     * 비디오 메타데이터 로드 완료 시 타임라인 초기화
     */
    onVideoMetadataLoaded() {
        let dur = this.videoEl.duration;
        if (!isFinite(dur) || dur <= 0) {
            dur = 3.0;
        }
        this.duration = Math.round(dur * 10) / 10;
        this.startTime = 0;
        // 기본 선택 구간은 최대 5초 또는 전체 영상 길이
        this.endTime = Math.min(this.duration, 5.0);

        if (this.rangeStart) {
            this.rangeStart.min = '0';
            this.rangeStart.max = this.duration.toFixed(1);
            this.rangeStart.step = '0.1';
            this.rangeStart.value = '0';
        }
        if (this.rangeEnd) {
            this.rangeEnd.min = '0';
            this.rangeEnd.max = this.duration.toFixed(1);
            this.rangeEnd.step = '0.1';
            this.rangeEnd.value = this.endTime.toFixed(1);
        }
        if (this.inputStart) {
            this.inputStart.max = this.duration.toFixed(1);
            this.inputStart.value = '0.0';
        }
        if (this.inputEnd) {
            this.inputEnd.max = this.duration.toFixed(1);
            this.inputEnd.value = this.endTime.toFixed(1);
        }

        const w = this.videoEl.videoWidth || 480;
        const h = this.videoEl.videoHeight || 270;
        const sizeMB = this.videoFile ? (this.videoFile.size / (1024 * 1024)).toFixed(2) : '0.00';
        if (this.videoMetaBadge) {
            this.videoMetaBadge.textContent = `${w}×${h}px · 총 ${this.duration.toFixed(1)}초 · ${sizeMB} MB`;
        }

        if (this.dropZone) this.dropZone.style.display = 'none';
        if (this.editorSection) this.editorSection.style.display = 'flex';
        if (this.btnChangeVideo) this.btnChangeVideo.style.display = 'inline-flex';

        this.updateTimelineUI();
    }

    /**
     * 시작~종료 구간 하이라이트 바 및 선택 길이 뱃지 갱신
     */
    updateTimelineUI() {
        const clipLen = Math.max(0.1, this.endTime - this.startTime);
        const fps = parseInt(this.selectFps?.value || '15', 10);
        const speed = parseFloat(this.selectSpeed?.value || '1');
        const estFrames = Math.max(2, Math.min(120, Math.round((clipLen / speed) * fps)));

        if (this.selectedDurationBadge) {
            this.selectedDurationBadge.textContent = `선택 구간: ${this.startTime.toFixed(1)}초 ~ ${this.endTime.toFixed(1)}초 (총 ${clipLen.toFixed(1)}초 · 약 ${estFrames}프레임)`;
        }

        if (this.highlightBar && this.duration > 0) {
            const leftPct = (this.startTime / this.duration) * 100;
            const widthPct = ((this.endTime - this.startTime) / this.duration) * 100;
            this.highlightBar.style.left = `${leftPct}%`;
            this.highlightBar.style.width = `${Math.max(2, widthPct)}%`;
        }
    }

    /**
     * 비디오의 특정 시간(초)으로 탐색(Seek)하고 프레임 렌더링 완료를 대기합니다.
     */
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
            setTimeout(done, 400); // 이미 동일 프레임이거나 브라우저 이벤트 지연 시 안전 폴백
            try {
                this.videoEl.currentTime = Math.min(this.duration, Math.max(0, timeSec));
            } catch (e) {
                done();
            }
        });
    }

    /**
     * 지정된 시작~종료 구간에서 프레임을 추출하여 GIF로 인코딩합니다.
     */
    async createGifFromRange() {
        if (!this.videoEl || !this.videoUrl) {
            alert('먼저 동영상을 선택하거나 샘플 영상을 불러와 주세요.');
            return;
        }
        if (this.isEncoding) return;

        if (typeof gifshot === 'undefined') {
            alert('GIF 인코딩 엔진(gifshot)을 불러오지 못했습니다. 페이지를 새로고침 해주세요.');
            return;
        }

        this.isEncoding = true;
        this.videoEl.pause();

        if (this.btnCreateGif) this.btnCreateGif.disabled = true;
        if (this.encodingBox) this.encodingBox.style.display = 'block';
        if (this.resultSection) this.resultSection.style.display = 'none';

        try {
            const fps = parseInt(this.selectFps?.value || '15', 10);
            const speed = parseFloat(this.selectSpeed?.value || '1');
            const targetWidthOpt = this.selectWidth?.value || '480';

            const origW = this.videoEl.videoWidth || 480;
            const origH = this.videoEl.videoHeight || 270;
            let outW = origW;
            let outH = origH;

            if (targetWidthOpt !== 'original') {
                const maxW = parseInt(targetWidthOpt, 10) || 480;
                outW = Math.min(origW, maxW);
                outH = Math.max(2, Math.round((outW / origW) * origH));
            }

            const clipDuration = Math.max(0.2, this.endTime - this.startTime);
            const stepSec = speed / fps;
            const timestamps = [];
            for (let t = this.startTime; t <= this.endTime + 0.001; t += stepSec) {
                timestamps.push(Math.min(this.endTime, t));
                if (timestamps.length >= 120) break; // 브라우저 메모리 보호 (최대 120프레임)
            }
            if (timestamps.length < 2) {
                timestamps.push(this.endTime);
            }

            // 오프스크린 캔버스 준비
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');

            const capturedFrames = [];
            for (let i = 0; i < timestamps.length; i++) {
                const pct = Math.round(((i + 1) / timestamps.length) * 55);
                if (this.progressBar) this.progressBar.style.width = `${pct}%`;
                if (this.progressText) {
                    this.progressText.textContent = `구간 프레임 정밀 추출 중... (${i + 1} / ${timestamps.length} 프레임)`;
                }

                await this.seekToTime(timestamps[i]);
                ctx.clearRect(0, 0, outW, outH);
                ctx.drawImage(this.videoEl, 0, 0, outW, outH);
                capturedFrames.push(canvas.toDataURL('image/jpeg', 0.88));
            }

            if (this.progressBar) this.progressBar.style.width = '65%';
            if (this.progressText) {
                this.progressText.textContent = `고화질 GIF 애니메이션 인코딩 중...`;
            }

            const gifResult = await new Promise((resolve, reject) => {
                gifshot.createGIF({
                    images: capturedFrames,
                    gifWidth: outW,
                    gifHeight: outH,
                    interval: 1 / fps,
                    numWorkers: 2,
                    sampleInterval: 10,
                    progressCallback: (prog) => {
                        const totalPct = Math.round(65 + prog * 35);
                        if (this.progressBar) this.progressBar.style.width = `${totalPct}%`;
                    }
                }, (obj) => {
                    if (obj.error) reject(new Error(obj.errorMsg || 'GIF 인코딩 실패'));
                    else resolve(obj.image);
                });
            });

            this.generatedGifDataUrl = gifResult;
            if (this.resultImg) this.resultImg.src = gifResult;

            const sizeBytes = Math.round((gifResult.length * 3) / 4);
            const sizeText = sizeBytes >= 1024 * 1024
                ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;

            if (this.resultInfo) {
                this.resultInfo.textContent = `해상도: ${outW}×${outH}px · 구간: ${clipDuration.toFixed(1)}초 (${capturedFrames.length}프레임, ${fps}FPS) · 파일 크기: ${sizeText}`;
            }

            if (this.encodingBox) this.encodingBox.style.display = 'none';
            if (this.resultSection) this.resultSection.style.display = 'block';
        } catch (err) {
            console.error('GIF 변환 오류:', err);
            alert(`GIF 변환 중 오류가 발생했습니다: ${err.message}`);
            if (this.encodingBox) this.encodingBox.style.display = 'none';
        } finally {
            this.isEncoding = false;
            if (this.btnCreateGif) this.btnCreateGif.disabled = false;
        }
    }

    /**
     * 생성된 GIF 파일을 즉시 다운로드합니다.
     */
    downloadGif() {
        if (!this.generatedGifDataUrl) return;
        const customName = (this.inputOutputName?.value || '방장_구간움짤').trim();
        const link = document.createElement('a');
        link.href = this.generatedGifDataUrl;
        link.download = customName.endsWith('.gif') ? customName : `${customName}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.videoTrimGifTool = new VideoTrimToGifTool();
});

/**
 * ====================================================================
 * 방장 용용이 - 화면녹화 → 고화질 GIF 변환기 (Screen Record to GIF)
 * 
 * 주요 기능:
 * 1. 무설치 웹 표준 Screen Capture API를 이용한 탭/창/전체화면 공유
 * 2. 캔버스 기반 실시간 마우스 드래그 녹화 영역 크롭 (Crop Box)
 * 3. 9분할 위치 선택 및 이미지/텍스트 워터마크 실시간 합성
 * 4. 3초 카운트다운 오버레이 및 타이머 제어
 * 5. 100% 브라우저 로컬 고속 GIF 인코딩 및 즉시 다운로드
 * ====================================================================
 */

class ScreenRecordToGifTool {
    constructor() {
        // 1. 미디어 스트림 및 상태 변수
        this.mediaStream = null;
        this.videoElement = null;
        this.displayCanvas = null;
        this.displayCtx = null;
        this.animFrameId = null;

        // 2. 녹화 상태
        this.isRecording = false;
        this.isCountingDown = false;
        this.recordTimerId = null;
        this.recordStartTime = 0;
        this.capturedFrames = []; // 캡처된 프레임 이미지 데이터 배열

        // 3. 크롭 (녹화 영역) 좌표 및 크기
        this.crop = {
            startX: 0,
            startY: 0,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            isDragging: false,
            hasCrop: false
        };

        // 4. 워터마크 설정
        this.watermark = {
            enabled: false,
            image: null, // HTMLImageElement
            fileName: '',
            width: 160,
            position: 'rb', // 'lt', 'ct', 'rt', 'lc', 'cc', 'rc', 'lb', 'cb', 'rb'
            opacity: 0.9,
            margin: 16
        };

        // 5. DOM 엘리먼트 캐싱 및 초기화
        this.initDOMElements();
        this.bindEvents();
    }

    /**
     * DOM 엘리먼트 참조 초기화
     */
    initDOMElements() {
        // 상단 제어 버튼 및 타이머
        this.btnShareScreen = document.getElementById('btn-share-screen');
        this.btnStopShare = document.getElementById('btn-stop-share');
        this.btnStartRecord = document.getElementById('btn-start-record');
        this.timerDisplay = document.getElementById('timer-display');

        // 프리뷰 뷰포트
        this.emptyView = document.getElementById('record-empty-view');
        this.canvasWrapper = document.getElementById('record-canvas-wrapper');
        this.videoElement = document.getElementById('record-stream-video');
        this.displayCanvas = document.getElementById('record-display-canvas');
        this.displayCtx = this.displayCanvas.getContext('2d');
        this.cropBoxOverlay = document.getElementById('crop-box-overlay');

        // 오버레이 (카운트다운, 인코딩 프로그레스)
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');
        this.encodingOverlay = document.getElementById('encoding-overlay');
        this.encodingProgressBar = document.getElementById('encoding-progress-bar');
        this.encodingStatusText = document.getElementById('encoding-status-text');

        // 결과 모달
        this.resultModal = document.getElementById('record-result-modal');
        this.resultGifImg = document.getElementById('result-gif-img');
        this.resultResolution = document.getElementById('result-resolution');
        this.resultDuration = document.getElementById('result-duration');
        this.resultFileSize = document.getElementById('result-filesize');
        this.btnDownloadGif = document.getElementById('btn-download-gif');
        this.btnCloseResult = document.getElementById('btn-close-result');

        // 우측 설정창 엘리먼트
        this.inputCropX = document.getElementById('input-crop-x');
        this.inputCropY = document.getElementById('input-crop-y');
        this.inputCropW = document.getElementById('input-crop-w');
        this.inputCropH = document.getElementById('input-crop-h');
        this.selectRatio = document.getElementById('select-crop-ratio');

        this.inputFilename = document.getElementById('input-record-filename');
        this.inputMaxDuration = document.getElementById('input-max-duration');
        this.selectOutputSize = document.getElementById('select-output-size');
        this.selectFps = document.getElementById('select-fps');
        this.selectCountdown = document.getElementById('select-countdown');

        // 워터마크 설정 엘리먼트
        this.checkWatermark = document.getElementById('check-watermark');
        this.watermarkFileInput = document.getElementById('watermark-file-input');
        this.watermarkFileName = document.getElementById('watermark-filename');
        this.btnSelectWatermark = document.getElementById('btn-select-watermark');
        this.btnDeleteWatermark = document.getElementById('btn-delete-watermark');
        this.inputWatermarkWidth = document.getElementById('input-watermark-width');
        this.selectWatermarkPos = document.getElementById('select-watermark-pos');
        this.gridPosButtons = document.querySelectorAll('.grid-9-btn');
        this.rangeWatermarkOpacity = document.getElementById('range-watermark-opacity');
        this.valWatermarkOpacity = document.getElementById('val-watermark-opacity');
        this.inputWatermarkMargin = document.getElementById('input-watermark-margin');
    }

    /**
     * 사용자 인터랙션 이벤트 리스너 바인딩
     */
    bindEvents() {
        // 화면 공유 시작 / 중지
        this.btnShareScreen.addEventListener('click', () => this.startScreenShare());
        this.btnStopShare.addEventListener('click', () => this.stopScreenShare());

        // 녹화 시작 / 중지
        this.btnStartRecord.addEventListener('click', () => {
            if (this.isRecording) {
                this.finishRecording();
            } else {
                this.initiateRecording();
            }
        });

        // 캔버스 마우스 드래그 크롭 영역 지정
        this.displayCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());

        // 크롭 인풋 변경 시 실시간 반영
        [this.inputCropX, this.inputCropY, this.inputCropW, this.inputCropH].forEach(input => {
            input.addEventListener('input', () => this.updateCropFromInputs());
        });

        // 빠른 비율 선택 변경
        this.selectRatio.addEventListener('change', () => this.applyRatioPreset());

        // 워터마크 체크박스 토글
        this.checkWatermark.addEventListener('change', (e) => {
            this.watermark.enabled = e.target.checked;
        });

        // 워터마크 파일 선택
        this.btnSelectWatermark.addEventListener('click', () => this.watermarkFileInput.click());
        this.watermarkFileInput.addEventListener('change', (e) => this.handleWatermarkUpload(e));
        this.btnDeleteWatermark.addEventListener('click', () => this.clearWatermarkImage());

        // 워터마크 속성 조절
        this.inputWatermarkWidth.addEventListener('input', (e) => {
            this.watermark.width = parseInt(e.target.value, 10) || 160;
        });

        this.rangeWatermarkOpacity.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            this.watermark.opacity = val / 100;
            if (this.valWatermarkOpacity) this.valWatermarkOpacity.textContent = `${val}%`;
        });

        this.inputWatermarkMargin.addEventListener('input', (e) => {
            this.watermark.margin = parseInt(e.target.value, 10) || 16;
        });

        // 9분할 위치 버튼 클릭
        this.gridPosButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.gridPosButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const pos = btn.getAttribute('data-pos');
                this.watermark.position = pos;
                if (this.selectWatermarkPos) this.selectWatermarkPos.value = pos;
            });
        });

        if (this.selectWatermarkPos) {
            this.selectWatermarkPos.addEventListener('change', (e) => {
                const pos = e.target.value;
                this.watermark.position = pos;
                this.gridPosButtons.forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-pos') === pos);
                });
            });
        }

        // 결과 모달 닫기
        this.btnCloseResult.addEventListener('click', () => {
            this.resultModal.classList.remove('active');
            this.resultModal.style.display = 'none';
        });
    }

    /**
     * 1. 웹 표준 화면 공유 시작 (Screen Capture API)
     */
    async startScreenShare() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                alert('현재 사용 중인 브라우저가 화면 녹화(Screen Capture API)를 지원하지 않습니다.\n최신 버전의 크롬(Chrome)이나 엣지(Edge) 브라우저를 권장합니다.');
                return;
            }

            // 화면 공유 요청 (커서 표시 포함, 소리는 제외)
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: false
            });

            // 사용자가 브라우저 기본 상단 바에서 '공유 중지'를 눌렀을 때의 콜백
            const videoTrack = this.mediaStream.getVideoTracks()[0];
            videoTrack.onended = () => {
                this.stopScreenShare();
            };

            // 비디오 엘리먼트에 스트림 연결 및 재생 시작
            this.videoElement.srcObject = this.mediaStream;
            await this.videoElement.play();

            // 뷰포트 화면 전환: 대기 상태 숨기고 캔버스 활성화
            this.emptyView.style.display = 'none';
            this.canvasWrapper.style.display = 'flex';
            this.btnStopShare.disabled = false;
            this.btnStartRecord.disabled = false;

            // 원본 비디오 해상도 설정
            const videoWidth = this.videoElement.videoWidth || 1920;
            const videoHeight = this.videoElement.videoHeight || 1080;

            this.displayCanvas.width = videoWidth;
            this.displayCanvas.height = videoHeight;

            // 초기 녹화 영역: 전체 화면으로 기본 설정
            this.setFullCrop(videoWidth, videoHeight);

            // 실시간 캔버스 렌더링 루프 가동
            this.startCanvasRenderLoop();

        } catch (error) {
            console.warn('화면 공유 선택 취소 또는 권한 거부:', error);
        }
    }

    /**
     * 2. 화면 공유 종료 및 리소스 초기화
     */
    stopScreenShare() {
        if (this.isRecording) {
            this.finishRecording();
        }

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        // UI 복원
        this.emptyView.style.display = 'flex';
        this.canvasWrapper.style.display = 'none';
        this.btnStopShare.disabled = true;
        this.btnStartRecord.disabled = true;
        this.btnStartRecord.classList.remove('recording');
        this.btnStartRecord.innerHTML = '<i data-lucide="video"></i><span data-i18n="record.btn_start">녹화 시작</span>';
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * 3. 캔버스 실시간 렌더링 루프
     */
    startCanvasRenderLoop() {
        const render = () => {
            if (this.videoElement && this.videoElement.readyState >= 2) {
                const w = this.displayCanvas.width;
                const h = this.displayCanvas.height;

                // 1) 비디오 원본 프레임 그리기
                this.displayCtx.drawImage(this.videoElement, 0, 0, w, h);

                // 2) 크롭 영역 외부 어둡게 마스킹 (Dimming Effect)
                if (this.crop.hasCrop && (this.crop.width > 0 && this.crop.height > 0)) {
                    this.displayCtx.save();
                    this.displayCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                    
                    // 상단 마스크
                    this.displayCtx.fillRect(0, 0, w, this.crop.y);
                    // 하단 마스크
                    this.displayCtx.fillRect(0, this.crop.y + this.crop.height, w, h - (this.crop.y + this.crop.height));
                    // 좌측 마스크
                    this.displayCtx.fillRect(0, this.crop.y, this.crop.x, this.crop.height);
                    // 우측 마스크
                    this.displayCtx.fillRect(this.crop.x + this.crop.width, this.crop.y, w - (this.crop.x + this.crop.width), this.crop.height);

                    // 선택 영역 테두리 가이드선
                    this.displayCtx.strokeStyle = '#a78bfa';
                    this.displayCtx.lineWidth = 2;
                    this.displayCtx.setLineDash([6, 6]);
                    this.displayCtx.strokeRect(this.crop.x, this.crop.y, this.crop.width, this.crop.height);
                    this.displayCtx.restore();
                }

                // 3) 워터마크 실시간 합성 렌더링 (미리보기)
                this.renderWatermarkOnCanvas(this.displayCtx, this.crop.x, this.crop.y, this.crop.width, this.crop.height);
            }

            this.animFrameId = requestAnimationFrame(render);
        };

        render();
    }

    /**
     * 4. 워터마크 캔버스 렌더링 함수
     */
    renderWatermarkOnCanvas(ctx, cropX, cropY, cropW, cropH) {
        if (!this.watermark.enabled || !this.watermark.image) return;

        ctx.save();
        ctx.globalAlpha = this.watermark.opacity;

        const img = this.watermark.image;
        const targetW = Math.min(this.watermark.width, cropW * 0.8);
        const aspect = img.height / img.width;
        const targetH = targetW * aspect;
        const margin = this.watermark.margin;

        let posX = cropX + margin;
        let posY = cropY + margin;

        const pos = this.watermark.position;
        // X 좌표 계산
        if (pos.includes('l')) { // Left
            posX = cropX + margin;
        } else if (pos.includes('c') && !pos.includes('lc') && !pos.includes('rc')) { // Center
            posX = cropX + (cropW - targetW) / 2;
        } else if (pos.includes('r')) { // Right
            posX = cropX + cropW - targetW - margin;
        }

        // Y 좌표 계산
        if (pos.includes('t')) { // Top
            posY = cropY + margin;
        } else if (pos === 'lc' || pos === 'cc' || pos === 'rc') { // Middle
            posY = cropY + (cropH - targetH) / 2;
        } else if (pos.includes('b')) { // Bottom
            posY = cropY + cropH - targetH - margin;
        }

        ctx.drawImage(img, posX, posY, targetW, targetH);
        ctx.restore();
    }

    /**
     * 5. 마우스 드래그 크롭 영역 계산 핸들러
     */
    handleMouseDown(e) {
        if (!this.mediaStream) return;

        const rect = this.displayCanvas.getBoundingClientRect();
        const scaleX = this.displayCanvas.width / rect.width;
        const scaleY = this.displayCanvas.height / rect.height;

        this.crop.startX = (e.clientX - rect.left) * scaleX;
        this.crop.startY = (e.clientY - rect.top) * scaleY;
        this.crop.isDragging = true;
        this.crop.hasCrop = true;
    }

    handleMouseMove(e) {
        if (!this.crop.isDragging) return;

        const rect = this.displayCanvas.getBoundingClientRect();
        const scaleX = this.displayCanvas.width / rect.width;
        const scaleY = this.displayCanvas.height / rect.height;

        const currentX = Math.max(0, Math.min(this.displayCanvas.width, (e.clientX - rect.left) * scaleX));
        const currentY = Math.max(0, Math.min(this.displayCanvas.height, (e.clientY - rect.top) * scaleY));

        let x = Math.min(this.crop.startX, currentX);
        let y = Math.min(this.crop.startY, currentY);
        let width = Math.abs(currentX - this.crop.startX);
        let height = Math.abs(currentY - this.crop.startY);

        // 비율 제약 조건이 있는 경우 계산
        const ratio = this.selectRatio.value;
        if (ratio === '1:1') {
            const size = Math.min(width, height);
            width = size;
            height = size;
        } else if (ratio === '16:9') {
            height = width * (9 / 16);
        } else if (ratio === '4:3') {
            height = width * (3 / 4);
        } else if (ratio === '9:16') {
            width = height * (9 / 16);
        }

        this.crop.x = Math.round(x);
        this.crop.y = Math.round(y);
        this.crop.width = Math.round(width);
        this.crop.height = Math.round(height);

        this.syncCropToInputs();
    }

    handleMouseUp() {
        if (this.crop.isDragging) {
            this.crop.isDragging = false;
            // 너무 작게 클릭한 경우 전체 화면으로 복원
            if (this.crop.width < 20 || this.crop.height < 20) {
                this.setFullCrop(this.displayCanvas.width, this.displayCanvas.height);
            }
        }
    }

    setFullCrop(w, h) {
        this.crop.x = 0;
        this.crop.y = 0;
        this.crop.width = w;
        this.crop.height = h;
        this.crop.hasCrop = true;
        this.syncCropToInputs();
    }

    syncCropToInputs() {
        this.inputCropX.value = this.crop.x;
        this.inputCropY.value = this.crop.y;
        this.inputCropW.value = this.crop.width;
        this.inputCropH.value = this.crop.height;
    }

    updateCropFromInputs() {
        const x = Math.max(0, parseInt(this.inputCropX.value, 10) || 0);
        const y = Math.max(0, parseInt(this.inputCropY.value, 10) || 0);
        const w = Math.max(10, parseInt(this.inputCropW.value, 10) || this.displayCanvas.width);
        const h = Math.max(10, parseInt(this.inputCropH.value, 10) || this.displayCanvas.height);

        this.crop.x = Math.min(x, this.displayCanvas.width - 10);
        this.crop.y = Math.min(y, this.displayCanvas.height - 10);
        this.crop.width = Math.min(w, this.displayCanvas.width - this.crop.x);
        this.crop.height = Math.min(h, this.displayCanvas.height - this.crop.y);
        this.crop.hasCrop = true;
    }

    applyRatioPreset() {
        const val = this.selectRatio.value;
        const cw = this.displayCanvas.width;
        const ch = this.displayCanvas.height;

        if (val === 'full') {
            this.setFullCrop(cw, ch);
            return;
        }

        let w = this.crop.width;
        let h = this.crop.height;

        if (val === '1:1') {
            const s = Math.min(w, h);
            this.crop.width = s;
            this.crop.height = s;
        } else if (val === '16:9') {
            this.crop.height = Math.round(w * (9 / 16));
        } else if (val === '4:3') {
            this.crop.height = Math.round(w * (3 / 4));
        } else if (val === '9:16') {
            this.crop.width = Math.round(h * (9 / 16));
        }

        this.syncCropToInputs();
    }

    /**
     * 6. 워터마크 이미지 업로드 처리
     */
    handleWatermarkUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.watermarkFileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.watermark.image = img;
                this.watermark.enabled = true;
                this.checkWatermark.checked = true;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    clearWatermarkImage() {
        this.watermark.image = null;
        this.watermark.enabled = false;
        this.checkWatermark.checked = false;
        this.watermarkFileName.textContent = '선택한 파일 없음';
        this.watermarkFileInput.value = '';
    }

    /**
     * 7. 녹화 시작 루틴 (카운트다운 -> 프레임 수집)
     */
    initiateRecording() {
        if (!this.mediaStream) {
            alert('먼저 [공유 화면 선택]을 눌러 녹화할 화면이나 창을 선택해 주세요.');
            return;
        }

        const countdownSec = parseInt(this.selectCountdown.value, 10) || 0;

        if (countdownSec > 0) {
            this.runCountdown(countdownSec, () => this.startCapturingFrames());
        } else {
            this.startCapturingFrames();
        }
    }

    runCountdown(seconds, onFinish) {
        this.isCountingDown = true;
        this.countdownOverlay.style.display = 'flex';
        let current = seconds;
        this.countdownNumber.textContent = current;

        const interval = setInterval(() => {
            current--;
            if (current > 0) {
                this.countdownNumber.textContent = current;
            } else {
                clearInterval(interval);
                this.countdownOverlay.style.display = 'none';
                this.isCountingDown = false;
                onFinish();
            }
        }, 1000);
    }

    /**
     * 8. 실시간 프레임 캡처 루프
     */
    startCapturingFrames() {
        this.isRecording = true;
        this.capturedFrames = [];
        this.recordStartTime = Date.now();

        // UI 녹화 중 상태로 변경
        this.btnStartRecord.classList.add('recording');
        this.btnStartRecord.innerHTML = '<i data-lucide="square"></i><span data-i18n="record.btn_stop">녹화 중지</span>';
        this.timerDisplay.classList.add('active');
        if (window.lucide) window.lucide.createIcons();

        const fps = parseInt(this.selectFps.value, 10) || 10;
        const frameInterval = 1000 / fps;
        const maxDurationSec = parseInt(this.inputMaxDuration.value, 10) || 10;

        // 프레임 캡처용 오프스크린 캔버스 준비
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');

        // 출력 리사이징 크기 계산 (긴 변 기준)
        const cropW = this.crop.width;
        const cropH = this.crop.height;
        const outputPreset = this.selectOutputSize.value;

        let outW = cropW;
        let outH = cropH;

        if (outputPreset !== 'original') {
            const maxDimension = parseInt(outputPreset, 10) || 640;
            if (cropW >= cropH) {
                outW = Math.min(cropW, maxDimension);
                outH = Math.round((outW / cropW) * cropH);
            } else {
                outH = Math.min(cropH, maxDimension);
                outW = Math.round((outH / cropH) * cropW);
            }
        }

        offCanvas.width = outW;
        offCanvas.height = outH;

        // 프레임 수집 타이머
        this.captureIntervalId = setInterval(() => {
            if (!this.isRecording) return;

            const elapsedSec = (Date.now() - this.recordStartTime) / 1000;

            // 타이머 디스플레이 업데이트 (00:00)
            const minutes = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
            const seconds = String(Math.floor(elapsedSec % 60)).padStart(2, '0');
            this.timerDisplay.textContent = `${minutes}:${seconds}`;

            // 오프스크린 캔버스에 크롭된 영역 + 워터마크 그리기
            offCtx.clearRect(0, 0, outW, outH);
            offCtx.drawImage(
                this.videoElement,
                this.crop.x, this.crop.y, cropW, cropH,
                0, 0, outW, outH
            );

            // 워터마크 추가 합성
            this.renderWatermarkOnCanvas(offCtx, 0, 0, outW, outH);

            // 프레임 이미지 데이터(Base64) 저장
            this.capturedFrames.push(offCanvas.toDataURL('image/jpeg', 0.85));

            // 최대 녹화 시간 도달 시 자동 종료
            if (elapsedSec >= maxDurationSec) {
                this.finishRecording();
            }
        }, frameInterval);
    }

    /**
     * 9. 녹화 종료 및 GIF 인코딩 개시
     */
    finishRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        clearInterval(this.captureIntervalId);

        // UI 원복
        this.btnStartRecord.classList.remove('recording');
        this.btnStartRecord.innerHTML = '<i data-lucide="video"></i><span data-i18n="record.btn_start">녹화 시작</span>';
        this.timerDisplay.classList.remove('active');
        if (window.lucide) window.lucide.createIcons();

        if (this.capturedFrames.length === 0) {
            alert('녹화된 프레임이 없습니다.');
            return;
        }

        // GIF 인코딩 실행
        this.encodeGifFromFrames();
    }

    /**
     * 10. gifshot 라이브러리를 활용한 브라우저 로컬 고속 GIF 인코딩
     */
    encodeGifFromFrames() {
        this.encodingOverlay.style.display = 'flex';
        this.encodingProgressBar.style.width = '10%';
        this.encodingStatusText.textContent = `프레임 분석 중 (${this.capturedFrames.length} 프레임)...`;

        const fps = parseInt(this.selectFps.value, 10) || 10;
        const intervalSec = 1 / fps;

        // gifshot 설정
        if (typeof gifshot === 'undefined') {
            alert('GIF 인코딩 엔진(gifshot)을 로드하지 못했습니다. 페이지를 새로고침 해주세요.');
            this.encodingOverlay.style.display = 'none';
            return;
        }

        // 첫 프레임 기준 이미지 크기 획득
        const sampleImg = new Image();
        sampleImg.onload = () => {
            const gifW = sampleImg.width;
            const gifH = sampleImg.height;

            this.encodingProgressBar.style.width = '35%';
            this.encodingStatusText.textContent = '고화질 GIF 인코딩 중...';

            gifshot.createGIF({
                images: this.capturedFrames,
                gifWidth: gifW,
                gifHeight: gifH,
                interval: intervalSec,
                numWorkers: 4,
                sampleInterval: 10,
                progressCallback: (captureProgress) => {
                    const percent = Math.round(35 + (captureProgress * 60));
                    this.encodingProgressBar.style.width = `${percent}%`;
                }
            }, (obj) => {
                this.encodingOverlay.style.display = 'none';

                if (!obj.error) {
                    const gifBase64 = obj.image;
                    this.showResultModal(gifBase64, gifW, gifH);
                } else {
                    alert(`GIF 생성 중 오류가 발생했습니다: ${obj.error}`);
                }
            });
        };
        sampleImg.src = this.capturedFrames[0];
    }

    /**
     * 11. 완성된 GIF 결과 팝업 표시
     */
    showResultModal(gifBase64, width, height) {
        this.resultGifImg.src = gifBase64;
        this.resultResolution.textContent = `${width} × ${height} px`;

        const duration = ((this.capturedFrames.length) / (parseInt(this.selectFps.value, 10) || 10)).toFixed(1);
        this.resultDuration.textContent = `${duration} 초 (${this.capturedFrames.length} 프레임)`;

        // Base64 대략적인 파일 크기 계산
        const sizeInBytes = Math.round((gifBase64.length * 3) / 4);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
        this.resultFileSize.textContent = sizeInMB > 0.1 ? `${sizeInMB} MB` : `${Math.round(sizeInBytes / 1024)} KB`;

        // 다운로드 버튼 액션 바인딩
        this.btnDownloadGif.onclick = () => {
            const rawFilename = this.inputFilename.value.trim() || '방장_화면녹화';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            const finalFilename = `${rawFilename}_${timestamp}.gif`;

            const link = document.createElement('a');
            link.href = gifBase64;
            link.download = finalFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        this.resultModal.style.display = 'flex';
        this.resultModal.classList.add('active');
    }
}

// DOM 로드 완료 시 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    window.screenRecordTool = new ScreenRecordToGifTool();
});

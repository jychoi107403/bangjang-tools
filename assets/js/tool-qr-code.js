/**
 * ============================================================================
 * assets/js/tool-qr-code.js - [QR 코드 생성] 전용 독립 ES 모듈
 * ============================================================================
 * [주요 기능]
 * 1. 실시간 텍스트/URL 기반 고화질 QR 코드 렌더링 (qr-code-styling 라이브러리)
 * 2. 커스텀 색상(컬러 피커 연동), 점 스타일(사각형/원형/둥근 사각형/클래시) 변경
 * 3. 모서리 표시(Eye 모양: 사각형/둥근 사각형/원형) 실시간 커스터마이징
 * 4. 고해상도(512px / 1,024px / 2,048px) 및 다중 포맷(PNG / JPG / SVG 벡터) 다운로드
 * 5. EXIF 메타데이터 제거 및 100% 브라우저 로컬 연산 (서버 전송 0%)
 */

import { downloadBlob } from './utils.js';

// ----------------------------------------------------------------------------
// 1. 모듈 내부 격리 상태 변수
// ----------------------------------------------------------------------------
let qrCodeInstance = null;
let currentText = 'https://tools.bangjang.net';
let currentColor = '#000000';
let currentDotStyle = 'square';
let currentCornerStyle = 'square';
let currentSaveFormat = 'png';
let currentSaveSize = 1024;

// DOM 요소 캐싱 변수
let previewContainer = null;
let inputText = null;
let inputColor = null;
let colorChip = null;
let colorLabel = null;
let selectDotStyle = null;
let selectCornerStyle = null;
let selectSaveFormat = null;
let selectSaveSize = null;
let btnSave = null;

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
    previewContainer = document.getElementById('qr-preview-container');
    inputText = document.getElementById('input-qr-text');
    inputColor = document.getElementById('input-qr-color');
    colorChip = document.getElementById('qr-color-preview-chip');
    colorLabel = document.getElementById('qr-color-text-label');
    selectDotStyle = document.getElementById('select-dot-style');
    selectCornerStyle = document.getElementById('select-corner-style');
    selectSaveFormat = document.getElementById('select-save-format');
    selectSaveSize = document.getElementById('select-save-size');
    btnSave = document.getElementById('btn-save-qr');

    // QR 코드 인스턴스 초기화
    initQRCode();

    // UI 이벤트 바인딩
    bindEvents();
}

/**
 * QR Code Styling 인스턴스 생성 및 렌더링
 */
function initQRCode() {
    if (!previewContainer) return;

    if (window.QRCodeStyling) {
        qrCodeInstance = new window.QRCodeStyling({
            width: 280,
            height: 280,
            type: 'canvas',
            data: currentText,
            margin: 0,
            qrOptions: {
                typeNumber: 0,
                mode: 'Byte',
                errorCorrectionLevel: 'Q' // 높은 오류 복원력
            },
            imageOptions: {
                hideBackgroundDots: true,
                imageSize: 0.4,
                margin: 4
            },
            dotsOptions: {
                color: currentColor,
                type: currentDotStyle // 'square' | 'dots' | 'rounded' | 'classy'
            },
            backgroundOptions: {
                color: '#ffffff'
            },
            cornersSquareOptions: {
                color: currentColor,
                type: currentCornerStyle // 'square' | 'dot' | 'extra-rounded'
            },
            cornersDotOptions: {
                color: currentColor,
                type: currentCornerStyle === 'extra-rounded' ? 'dot' : (currentCornerStyle === 'dot' ? 'dot' : 'square')
            }
        });

        previewContainer.innerHTML = '';
        qrCodeInstance.append(previewContainer);
    } else {
        // 라이브러리 로드 지연 시 재시도
        setTimeout(initQRCode, 100);
    }
}

/**
 * ============================================================================
 * 3. 이벤트 바인딩
 * ============================================================================
 */
function bindEvents() {
    // 1. URL / 텍스트 입력 실시간 반응
    if (inputText) {
        inputText.addEventListener('input', (e) => {
            currentText = e.target.value.trim() || 'https://tools.bangjang.net';
            updateQRCode();
        });
    }

    // 2. 색상 선택 피커
    if (inputColor) {
        inputColor.addEventListener('input', (e) => {
            currentColor = e.target.value;
            if (colorChip) colorChip.style.backgroundColor = currentColor;
            if (colorLabel) colorLabel.textContent = currentColor.toUpperCase();
            updateQRCode();
        });
    }

    // 3. 점 스타일 변경
    if (selectDotStyle) {
        selectDotStyle.addEventListener('change', (e) => {
            currentDotStyle = e.target.value;
            updateQRCode();
        });
    }

    // 4. 모서리 표시 변경
    if (selectCornerStyle) {
        selectCornerStyle.addEventListener('change', (e) => {
            currentCornerStyle = e.target.value;
            updateQRCode();
        });
    }

    // 5. 저장 형식 변경
    if (selectSaveFormat) {
        selectSaveFormat.addEventListener('change', (e) => {
            currentSaveFormat = e.target.value;
        });
    }

    // 6. 저장 크기 변경
    if (selectSaveSize) {
        selectSaveSize.addEventListener('change', (e) => {
            currentSaveSize = parseInt(e.target.value, 10) || 1024;
        });
    }

    // 7. 하단 저장 버튼 클릭
    if (btnSave) {
        btnSave.addEventListener('click', handleDownload);
    }
}

/**
 * 실시간 옵션 변경 시 미리보기 QR 코드 업데이트
 */
function updateQRCode() {
    if (!qrCodeInstance) return;

    let cornersDotType = 'square';
    if (currentCornerStyle === 'dot' || currentCornerStyle === 'extra-rounded') {
        cornersDotType = 'dot';
    }

    qrCodeInstance.update({
        data: currentText,
        dotsOptions: {
            color: currentColor,
            type: currentDotStyle
        },
        cornersSquareOptions: {
            color: currentColor,
            type: currentCornerStyle
        },
        cornersDotOptions: {
            color: currentColor,
            type: cornersDotType
        }
    });
}

/**
 * ============================================================================
 * 4. 고해상도 QR 코드 다운로드 처리 (PNG / JPG / SVG)
 * ============================================================================
 */
async function handleDownload() {
    if (!window.QRCodeStyling) {
        alert('QR 코드 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    const originalBtnHtml = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.innerHTML = `<i data-lucide="loader-2" class="spin-icon"></i> <span>QR 코드 생성 중...</span>`;
    if (window.lucide) window.lucide.createIcons();

    try {
        let cornersDotType = 'square';
        if (currentCornerStyle === 'dot' || currentCornerStyle === 'extra-rounded') {
            cornersDotType = 'dot';
        }

        const size = currentSaveSize || 1024;
        const format = currentSaveFormat || 'png';

        // 지정한 고해상도 크기로 내보내기용 별도 인스턴스 생성
        const exportQr = new window.QRCodeStyling({
            width: size,
            height: size,
            type: format === 'svg' ? 'svg' : 'canvas',
            data: currentText,
            margin: Math.round(size * 0.04), // 4% 여백
            qrOptions: {
                typeNumber: 0,
                mode: 'Byte',
                errorCorrectionLevel: 'Q'
            },
            dotsOptions: {
                color: currentColor,
                type: currentDotStyle
            },
            backgroundOptions: {
                color: '#ffffff'
            },
            cornersSquareOptions: {
                color: currentColor,
                type: currentCornerStyle
            },
            cornersDotOptions: {
                color: currentColor,
                type: cornersDotType
            }
        });

        const filename = `QR코드_${size}px`;

        // qr-code-styling의 download 메서드 호출
        await exportQr.download({
            name: filename,
            extension: format
        });

    } catch (err) {
        console.error('QR 코드 다운로드 오류:', err);
        alert('QR 코드 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalBtnHtml;
        if (window.lucide) window.lucide.createIcons();
    }
}

// ----------------------------------------------------------------------------
// 5. 브라우저 로드 시 자동 실행
// ----------------------------------------------------------------------------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

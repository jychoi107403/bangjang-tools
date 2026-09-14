/**
 * ============================================================================
 * assets/js/utils.js - DOM에 종속되지 않는 순수 헬퍼 유틸리티 모듈
 * ============================================================================
 * [설계 원칙]
 * 1. UI 및 DOM을 직접 조작(document.getElementById 등)하지 않습니다.
 * 2. 오직 입력받은 데이터(Blob, File, Canvas 등)를 처리하여 결과만 반환하는 순수 함수로 구성합니다.
 * 3. 각 도구 모듈에서 필요한 함수만 명시적으로 import하여 사용합니다.
 */

/**
 * 브라우저 메모리에 있는 Blob 데이터를 파일로 다운로드합니다.
 * @param {Blob} blob - 다운로드할 바이너리 Blob 객체
 * @param {string} filename - 저장될 파일명 (확장자 포함)
 */
export function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 메모리 누수 방지를 위한 Object URL 해제
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 2000);
}

/**
 * Canvas 객체를 지정된 이미지 포맷과 화질의 Blob으로 변환합니다. (Promise 지원)
 * *주의*: 브라우저 캔버스를 통해 Blob을 생성하므로 EXIF 메타데이터(GPS 위치, 카메라 기종 등)가 자동으로 제거됩니다.
 * @param {HTMLCanvasElement} canvas - 변환할 캔버스 요소
 * @param {string} mimeType - MIME 타입 (예: 'image/png', 'image/jpeg', 'image/webp')
 * @param {number} quality - 품질 (0.0 ~ 1.0, JPEG/WebP에 적용)
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, mimeType = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
        if (!canvas) {
            reject(new Error('유효한 Canvas 요소가 전달되지 않았습니다.'));
            return;
        }
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas의 Blob 변환에 실패하였습니다.'));
            }
        }, mimeType, quality);
    });
}

/**
 * File 객체를 비동기로 읽어 Base64 Data URL 문자열로 반환합니다.
 * @param {File|Blob} file - 읽을 파일 객체
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('파일이 지정되지 않았습니다.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * 이미지 소스(Data URL 또는 URL)를 비동기로 로드하여 HTMLImageElement 객체를 반환합니다.
 * @param {string} src - 이미지 소스 경로
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
}

/**
 * 바이트 크기를 사람이 읽기 쉬운 포맷(B, KB, MB, GB)으로 변환합니다.
 * @param {number} bytes - 파일 크기(바이트)
 * @returns {string} 예: "522.7 KB", "141.8 KB", "433 B"
 */
export function formatBytes(bytes) {
    // 유효하지 않은 값, NaN, null, undefined, 0에 대한 안전한 방어 처리
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
        return '0 B';
    }
    
    // 1024 미만인 경우 바이트(B) 단위로 깔끔하게 표시
    if (bytes < 1024) {
        return `${Math.round(bytes)} B`;
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${formatted} ${sizes[i]}`;
}

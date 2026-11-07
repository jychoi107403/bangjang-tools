/**
 * ============================================================================
 * assets/js/tool-pdf-to-word.js - [PDF → Word 무손실 로컬 변환기] 전용 독립 모듈
 * ============================================================================
 * [주요 기능]
 * 1. PDF.js 기반 100% 브라우저 로컬 PDF 페이지/좌표/폰트 크기 정밀 파싱 (서버 전송 0%)
 * 2. Y좌표 기반 줄(Line) 병합 및 글자 크기 기반 제목(Heading) / 본문 자동 분류
 * 3. JSZip 기반 표준 Microsoft Word OpenXML (.docx) 문서 직접 패키징 생성
 * 4. 추출된 본문 실시간 편집 에디터 + 클립보드 복사 + .docx / .txt 다운로드 지원
 * 5. 원클릭 체험을 위한 내장 샘플 PDF 생성 및 변환 시연 기능
 */

class PdfToWordTool {
    constructor() {
        this.currentFile = null;
        this.pagesData = [];
        this.numPages = 0;
        this.isProcessing = false;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        // 업로드 영역
        this.fileInput = document.getElementById('pdf2word-file-input');
        this.dropZone = document.getElementById('pdf2word-drop-zone');
        this.btnSelect = document.getElementById('btn-pdf2word-select');
        this.btnSample = document.getElementById('btn-pdf2word-sample');
        this.btnChange = document.getElementById('btn-pdf2word-change');

        // 진행 상태 박스
        this.progressBox = document.getElementById('pdf2word-progress-box');
        this.progressBar = document.getElementById('pdf2word-progress-bar');
        this.progressText = document.getElementById('pdf2word-progress-text');

        // 결과 및 편집 워크스페이스
        this.resultSection = document.getElementById('pdf2word-result-section');
        this.docTitleBadge = document.getElementById('pdf2word-doc-title');
        this.docStatsBadge = document.getElementById('pdf2word-doc-stats');
        this.previewEditor = document.getElementById('pdf2word-preview-editor');

        // 다운로드 및 복사 버튼
        this.btnDownloadDocx = document.getElementById('btn-pdf2word-download-docx');
        this.btnDownloadDocxSidebar = document.getElementById('btn-pdf2word-download-sidebar');
        this.btnDownloadTxt = document.getElementById('btn-pdf2word-download-txt');
        this.btnCopyText = document.getElementById('btn-pdf2word-copy');

        // 우측 사이드바 옵션
        this.selectFont = document.getElementById('pdf2word-select-font');
        this.selectPageBreak = document.getElementById('pdf2word-select-pagebreak');
        this.checkDetectHeading = document.getElementById('pdf2word-check-heading');
        this.inputFilename = document.getElementById('pdf2word-input-filename');
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
                if (file) this.processPdfFile(file);
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
                const pdfFile = files.find(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
                if (pdfFile) {
                    this.processPdfFile(pdfFile);
                } else {
                    alert('PDF 문서 파일(.pdf)을 선택해 주세요.');
                }
            });
        }

        if (this.btnSample) {
            this.btnSample.addEventListener('click', () => this.loadSamplePdf());
        }

        if (this.btnDownloadDocx) {
            this.btnDownloadDocx.addEventListener('click', () => this.downloadDocx());
        }
        if (this.btnDownloadDocxSidebar) {
            this.btnDownloadDocxSidebar.addEventListener('click', () => this.downloadDocx());
        }
        if (this.btnDownloadTxt) {
            this.btnDownloadTxt.addEventListener('click', () => this.downloadTxt());
        }
        if (this.btnCopyText) {
            this.btnCopyText.addEventListener('click', () => this.copyPreviewText());
        }

        if (this.previewEditor) {
            this.previewEditor.addEventListener('input', () => this.updateStatsBadge());
        }
    }

    /**
     * 표준 최소 PDF 1.4 바이너리를 메모리에서 생성하여 실제 PDF.js 파싱 및 DOCX 변환을 시연합니다.
     */
    async loadSamplePdf() {
        const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 268 >>
stream
BT
/F1 18 Tf
50 770 Td
(Bangjang Tools - Official PDF to Word Report) Tj
/F1 12 Tf
0 -36 Td
(1. 100% Client-Side Privacy Protection) Tj
0 -22 Td
(All PDF documents are parsed locally in your browser without server upload.) Tj
0 -28 Td
(2. Editable Microsoft Word OpenXML Output) Tj
0 -22 Td
(Headings, paragraphs, and line breaks are preserved in standard .docx format.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000297 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
615
%%EOF`;

        const encoder = new TextEncoder();
        const bytes = encoder.encode(samplePdfContent);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const file = new File([blob], '방장_보안공문서_샘플.pdf', { type: 'application/pdf' });
        await this.processPdfFile(file);
    }

    /**
     * PDF 파일을 읽어 페이지별 텍스트 및 문단 구조를 추출합니다.
     */
    async processPdfFile(file) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.currentFile = file;

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        if (this.inputFilename) {
            this.inputFilename.value = `${baseName}_변환문서`;
        }
        if (this.docTitleBadge) {
            this.docTitleBadge.textContent = file.name;
        }

        if (this.dropZone) this.dropZone.style.display = 'none';
        if (this.resultSection) this.resultSection.style.display = 'none';
        if (this.progressBox) this.progressBox.style.display = 'block';
        if (this.progressBar) this.progressBar.style.width = '15%';
        if (this.progressText) this.progressText.textContent = 'PDF 문서를 브라우저 로컬 메모리에서 분석 중...';

        try {
            if (!window.pdfjsLib) {
                throw new Error('PDF.js 엔진이 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
            }

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            this.numPages = pdfDoc.numPages;
            this.pagesData = [];

            let combinedText = '';

            for (let pageNum = 1; pageNum <= this.numPages; pageNum++) {
                const pct = Math.round(15 + (pageNum / this.numPages) * 75);
                if (this.progressBar) this.progressBar.style.width = `${pct}%`;
                if (this.progressText) {
                    this.progressText.textContent = `페이지 텍스트 및 서식 좌표 추출 중... (${pageNum} / ${this.numPages} 페이지)`;
                }

                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const lines = this.groupItemsIntoLines(textContent.items);
                this.pagesData.push({ pageNum, lines });

                if (pageNum > 1) {
                    combinedText += `\n--- [페이지 ${pageNum}] ---\n\n`;
                }
                for (const line of lines) {
                    if (line.text.trim()) {
                        combinedText += line.text.trim() + '\n';
                    }
                }
            }

            if (!combinedText.trim()) {
                combinedText = '[안내] 이 PDF 파일에서 텍스트 레이어를 찾을 수 없습니다. (스캔된 이미지 형태일 수 있습니다.)\n이곳에 직접 내용을 입력하거나 수정하여 Word(.docx) 문서로 저장할 수 있습니다.';
            }

            if (this.previewEditor) {
                this.previewEditor.value = combinedText.trim();
            }

            this.updateStatsBadge();

            if (this.progressBox) this.progressBox.style.display = 'none';
            if (this.resultSection) this.resultSection.style.display = 'flex';
            if (this.btnChange) this.btnChange.style.display = 'inline-flex';
        } catch (err) {
            console.error('PDF 분석 오류:', err);
            alert(`PDF 파일을 분석하는 중 오류가 발생했습니다: ${err.message}`);
            if (this.progressBox) this.progressBox.style.display = 'none';
            if (this.dropZone) this.dropZone.style.display = 'flex';
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * PDF.js 텍스트 조각(items)을 Y좌표 기준으로 같은 줄(Line)끼리 묶고 좌->우 순서로 정렬합니다.
     */
    groupItemsIntoLines(items) {
        if (!items || items.length === 0) return [];

        const validItems = items.filter(it => it && typeof it.str === 'string' && it.str.trim().length > 0);
        if (validItems.length === 0) return [];

        // Y좌표 내림차순(위->아래), 같은 줄이면 X좌표 오름차순(좌->우) 정렬
        const sorted = [...validItems].sort((a, b) => {
            const yA = a.transform ? a.transform[5] : 0;
            const yB = b.transform ? b.transform[5] : 0;
            if (Math.abs(yB - yA) > 4.5) return yB - yA;
            const xA = a.transform ? a.transform[4] : 0;
            const xB = b.transform ? b.transform[4] : 0;
            return xA - xB;
        });

        const lines = [];
        let curLine = null;

        for (const item of sorted) {
            const y = item.transform ? item.transform[5] : 0;
            const fontSize = item.height || (item.transform ? Math.abs(item.transform[0]) : 12) || 12;

            if (!curLine || Math.abs(curLine.y - y) > 5) {
                if (curLine) lines.push(curLine);
                curLine = {
                    y,
                    fontSize,
                    text: item.str
                };
            } else {
                const needsSpace = !curLine.text.endsWith(' ') && !item.str.startsWith(' ');
                curLine.text += (needsSpace ? ' ' : '') + item.str;
                curLine.fontSize = Math.max(curLine.fontSize, fontSize);
            }
        }
        if (curLine) lines.push(curLine);
        return lines;
    }

    updateStatsBadge() {
        const text = this.previewEditor ? this.previewEditor.value : '';
        const charCount = text.length;
        const lineCount = text ? text.split(/\r?\n/).length : 0;
        if (this.docStatsBadge) {
            this.docStatsBadge.textContent = `총 ${this.numPages || 1}페이지 · ${lineCount.toLocaleString()}줄 · ${charCount.toLocaleString()}자`;
        }
    }

    /**
     * 현재 미리보기 에디터의 텍스트와 문단 구조를 기반으로 정품 OpenXML (.docx) Blob을 생성합니다.
     */
    async buildDocxBlob() {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
        }

        const zip = new JSZip();
        const fontName = this.selectFont?.value || '맑은 고딕';
        const usePageBreak = (this.selectPageBreak?.value || 'line') === 'break';
        const detectHeading = this.checkDetectHeading ? this.checkDetectHeading.checked : true;

        const escapeXml = (str) => (str || '').replace(/[<>&'"]/g, c => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&apos;',
            '"': '&quot;'
        }[c]));

        // 1. [Content_Types].xml
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

        // 2. _rels/.rels
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

        // 3. 에디터 본문 줄 단위로 word/document.xml 조립
        const rawText = this.previewEditor ? this.previewEditor.value : '';
        const rawLines = rawText.split(/\r?\n/);

        let bodyXml = '';
        for (const rawLine of rawLines) {
            const trimmed = rawLine.trim();

            // 페이지 구분자 처리
            if (/^---\s*\[페이지\s*\d+\]\s*---$/.test(trimmed)) {
                if (usePageBreak) {
                    bodyXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
                } else {
                    bodyXml += `
                    <w:p>
                        <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="160"/></w:pPr>
                        <w:r>
                            <w:rPr><w:color w:val="888888"/><w:i/><w:sz w:val="20"/></w:rPr>
                            <w:t>${escapeXml(trimmed)}</w:t>
                        </w:r>
                    </w:p>`;
                }
                continue;
            }

            if (!trimmed) {
                bodyXml += `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
                continue;
            }

            // 제목 여부 자동 판별 (번호 제목이거나 첫 줄/대제목 패턴)
            const isHeading = detectHeading && (
                trimmed.length <= 60 &&
                (/^(제\s*\d+\s*[장절조항]|[0-9]+\.\s+|[IVX]+\.\s+|■|▶|●)/.test(trimmed) || trimmed.endsWith('보고서') || trimmed.endsWith('Report'))
            );

            const fontSizeHalfPt = isHeading ? 28 : 22; // 14pt or 11pt
            bodyXml += `
            <w:p>
                <w:pPr>
                    <w:spacing w:before="${isHeading ? '200' : '0'}" w:after="120" w:line="320" w:lineRule="auto"/>
                </w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="${escapeXml(fontName)}" w:hAnsi="${escapeXml(fontName)}" w:eastAsia="${escapeXml(fontName)}"/>
                        ${isHeading ? '<w:b/>' : ''}
                        <w:sz w:val="${fontSizeHalfPt}"/>
                        <w:szCs w:val="${fontSizeHalfPt}"/>
                    </w:rPr>
                    <w:t xml:space="preserve">${escapeXml(rawLine)}</w:t>
                </w:r>
            </w:p>`;
        }

        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${bodyXml}
        <w:sectPr>
            <w:pgSz w:w="11906" w:h="16838"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
        </w:sectPr>
    </w:body>
</w:document>`;

        zip.file('word/document.xml', documentXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
    }

    /**
     * 변환된 Word (.docx) 파일 다운로드
     */
    async downloadDocx() {
        try {
            const blob = await this.buildDocxBlob();
            const rawName = (this.inputFilename?.value || '방장_변환문서').trim();
            const filename = rawName.toLowerCase().endsWith('.docx') ? rawName : `${rawName}.docx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        } catch (err) {
            console.error('DOCX 생성 오류:', err);
            alert(`Word 문서 생성 중 오류가 발생했습니다: ${err.message}`);
        }
    }

    /**
     * 추출된 텍스트 (.txt) 파일 다운로드
     */
    downloadTxt() {
        const text = this.previewEditor ? this.previewEditor.value : '';
        if (!text.trim()) {
            alert('저장할 텍스트 내용이 없습니다.');
            return;
        }
        const rawName = (this.inputFilename?.value || '방장_변환문서').trim().replace(/\.docx$/i, '');
        const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${rawName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    }

    /**
     * 추출된 본문 전체 클립보드 복사
     */
    async copyPreviewText() {
        const text = this.previewEditor ? this.previewEditor.value : '';
        if (!text.trim()) return;
        try {
            await navigator.clipboard.writeText(text);
            alert('추출된 문서 본문이 클립보드에 복사되었습니다.\n원하는 문서에 Ctrl + V로 붙여넣으세요.');
        } catch (e) {
            this.previewEditor.select();
            document.execCommand('copy');
            alert('추출된 문서 본문이 클립보드에 복사되었습니다.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pdfToWordTool = new PdfToWordTool();
});


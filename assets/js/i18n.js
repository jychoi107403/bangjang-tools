/**
 * ====================================================================
 * i18n.js - 방장 용용이 글로벌 다국어(한국어 ↔ English) 번역 엔진
 * ====================================================================
 * - 접속자의 브라우저 언어를 자동 감지하여 영문권 사용자에게 영어 UI 제공
 * - 상단 GNB 언어 전환 버튼(KO/EN)을 통해 실시간으로 언어 변경 및 LocalStorage 저장
 * - data-i18n, data-i18n-placeholder, data-i18n-title 속성을 자동으로 번역
 */

const I18N_DICTIONARY = {
    ko: {
        // 브랜드 및 공통
        "brand.title": "방장 용용이",
        "brand.subtitle": "무료 실무 도구",
        "nav.all_tools": "모든 도구",
        "nav.home_tooltip": "모든 도구 모음으로",
        "nav.image_tools": "이미지 도구",
        "nav.video_tools": "영상 도구",
        "nav.blog_tools": "블로그 도구",
        "nav.site_tools": "웹사이트 분석",
        "nav.image_tools_badge": "7개 도구",
        "nav.video_tools_badge": "3개 도구",
        "nav.blog_tools_badge": "2개 도구",
        "nav.site_tools_badge": "1개 도구",
        
        // 도구 목록
        "tool.image_compress": "이미지 용량 줄이기",
        "tool.image_edit": "이미지 편집",
        "tool.image_split": "사진 분할",
        "tool.remove_bg": "배경 제거·바꾸기",
        "tool.mosaic": "사진 모자이크",
        "tool.qr_code": "QR 코드 생성",
        "tool.batch_rename": "파일명 일괄 변경",
        "tool.video_trim_gif": "영상 구간 → GIF",
        "tool.video_to_gif": "영상 → GIF",
        "tool.screen_record_gif": "화면녹화 → GIF",
        "tool.blog_formatter": "블로그 본문 정리",
        "tool.pdf_to_word": "PDF → Word",
        "tool.site_audit": "웹사이트 이미지 진단",

        // 공통 버튼 및 라벨
        "btn.help": "도움말",
        "btn.confirm": "확인",
        "btn.close": "닫기",
        "btn.download": "다운로드",
        "btn.reset": "초기화",
        "btn.apply": "적용하기",
        "btn.save": "저장하기",
        "btn.copy": "복사",
        "btn.copied": "복사 완료!",
        "label.sponsor": "스폰서 광고",
        "label.security_notice": "내 파일은 내 기기에서 (100% 로컬 처리)",
        "label.security_desc": "선택한 파일은 외부 서버에 업로드되지 않고 브라우저에서 안전하게 처리됩니다.",
        "footer.terms": "이용약관",
        "footer.privacy": "개인정보처리방침",
        "footer.contact": "문의 및 제휴",
        
        // 메인 대시보드
        "home.hero_title": "복잡한 작업도 3초 만에, 무료 실무 도구 모음",
        "home.hero_desc": "서버 업로드 없는 100% 브라우저 로컬 처리로 소중한 개인정보와 업무 파일을 안전하게 보호합니다.",
        "home.stat_free": "100% 무료",
        "home.stat_client": "100% 로컬 실행",
        "home.stat_limit": "무제한 사용",
        "home.cat_image_title": "이미지 도구",
        "home.cat_image_desc": "용량 압축, 자르기, 필터, 배경 제거, 모자이크, 분할, QR코드 및 파일명 변경",
        "home.cat_video_title": "영상 도구",
        "home.cat_video_desc": "영상 구간 자르기, 비디오/화면녹화 즉시 GIF 변환",
        "home.cat_blog_title": "블로그 & 문서 도구",
        "home.cat_blog_desc": "블로그 폰트/줄바꿈 정리 및 PDF 문서 변환",

        // 화면녹화 → GIF 도구 전용
        "record.meta_notice": "저장하는 JPG·PNG·GIF의 촬영·위치·작성자 등 부가 메타정보를 제거합니다. 이미지 표시·애니메이션에 필요한 정보는 유지합니다.",
        "record.step_title": "1. 화면 공유 → 2. 영역·워터마크 조정 → 3. 녹화",
        "record.step_desc": "공유를 허용한 뒤 미리보기 안에서 원하는 부분만 드래그해 선택하세요.",
        "record.btn_share": "공유 화면 선택",
        "record.btn_stop_share": "공유 끝내기",
        "record.btn_start": "녹화 시작",
        "record.btn_stop": "녹화 중지",
        "record.empty_title": "녹화할 부분만 골라 담으세요",
        "record.empty_desc": "먼저 [공유 화면 선택]을 눌러 화면·창·탭을 선택하세요. 영역과 워터마크를 확인한 뒤 녹화를 시작합니다.",
        "record.empty_footnote": "공유 허용은 브라우저에서 직접 해야 합니다. 다른 창이나 탭을 선택하면 녹화 화면에 이 미리보기가 반복해서 들어가는 것을 피할 수 있습니다.",
        "record.countdown_ready": "녹화 준비 중... 화면을 전환하세요",
        "record.encoding_title": "고화질 GIF 생성 중",
        "record.guide_title": "이렇게 사용하세요",
        "record.guide_step1_t": "공유 화면 선택",
        "record.guide_step1_d": "을 누르고 브라우저 창에서 화면·창·탭을 허용하세요.",
        "record.guide_step2": "미리보기에서 영역을 마우스로 드래그하고 로고 워터마크를 설정하세요.",
        "record.guide_step3_t": "녹화 시작",
        "record.guide_step3_d": "을 누르세요. 종료 후 현재 분량을 고화질 GIF로 인코딩하여 저장합니다.",
        "record.guide_footnote": "횟수 제한 없이 100% 무료로 사용할 수 있습니다. 긴 영상이나 고해상도 녹화는 기기 사양에 따라 인코딩 시간이 달라질 수 있습니다.",
        "record.crop_area": "녹화 영역",
        "record.quick_ratio": "빠른 비율 선택",
        "record.save_settings": "저장 설정",
        "record.filename": "파일명",
        "record.max_duration": "최대 녹화 시간 · 초",
        "record.output_dimension": "출력 긴 변",
        "record.max_fps": "최대 프레임 수",
        "record.countdown_sec": "시작 전 준비 시간",
        "record.watermark": "워터마크",
        "record.apply_watermark": "워터마크 적용",
        "record.wm_type": "종류",
        "record.wm_file": "워터마크 파일",
        "btn.browse": "찾기",
        "btn.delete_logo": "로고 삭제",
        "record.logo_width": "로고 너비 · 출력 px",
        "record.wm_position": "위치",
        "record.opacity": "불투명도 · %",
        "record.margin": "여백 · 출력 px",
        "record.wm_footnote": "소리는 포함되지 않습니다. GIF는 최대 30초까지 지원합니다. 실제 FPS는 기기 성능과 탭 상태에 따라 조절될 수 있습니다.",
        "record.result_title": "GIF 녹화 완성!",
        "btn.download_gif": "GIF 다운로드",
        "record.meta_resolution": "해상도:",
        "record.meta_duration": "녹화 시간:",
        "record.meta_filesize": "파일 크기:",

        // 블로그 본문 정리 도구 전용 (Blog Formatter)
        "blog.header_desc": "블로그 본문의 줄바꿈을 정리하고 중앙정렬로 미리 보세요. 원문을 유지하며 줄 너비를 조절하고 직접 입력한 해시태그를 모아 TXT로 저장하는 무료 도구입니다.",
        "blog.notice_title": "원문은 그대로, 읽기 좋은 줄바꿈만.",
        "blog.notice_desc": "본문과 키워드를 입력하면 정리 결과가 바로 보입니다. 입력 내용은 이 브라우저에서만 처리합니다.",
        "blog.content_label": "본문 원문",
        "blog.hashtag_label": "해시태그 키워드",
        "blog.hashtag_hint": "공백·쉼표·줄바꿈·#으로 구분하세요. 문자·숫자·밑줄만, 태그 하나당 최대 50자입니다.",
        "blog.smart_wrap": "짧은 줄 정리",
        "blog.line_width": "줄 너비",
        "blog.smart_wrap_footnote": "짧은 줄 정리를 끄면 직접 입력한 줄바꿈만 유지합니다. 긴 URL이나 한 어절은 중간에서 나누지 않습니다.",
        "blog.preview_title": "중앙정렬 미리보기",
        "blog.preview_meta": "기준 폭 560px · 창 크기와 무관",
        "blog.preview_desc": "줄 너비를 30~100%로 조절할 수 있습니다. 블로그에 붙여넣은 뒤 줄이 다시 꺾이면 너비를 더 줄여 보세요. 글꼴·글자 크기·편집 영역 폭에 따라 줄이 추가로 나뉠 수 있습니다.",
        "blog.empty_preview": "본문을 입력하면 정리 결과가 여기에 표시됩니다.",
        "btn.download_txt": "TXT 다운로드",
        "blog.status_empty": "본문을 입력해 주세요.",
        "blog.action_footnote": "TXT에는 글꼴·글자 크기·중앙정렬 서식이 저장되지 않습니다. 다른 블로그 편집기에 붙여넣은 뒤 본문을 선택하고 중앙정렬을 직접 적용해 주세요. 화면이 좁으면 미리보기를 가로로 스크롤할 수 있습니다.",
        "blog.guide_title": "이렇게 사용하세요",
        "blog.guide_step1": "1. 본문을 입력하거나 붙여넣고, 해시태그 키워드를 별도로 입력하세요.",
        "blog.guide_step2": "2. 짧은 줄 정리와 줄 너비를 조절한 뒤 중앙정렬 미리보기에서 결과를 확인하세요.",
        "blog.guide_step3": "3. TXT를 다운로드하거나 복사하세요. 다른 블로그 편집기의 중앙정렬은 직접 적용합니다.",
        "blog.guide_footnote": "원문은 입력란에 그대로 남습니다. 본문이 비어 있거나 키워드 오류가 있으면 다운로드할 수 없습니다.",
        "blog.faq_main_title": "블로그 원고의 줄바꿈과 해시태그를 정리하세요",
        "blog.faq_desc1": "작성한 본문을 붙여넣고 짧은 줄 정리와 미리보기 줄 너비를 조절합니다. 글을 새로 생성하지 않고 입력한 내용을 읽기 좋게 정리하는 도구입니다.",
        "blog.faq_desc2": "해시태그 키워드를 별도로 입력해 본문 아래에 모으고 UTF-8 TXT로 저장합니다. 원문은 입력란에 그대로 남아 결과와 비교할 수 있습니다.",
        "blog.faq_title": "자주 묻는 질문",
        "blog.faq_q1": "▼ 네이버 블로그에 바로 발행되나요?",
        "blog.faq_a1": "블로그 자동 발행이나 계정 연결 기능은 없습니다. 정리한 내용을 다운로드한 뒤 사용하는 블로그 편집기로 옮겨주세요.",
        "blog.faq_q2": "▼ TXT에도 중앙정렬이 저장되나요?",
        "blog.faq_a2": "TXT는 정렬 서식을 저장하지 않습니다. 이 도구에서 중앙정렬 미리보기를 확인한 뒤 실제 블로그 편집기에서 중앙정렬을 적용하세요.",
        "blog.target_platform": "타겟 블로그 플랫폼",

        // 웹사이트 이미지 진단
        "audit.hero_title": "웹사이트 성능 개선하기",
        "audit.hero_desc": "이미지 압축으로 얼마나 많은 용량을 절약할 수 있는지 진단해보세요",
        "audit.card_title": "웹사이트 이미지 용량 절감 효과 확인",
        "audit.card_desc": "페이지의 전체 링크를 붙여넣어 이미지를 압축했을 때 얼마나 절약할 수 있는지 확인하세요.",
        "audit.url_label": "웹사이트 URL",
        "audit.url_placeholder": "https://example.com/page",
        "audit.btn_analyze": "페이지 분석하기",
        "audit.btn_analyzing": "분석 중...",
        "audit.quick_test": "💡 빠른 테스트:",
        "audit.results_for": "웹페이지 최적화 진단 결과:",
        "audit.total_images": "발견된 이미지 총",
        "audit.savings": "용량 절감",
        "audit.btn_show_report": "상세 리포트 보기",
        "audit.btn_hide_report": "상세 리포트 접기",
        "audit.btn_reset": "결과 닫기",
        "audit.orig_size_label": "현재 이미지 총 용량",
        "audit.new_size_label": "WebP 압축 후 예상 용량",
        "audit.orig_speed_label": "현재 예상 로딩 시간",
        "audit.new_speed_label": "최적화 후 예상 로딩 시간",
        "audit.seconds": "초",
        "audit.col_images": "이미지",
        "audit.col_original": "현재 용량",
        "audit.col_optimized": "최적화 후",
        "audit.col_difference": "절감률",
        "audit.already_optimized": "Already optimized",
        "audit.recommend_webp": "WebP 변환 권장",

        // 추가된 Placeholders 및 Badges
        "placeholder.search": "필요한 도구 검색 (예: QR, 변환...)",
        "placeholder.batch_rename": "새 파일명 입력",
        "placeholder.blog_content": "블로그 본문을 입력하거나 붙여넣으세요.\n원문은 유지되고 줄바꿈만 정리됩니다.",
        "placeholder.blog_hashtag": "예: 블로그, 자동화 #키워드",
        "placeholder.wm_text": "표시할 텍스트 입력",
        "placeholder.width": "너비",
        "placeholder.height": "높이",
        "placeholder.mosaic_wm": "예: 방장 용용이 서명 등",
        "placeholder.mosaic_filename": "파일명 입력",
        "placeholder.qr_url": "https://tools.bangjang.net",
        "badge.hot": "추천",
        "badge.face_detect": "얼굴감지",
        "badge.ai": "AI",

        // 메인 페이지(index.html) 본문 번역
        "home.hero_badge": "100% 무료 · 무설치 · 서버 업로드 없음",
        "home.new_hero_title": "실무가 빨라지는 방장 용용이 도구함",
        "home.new_hero_desc": "사진 편집, 배경 제거, QR 코드 생성부터 파일명 일괄 변경까지 웹 브라우저에서 안전하고 빠르게 처리하세요.",
        "home.rec_title": "🔥 자주 쓰는 추천 도구 TOP 4",
        "home.rec_bg_desc": "1초 만에 깔끔한 누끼 따기",
        "home.rec_qr_desc": "로고 삽입 · 고화질 벡터 SVG",
        "home.rec_rename_desc": "Ctrl+V 캡처 순번 매기기 & ZIP",
        "home.rec_mosaic_desc": "AI 얼굴 인식 및 프라이버시 보호",
        "badge.ai_power": "AI 파워",
        "badge.unlimited": "무제한",
        "home.cat_video_blog": "영상 & 블로그 업무 도구",
        "home.cat_audit_perf": "웹사이트 분석 & 성능 진단",
        "nav.video_blog_tools_badge": "5개 도구",
        "nav.audit_tools_badge": "1개 도구",
        "badge.coming_soon": "오픈예정",
        "badge.ai_intelligence": "AI 인공지능",
        "badge.basic": "기본 도구",
        "badge.grid_split": "그리드 분할",
        "badge.new_rec": "NEW 추천",
        "brand.short": "방장",
        "legal.title": "법적 안내",
        "badge.fast": "초고속",
        "home.cat_image": "이미지 실무 도구",
        "home.cat_video": "영상 실무 도구",
        "home.cat_blog": "블로그 및 문서 도구",
        "home.btn_open": "도구 열기",
        "badge.highly_rec": "강력 추천",
        "badge.popular": "인기",
        "badge.work_rec": "업무 추천",
        "desc.image_compress": "캡처(Ctrl+V)와 사진을 초고속으로 압축하여 화질 저하 없이 용량을 최대 90% 절감하고 ZIP으로 저장합니다.",
        "desc.remove_bg": "인물, 상품 사진의 배경을 1초 만에 분리하고 투명 PNG 또는 원하는 배경으로 합성합니다.",
        "desc.qr_code": "URL/텍스트로 무제한 고정 QR을 생성하고 색상, 로고 삽입, SVG 무손실 벡터로 다운로드합니다.",
        "desc.batch_rename": "캡처와 사진들을 붙여넣어 일련번호와 규칙으로 이름을 일괄 변경하고 ZIP으로 즉시 저장합니다.",
        "desc.mosaic": "AI 자동 얼굴 인식 및 드래그 마스크로 얼굴이나 민감한 개인정보를 안전하게 가립니다.",
        "desc.image_edit": "캡처 이미지를 모아 회전, 자르기, 도형/주석 그리기, 세로 이어붙이기를 일괄 처리합니다.",
        "desc.image_split": "사진 한 장을 2·4·8·16조각 또는 커스텀 그리드로 나누어 개별/ZIP으로 저장합니다.",
        "desc.video_trim_gif": "동영상에서 원하는 시작/종료 구간을 타임라인으로 잘라 고화질 움짤(GIF)로 변환합니다.",
        "desc.video_to_gif": "MP4/WebM 동영상 전체를 블로그용 최적 용량과 해상도의 고품질 GIF로 일괄 변환합니다.",
        "desc.screen_record_gif": "프로그램 설치 없이 브라우저 창이나 전체 화면을 실시간 녹화하여 즉시 GIF로 저장합니다.",
        "desc.blog_formatter": "불필요한 태그와 빈 서식을 제거하고 줄바꿈 맞춤법, 글자수, 키워드 밀도를 정돈합니다.",
        "desc.pdf_to_word": "표, 서식, 이미지를 유지하며 편집 가능한 MS Word(DOCX) 파일로 안전하게 변환합니다.",
                "desc.site_audit": "웹페이지 URL을 입력하여 페이지 내 이미지들의 절감 가능 용량과 로딩 속도 향상 수치를 실시간 진단합니다.",
        
        // --- Image Compress Tool ---
        "compress.security_tag": "100% 로컬 스마트 압축 · 개인정보 보호",
        "compress.help_title": "사용 방법 안내",
        "compress.help_btn": "도움말",
        "compress.guide_main": "Win+Shift+S로 캡처 → Ctrl+V로 붙여넣기",
        "compress.guide_sub": "사진을 계속 추가하여 용량을 최대 90%까지 안전하게 줄이세요.",
        "compress.btn_paste": "붙여넣기",
        "compress.btn_add_file": "파일 추가",
        "compress.btn_clear_all": "전체 삭제",
        "compress.badge_init": "0 / 50장 · 한 장 30MB 이하",
        "compress.badge_limit": "장당 30MB 이하",
        "compress.summary_orig": "총 원본 용량",
        "compress.summary_comp": "압축 후 용량",
        "compress.summary_saving": "총 절감 효과",
        "compress.empty_title": "이미지를 여기에 드래그하거나 <strong>Ctrl + V</strong>로 붙여넣으세요.",
        "compress.empty_desc": "상단의 [붙여넣기] 또는 [파일 추가]도 사용할 수 있습니다.",
        "compress.compare_title": "실시간 화질 및 용량 비교 (선택한 이미지)",
        "compress.compare_orig": "원본",
        "compress.compare_result": "압축 결과",
        "compress.btn_download_zip": "압축 이미지 일괄 저장 (ZIP)",
        "compress.btn_copy": "선택 이미지 복사",
        "compress.help_sec_title": "이렇게 사용하세요",
        "compress.help_li_1": "<strong>Win+Shift+S</strong>로 캡처한 뒤 이 화면에서 <strong>Ctrl+V</strong>로 바로 붙여넣으세요. 파일 추가 및 드래그앤드롭도 지원합니다.",
        "compress.help_li_2": "우측 [압축 설정]에서 <strong>[스마트 권장 압축]</strong> 또는 원하는 <strong>품질/해상도/포맷</strong>을 지정하면 실시간으로 용량이 절감됩니다.",
        "compress.help_li_3": "[압축 이미지 일괄 저장]을 누르면 모든 사진이 압축된 <strong>ZIP 파일</strong>로 즉시 다운로드됩니다.",
        "compress.help_notice": "저장 시 개인정보 및 촬영 위치가 포함된 EXIF 메타데이터를 100% 자동 제거하여 안전하게 보호합니다.",
        "compress.set_header": "압축 설정",
        "compress.set_mode": "압축 모드",
        "compress.mode_smart": "스마트 압축 (원본 포맷 유지 · 최적화)",
        "compress.mode_custom": "사용자 지정 (품질/해상도 직접 조절)",
        "compress.mode_target": "목표 용량 맞춤 (장당 용량 제한)",
        "compress.set_format": "출력 포맷",
        "compress.fmt_orig": "원본 포맷 유지 (PNG는 PNG, JPG는 JPG)",
        "compress.fmt_webp": "WebP (차세대 초고효율 포맷 일괄 변환)",
        "compress.fmt_jpeg": "JPEG (표준 사진 형식 일괄 변환)",
        "compress.fmt_png": "PNG (투명도 유지 포맷 일괄 변환)",
        "compress.set_quality": "압축 품질",
        "compress.qual_min": "최대 압축 (10%)",
        "compress.qual_bal": "균형 (80%)",
        "compress.qual_max": "최고 화질 (100%)",
        "compress.set_resize": "최대 해상도 (비율 유지 리사이즈)",
        "compress.res_orig": "원본 해상도 유지 (가로, 세로)",
        "compress.res_fhd": "FHD (최대 1920px)",
        "compress.res_hd": "HD (최대 1280px · 웹 추천)",
        "compress.res_blog": "블로그/메일용 (최대 800px)",
        "compress.res_custom": "직접 너비 입력",
        "compress.set_width": "최대 너비 · px",
        "compress.set_target_size": "목표 파일 크기 (장당 최대)",
        "compress.unit_kb": "KB 이하",
        "compress.target_desc": "지정한 용량 이하가 되도록 품질을 자동으로 계산해 최적화합니다.",
        "compress.webp_tip": "💡 WebP 형식은 JPEG 대비 최대 35% 이상 용량을 추가로 절감하면서도 고화질을 유지합니다. 웹사이트 및 블로그 업로드에 가장 권장됩니다.",
        "compress.modal_title": "이미지 용량 줄이기 사용 가이드",
        "compress.m_add_title": "이미지 추가 또는 캡처 붙여넣기",
        "compress.m_add_desc": "Win+Shift+S(Mac: Cmd+Shift+4)로 캡처 후 Ctrl+V로 붙여넣거나, [파일 추가] 및 드래그앤드롭으로 이미지를 등록하세요.",
        "compress.m_mode_title": "압축 모드 및 품질 선택",
        "compress.m_mode_desc": "스마트 권장 압축(WebP)을 사용하면 화질 손실 없이 파일 크기를 80~90% 절감할 수 있습니다.",
        "compress.m_save_title": "일괄 저장 또는 복사",
        "compress.m_save_desc": "개별 이미지를 다운로드하거나, [압축 이미지 일괄 저장]을 눌러 ZIP 파일로 한 번에 다운로드하세요.",
        "compress.m_local_title": "100% 브라우저 로컬 처리",
        "compress.m_local_desc": "모든 압축 처리는 고객님의 PC 브라우저 내부에서만 실행되며, 이미지가 외부 서버로 단 1건도 전송되지 않아 안심하고 사용하실 수 있습니다.",
        "compress.msg_no_clipboard": "클립보드에 복사된 이미지가 없습니다.\nWin + Shift + S로 캡처 후 다시 시도해주세요.",
        "compress.msg_paste_guide": "Ctrl + V 키를 눌러 캡처 이미지를 붙여넣어 주세요.",
        "compress.msg_paste_direct": "Ctrl + V 단축키를 사용하여 화면에 바로 붙여넣어 주세요.",
        "compress.msg_confirm_clear": "등록된 모든 이미지를 목록에서 삭제하시겠습니까?",
        "compress.msg_max_limit": "한 번에 최대 50장까지 추가할 수 있습니다.",
        "compress.msg_load_err": "이미지를 불러오는 중 오류가 발생했습니다.",
        "compress.msg_need_add": "압축할 이미지를 먼저 추가해 주세요.",
        "compress.msg_zip_loading": "ZIP 압축 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
        "compress.msg_zip_creating": "ZIP 파일 생성 중...",
        "compress.msg_zip_err": "ZIP 파일 생성 중 오류가 발생했습니다.",
        "compress.msg_need_select": "복사할 이미지를 선택해 주세요.",
        "compress.msg_copy_success": "압축된 이미지가 클립보드에 복사되었습니다.\n원하는 곳에 Ctrl+V로 붙여넣으세요.",
        "compress.msg_copy_unsupported": "현재 브라우저 환경에서는 클립보드 이미지 직접 복사를 지원하지 않습니다.",
        "compress.msg_copy_err": "클립보드 복사에 실패했습니다. [다운로드] 버튼을 사용해 주세요.",
        "compress.badge_status_orig": "{0} / 50장 · 원본 포맷 자동 유지",
        "compress.badge_status_fmt": "{0} / 50장 · {1} 포맷 일괄 변환",
        "compress.badge_status_target": "{0} / 50장 · {1} 맞춤 압축",
        "compress.stat_saving": "{0} 절약 (-{1}%)",
        "compress.stat_none": "0 KB 절약 (0%)",
        "compress.default_name": "이미지"
    },
    en: {
        // 브랜드 및 공통
        "brand.title": "Bangjang Tools",
        "brand.subtitle": "Free Online Utilities",
        "nav.all_tools": "All Tools",
        "nav.home_tooltip": "Go to All Tools",
        "nav.image_tools": "Image Tools",
        "nav.video_tools": "Video Tools",
        "nav.blog_tools": "Blog & Docs",
        "nav.site_tools": "Website Audit",
        "nav.image_tools_badge": "7 Tools",
        "nav.video_tools_badge": "3 Tools",
        "nav.blog_tools_badge": "2 Tools",
        "nav.site_tools_badge": "1 Tool",
        
        // 도구 목록
        "tool.image_compress": "Compress Image",
        "tool.image_edit": "Image Editor",
        "tool.image_split": "Image Splitter",
        "tool.remove_bg": "Remove / Change BG",
        "tool.mosaic": "Photo Mosaic & Blur",
        "tool.qr_code": "QR Code Generator",
        "tool.batch_rename": "Batch File Renamer",
        "tool.video_trim_gif": "Video Trim → GIF",
        "tool.video_to_gif": "Video → GIF",
        "tool.screen_record_gif": "Screen Record → GIF",
        "tool.blog_formatter": "Blog Text Formatter",
        "tool.pdf_to_word": "PDF → Word",
        "tool.site_audit": "Website Image Audit",

        // 공통 버튼 및 라벨
        "btn.help": "Guide",
        "btn.confirm": "OK",
        "btn.close": "Close",
        "btn.download": "Download",
        "btn.reset": "Reset",
        "btn.apply": "Apply",
        "btn.save": "Save",
        "btn.copy": "Copy",
        "btn.copied": "Copied!",
        "label.sponsor": "Sponsored Ad",
        "label.security_notice": "100% Client-Side Privacy (Local Processing)",
        "label.security_desc": "Your files are processed directly in your browser and never uploaded to any server.",
        "footer.terms": "Terms of Service",
        "footer.privacy": "Privacy Policy",
        "footer.contact": "Contact Us",
        
        // 메인 대시보드
        "home.hero_title": "Smart & Free Online Productivity Tools",
        "home.hero_desc": "Fast, privacy-focused browser tools. Zero server uploads, completely free without limits.",
        "home.stat_free": "100% Free",
        "home.stat_client": "100% Local Run",
        "home.stat_limit": "No Limits",
        "home.cat_image_title": "Image Tools",
        "home.cat_image_desc": "Compress, crop, filter, AI remove BG, blur, grid split, QR code, and batch rename",
        "home.cat_video_title": "Video Tools",
        "home.cat_video_desc": "Trim videos, convert video clips & screen recordings directly to GIF",
        "home.cat_blog_title": "Blog & Document Tools",
        "home.cat_blog_desc": "Format blog post layouts and convert PDF documents",

        // Screen Record to GIF
        "record.meta_notice": "Removes unnecessary metadata (location, author, exif). Preserves only essential visual animation data.",
        "record.step_title": "1. Share Screen → 2. Adjust Area & Watermark → 3. Record",
        "record.step_desc": "Allow screen share, then drag inside preview to select recording area.",
        "record.btn_share": "Share Screen",
        "record.btn_stop_share": "Stop Share",
        "record.btn_start": "Start Record",
        "record.btn_stop": "Stop & Save",
        "record.empty_title": "Select the area you want to record",
        "record.empty_desc": "Click [Share Screen] to pick a tab or window. Adjust crop box and watermark before recording.",
        "record.empty_footnote": "Please allow browser screen share permission. Selecting another tab or window prevents infinite mirroring.",
        "record.countdown_ready": "Get ready... Switch to your target window",
        "record.encoding_title": "Generating High-Quality GIF",
        "record.guide_title": "How to use",
        "record.guide_step1_t": "Share Screen",
        "record.guide_step1_d": " and allow your window, tab, or screen.",
        "record.guide_step2": "Drag on the preview to select recording area and configure watermark logo.",
        "record.guide_step3_t": "Start Record",
        "record.guide_step3_d": " to capture your screen. Saved as high-quality GIF instantly.",
        "record.guide_footnote": "100% Free with zero limits. Longer recordings may require more processing time depending on device performance.",
        "record.crop_area": "Record Area",
        "record.quick_ratio": "Aspect Ratio Preset",
        "record.save_settings": "Save Settings",
        "record.filename": "File Name",
        "record.max_duration": "Max Duration (Sec)",
        "record.output_dimension": "Output Resolution (Long Side)",
        "record.max_fps": "Frame Rate (FPS)",
        "record.countdown_sec": "Countdown Delay",
        "record.watermark": "Watermark",
        "record.apply_watermark": "Apply Watermark",
        "record.wm_type": "Type",
        "record.wm_file": "Logo File",
        "btn.browse": "Browse",
        "btn.delete_logo": "Delete Logo",
        "record.logo_width": "Logo Width (px)",
        "record.wm_position": "Position",
        "record.opacity": "Opacity (%)",
        "record.margin": "Margin (px)",
        "record.wm_footnote": "Audio is not included. Supports up to 30s GIF. Actual FPS may vary based on device performance.",
        "record.result_title": "GIF Recording Complete!",
        "btn.download_gif": "Download GIF",
        "record.meta_resolution": "Resolution:",
        "record.meta_duration": "Duration:",
        "record.meta_filesize": "File Size:",

        // Blog Text Formatter
        "blog.header_desc": "Clean line breaks and preview center-aligned blog layouts in real-time. Adjust line width while keeping your original text, collect hashtags, and export to TXT.",
        "blog.notice_title": "Preserve your original text with readable line wraps.",
        "blog.notice_desc": "Enter your article and keywords to preview formatted results instantly. 100% processed in your browser.",
        "blog.content_label": "Original Article Draft",
        "blog.hashtag_label": "Hashtag Keywords",
        "blog.hashtag_hint": "Separate with space, comma, line breaks, or #. Up to 50 chars per tag.",
        "blog.smart_wrap": "Smart Line Wrap",
        "blog.line_width": "Line Width",
        "blog.smart_wrap_footnote": "Disabling smart wrap preserves original line breaks. URLs and single words won't be broken.",
        "blog.preview_title": "Center-Aligned Preview",
        "blog.preview_meta": "Base Width 560px · Fixed Layout",
        "blog.preview_desc": "Adjust line width from 30% to 100%. If lines break unexpectedly when pasting to blog editor, reduce the width.",
        "blog.empty_preview": "Enter article content to see the formatted preview here.",
        "btn.download_txt": "Download TXT",
        "blog.status_empty": "Please enter article content.",
        "blog.action_footnote": "TXT format does not store font, size, or center-alignment styling. Select text in your blog editor and apply center alignment directly.",
        "blog.guide_title": "How to use",
        "blog.guide_step1": "1. Enter or paste your article draft and input hashtags separately.",
        "blog.guide_step2": "2. Toggle smart wrap and adjust line width while checking the center-aligned preview.",
        "blog.guide_step3": "3. Download TXT or copy to clipboard. Apply center alignment directly in your blog editor.",
        "blog.guide_footnote": "Original draft remains in the input field. Empty articles cannot be downloaded.",
        "blog.faq_main_title": "Format Blog Draft Line Breaks & Hashtags",
        "blog.faq_desc1": "Paste your article draft to organize line wraps and adjust preview line width. Clean and format readability without generating unwanted AI text.",
        "blog.faq_desc2": "Hashtags are aggregated at the bottom of the article and saved as a clean UTF-8 TXT file.",
        "blog.faq_title": "Frequently Asked Questions",
        "blog.faq_q1": "▼ Does it publish directly to blog platforms?",
        "blog.faq_a1": "No automated publishing or account linking is included. Copy the formatted text and paste it into your favorite blog editor.",
        "blog.faq_q2": "▼ Does TXT file keep center alignment?",
        "blog.faq_a2": "Plain text files do not preserve alignment styles. Use this tool for visual preview and apply center alignment in your blog editor.",
        "blog.target_platform": "Target Blog Platform",

        // Website Image Audit
        "audit.hero_title": "Improve Your Website Performance",
        "audit.hero_desc": "Test how much you can save by compressing your images",
        "audit.card_title": "Discover image savings on your website",
        "audit.card_desc": "Paste the full link of a page to see how much you can save by compressing its images.",
        "audit.url_label": "Website URL",
        "audit.url_placeholder": "https://example.com/page",
        "audit.btn_analyze": "Analyze page",
        "audit.btn_analyzing": "Analyzing...",
        "audit.quick_test": "💡 Quick Test:",
        "audit.results_for": "Web page optimization results for",
        "audit.total_images": "Total images found",
        "audit.savings": "Savings",
        "audit.btn_show_report": "Show detailed report",
        "audit.btn_hide_report": "Hide detailed report",
        "audit.btn_reset": "Close result",
        "audit.orig_size_label": "Total original image size",
        "audit.new_size_label": "New total image size",
        "audit.orig_speed_label": "Original page load speed",
        "audit.new_speed_label": "New page load speed",
        "audit.seconds": "seconds",
        "audit.col_images": "Images",
        "audit.col_original": "Original",
        "audit.col_optimized": "Optimized",
        "audit.col_difference": "Difference",
        "audit.already_optimized": "Already optimized",
        "audit.recommend_webp": "Convert to WebP",

        // Added Placeholders and Badges
        "placeholder.search": "Search tools (e.g., QR, Resize...)",
        "placeholder.batch_rename": "Enter new file name",
        "placeholder.blog_content": "Paste your blog draft here.\nOriginal text remains intact, only line breaks are formatted.",
        "placeholder.blog_hashtag": "e.g. blog, automation #keyword",
        "placeholder.wm_text": "Enter text to display",
        "placeholder.width": "Width",
        "placeholder.height": "Height",
        "placeholder.mosaic_wm": "e.g. My blog watermark",
        "placeholder.mosaic_filename": "Enter file name",
        "placeholder.qr_url": "https://tools.bangjang.net",
        "badge.hot": "HOT",
        "badge.face_detect": "Face Detect",
        "badge.ai": "AI",

        // 메인 페이지(index.html) 본문 번역
        "home.hero_badge": "100% Free · No Install · No Server Upload",
        "home.new_hero_title": "Bangjang Tools to Speed Up Your Work",
        "home.new_hero_desc": "Edit photos, remove backgrounds, generate QR codes, and batch rename files safely and quickly in your browser.",
        "home.rec_title": "🔥 Top 4 Recommended Tools",
        "home.rec_bg_desc": "Clean cutout in 1 second",
        "home.rec_qr_desc": "Insert Logo · High-res SVG",
        "home.rec_rename_desc": "Ctrl+V capture numbering & ZIP",
        "home.rec_mosaic_desc": "AI Face Detect & Privacy Protect",
        "badge.ai_power": "AI Powered",
        "badge.unlimited": "Unlimited",
        "home.cat_video_blog": "Video & Blog Tools",
        "home.cat_audit_perf": "Website Audit & Performance",
        "nav.video_blog_tools_badge": "5 Tools",
        "nav.audit_tools_badge": "1 Tool",
        "badge.coming_soon": "Coming Soon",
        "badge.ai_intelligence": "AI Powered",
        "badge.basic": "Basic Tool",
        "badge.grid_split": "Grid Split",
        "badge.new_rec": "NEW & Rec",
        "brand.short": "Bangjang",
        "legal.title": "Legal Notice",
        "badge.fast": "Lightning Fast",
        "home.cat_image": "Image Tools",
        "home.cat_video": "Video Tools",
        "home.cat_blog": "Blog & Docs Tools",
        "home.btn_open": "Open Tool",
        "badge.highly_rec": "Highly Recommended",
        "badge.popular": "Popular",
        "badge.work_rec": "Best for Work",
        "desc.image_compress": "Compress captures and photos lightning fast, reducing size up to 90% without quality loss.",
        "desc.remove_bg": "Remove backgrounds from portraits or products in 1 second and merge with any background.",
        "desc.qr_code": "Generate unlimited static QR codes with colors and logos, and download as SVG.",
        "desc.batch_rename": "Paste photos and batch rename them with sequential numbers or rules, saving instantly as ZIP.",
        "desc.mosaic": "Safely hide faces or sensitive info with AI auto face detection and drag masking.",
        "desc.image_edit": "Batch rotate, crop, draw shapes/annotations, and vertically stitch capture images.",
        "desc.image_split": "Split a photo into 2, 4, 8, 16 pieces or custom grid and save individually or as ZIP.",
        "desc.video_trim_gif": "Trim desired start/end sections from video timeline and convert to high-quality GIF.",
        "desc.video_to_gif": "Convert full MP4/WebM videos to high-quality GIFs optimized for blogs.",
        "desc.screen_record_gif": "Record browser window or full screen in real-time and save as GIF without installation.",
        "desc.blog_formatter": "Remove unnecessary tags and format line breaks, spellings, and keyword densities.",
        "desc.pdf_to_word": "Safely convert PDF to editable MS Word (DOCX) while preserving tables and formatting.",
                "desc.site_audit": "Enter URL to audit image size savings and page load speed improvements in real-time.",
        
        // --- Image Compress Tool ---
        "compress.security_tag": "100% Local Smart Compression · Privacy Protected",
        "compress.help_title": "How to Use",
        "compress.help_btn": "Help",
        "compress.guide_main": "Capture with Win+Shift+S and Paste with Ctrl+V",
        "compress.guide_sub": "Keep adding photos to safely reduce size up to 90%.",
        "compress.btn_paste": "Paste",
        "compress.btn_add_file": "Add Files",
        "compress.btn_clear_all": "Clear All",
        "compress.badge_init": "0 / 50 · Max 30MB each",
        "compress.badge_limit": "Max 30MB each",
        "compress.summary_orig": "Total Original Size",
        "compress.summary_comp": "Total Compressed Size",
        "compress.summary_saving": "Total Savings",
        "compress.empty_title": "Drag images here or paste with <strong>Ctrl + V</strong>.",
        "compress.empty_desc": "You can also use [Paste] or [Add Files] above.",
        "compress.compare_title": "Real-time Quality & Size Comparison (Selected Image)",
        "compress.compare_orig": "Original",
        "compress.compare_result": "Compressed",
        "compress.btn_download_zip": "Download All (ZIP)",
        "compress.btn_copy": "Copy Selected",
        "compress.help_sec_title": "How to Use!",
        "compress.help_li_1": "Capture with <strong>Win+Shift+S</strong> and paste directly here with <strong>Ctrl+V</strong>. Adding files and drag & drop are also supported.",
        "compress.help_li_2": "Select <strong>[Smart Compression]</strong> or custom <strong>Quality/Resolution Format</strong> on the right to reduce size in real-time.",
        "compress.help_li_3": "Click [Download All (ZIP)] to instantly download all compressed photos as a <strong>ZIP file</strong>.",
        "compress.help_notice": "❗ Safely protects privacy by automatically removing 100% of EXIF metadata including location data.",
        "compress.set_header": "Compression Settings",
        "compress.set_mode": "Compression Mode",
        "compress.mode_smart": "Smart Compress (Keep Original Format)",
        "compress.mode_custom": "Custom (Adjust Quality/Resolution)",
        "compress.mode_target": "Target Size (Limit per image)",
        "compress.set_format": "Output Format",
        "compress.fmt_orig": "Keep Original (PNG to PNG, JPG to JPG)",
        "compress.fmt_webp": "WebP (Next-gen High Efficiency)",
        "compress.fmt_jpeg": "JPEG (Batch convert all formats)",
        "compress.fmt_png": "PNG (Keep transparency)",
        "compress.set_quality": "Quality",
        "compress.qual_min": "Max Compression (10%)",
        "compress.qual_bal": "Balanced (80%)",
        "compress.qual_max": "Max Quality (100%)",
        "compress.set_resize": "Max Resolution (Maintain Ratio)",
        "compress.res_orig": "Keep Original Resolution",
        "compress.res_fhd": "FHD (Max 1920px)",
        "compress.res_hd": "HD (Max 1280px · Web Recommended)",
        "compress.res_blog": "Blog/Email (Max 800px)",
        "compress.res_custom": "Custom Width",
        "compress.set_width": "Max Width · px",
        "compress.set_target_size": "Target File Size (Max per image)",
        "compress.unit_kb": "KB or less",
        "compress.target_desc": "Automatically calculates quality to ensure size is below the target.",
        "compress.webp_tip": "💡 WebP format reduces size up to 35% more than JPEG while keeping high quality. Highly recommended for web and blog uploads.",
        "compress.modal_title": "Image Compressor Guide",
        "compress.m_add_title": "Add Images or Paste Capture",
        "compress.m_add_desc": "Capture with Win+Shift+S (Mac: Cmd+Shift+4) and paste, or click [Add Files] or drag & drop to add images.",
        "compress.m_mode_title": "Select Compression Mode & Quality",
        "compress.m_mode_desc": "Using Smart Compression (WebP) can reduce file size by 80~90% without quality loss.",
        "compress.m_save_title": "Batch Save or Copy",
        "compress.m_save_desc": "Download images individually or click [Download All (ZIP)] to save them all at once.",
        "compress.m_local_title": "100% Browser Local Processing",
        "compress.m_local_desc": "All processing happens inside your PC browser. No images are ever sent to an external server, so it is completely safe to use.",
        "compress.msg_no_clipboard": "No image found in clipboard.\nPlease capture with Win + Shift + S and try again.",
        "compress.msg_paste_guide": "Press Ctrl + V to paste the captured image.",
        "compress.msg_paste_direct": "Use the Ctrl + V shortcut to paste directly on the screen.",
        "compress.msg_confirm_clear": "Are you sure you want to remove all images from the list?",
        "compress.msg_max_limit": "You can add up to 50 images at a time.",
        "compress.msg_load_err": "An error occurred while loading the image.",
        "compress.msg_need_add": "Please add images to compress first.",
        "compress.msg_zip_loading": "Loading ZIP library. Please try again in a moment.",
        "compress.msg_zip_creating": "Creating ZIP file...",
        "compress.msg_zip_err": "An error occurred while creating the ZIP file.",
        "compress.msg_need_select": "Please select an image to copy.",
        "compress.msg_copy_success": "Compressed image copied to clipboard.\nPaste it anywhere with Ctrl+V.",
        "compress.msg_copy_unsupported": "Your browser environment does not support direct image copying to clipboard.",
        "compress.msg_copy_err": "Failed to copy to clipboard. Please use the [Download] button.",
        "compress.badge_status_orig": "{0} / 50 · Keep Original Format",
        "compress.badge_status_fmt": "{0} / 50 · Convert to {1}",
        "compress.badge_status_target": "{0} / 50 · Target {1}",
        "compress.stat_saving": "{0} Saved (-{1}%)",
        "compress.stat_none": "0 KB Saved (0%)",
        "compress.default_name": "Image"
    }
};

class I18nManager {
    constructor() {
        this.currentLang = this.getInitialLanguage();
        this.init();
    }

    /**
     * 초기 언어 결정: LocalStorage > 브라우저 언어 > 기본값(ko)
     */
    getInitialLanguage() {
        const saved = localStorage.getItem('app_lang');
        if (saved && (saved === 'ko' || saved === 'en')) {
            return saved;
        }
        // 브라우저 언어 확인 (영어권인 경우 en 기본 제공)
        const userLang = navigator.language || navigator.userLanguage || 'ko';
        if (userLang.startsWith('en')) {
            return 'en';
        }
        return 'ko';
    }

    /**
     * 초기화 및 이벤트 리스너 등록
     */
    init() {
        document.documentElement.lang = this.currentLang;
        document.addEventListener('DOMContentLoaded', () => {
            this.applyTranslations();
            this.updateSwitcherUI();
        });
    }

    /**
     * 언어 변경
     */
    setLanguage(lang) {
        if (lang !== 'ko' && lang !== 'en') return;
        this.currentLang = lang;
        localStorage.setItem('app_lang', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
        this.updateSwitcherUI();
        
        // Lucide 아이콘 다시 렌더링
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 현재 번역 텍스트 가져오기
     */
    t(key, fallback = '') {
        const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.ko;
        return dict[key] || fallback || key;
    }

    /**
     * DOM 전체 번역 적용
     */
    applyTranslations() {
        const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.ko;
        
        // 1. data-i18n 일반 텍스트
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        // 2. data-i18n-placeholder 속성
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });

        // 3. data-i18n-title 속성
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key]) {
                el.title = dict[key];
            }
        });
    }

    /**
     * 언어 전환 버튼 UI 상태 동기화
     */
    updateSwitcherUI() {
        const buttons = document.querySelectorAll('.lang-btn');
        buttons.forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            if (lang === this.currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// 전역 인스턴스 생성 및 노출
window.i18n = new I18nManager();

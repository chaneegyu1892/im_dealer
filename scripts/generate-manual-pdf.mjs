/**
 * 아임딜러 관리자 매뉴얼 PDF 생성 스크립트
 *
 * 사용법:
 *   npx md-to-pdf ADMIN_MANUAL.md
 *
 * 또는 이 스크립트를 직접 실행 (puppeteer 필요):
 *   node scripts/generate-manual-pdf.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const md = readFileSync(join(ROOT, 'ADMIN_MANUAL.md'), 'utf-8');

// HTML 변환 (puppeteer 없이도 확인 가능한 standalone HTML)
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>아임딜러 관리자 운영 매뉴얼</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1A1A2E;
      background: #fff;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 48px;
    }

    /* 표지 */
    .cover {
      text-align: center;
      padding: 80px 0 60px;
      border-bottom: 3px solid #000666;
      margin-bottom: 60px;
      page-break-after: always;
    }
    .cover .logo {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #6066EE;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .cover h1 {
      font-size: 36px;
      font-weight: 700;
      color: #000666;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .cover .subtitle {
      font-size: 16px;
      color: #9BA4C0;
      margin-bottom: 40px;
    }
    .cover .meta {
      font-size: 13px;
      color: #9BA4C0;
      line-height: 2;
    }
    .cover .meta strong { color: #1A1A2E; }

    /* 목차 */
    .toc {
      background: #F8F9FC;
      border-left: 4px solid #000666;
      border-radius: 0 8px 8px 0;
      padding: 28px 32px;
      margin-bottom: 48px;
      page-break-after: always;
    }
    .toc h2 {
      font-size: 18px;
      color: #000666;
      margin-bottom: 20px;
      font-weight: 700;
    }
    .toc ol { padding-left: 20px; }
    .toc li {
      padding: 5px 0;
      color: #1A1A2E;
      font-size: 13px;
    }
    .toc a { color: #6066EE; text-decoration: none; }

    /* 섹션 제목 */
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #000666;
      padding-bottom: 12px;
      border-bottom: 2px solid #E8EAF0;
      margin: 48px 0 24px;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      color: #000666;
      margin: 36px 0 16px;
      padding-left: 12px;
      border-left: 3px solid #6066EE;
    }
    h3 {
      font-size: 16px;
      font-weight: 700;
      color: #1A1A2E;
      margin: 28px 0 12px;
    }
    h4 {
      font-size: 14px;
      font-weight: 700;
      color: #1A1A2E;
      margin: 20px 0 10px;
    }

    /* 단락 */
    p { margin: 10px 0; color: #1A1A2E; }

    /* 테이블 */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border-radius: 8px;
      overflow: hidden;
    }
    thead tr { background: #000666; color: white; }
    thead th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
    }
    tbody tr:nth-child(even) { background: #F8F9FC; }
    tbody tr:hover { background: #EEF0F8; }
    tbody td { padding: 9px 14px; border-bottom: 1px solid #E8EAF0; color: #1A1A2E; }

    /* 코드 블록 */
    pre {
      background: #1A1A2E;
      color: #E8EAF0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 16px 0;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    code {
      background: #F0F1F8;
      color: #6066EE;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
    }
    pre code { background: none; color: inherit; padding: 0; }

    /* 인용 블록 */
    blockquote {
      border-left: 4px solid #6066EE;
      background: #F0F1FA;
      border-radius: 0 8px 8px 0;
      padding: 14px 18px;
      margin: 16px 0;
      color: #1A1A2E;
      font-size: 13px;
    }
    blockquote p { margin: 4px 0; }
    blockquote strong { color: #000666; }

    /* 리스트 */
    ul, ol {
      padding-left: 22px;
      margin: 10px 0;
    }
    li {
      margin: 5px 0;
      color: #1A1A2E;
      font-size: 13px;
    }

    /* 구분선 */
    hr {
      border: none;
      border-top: 1px solid #E8EAF0;
      margin: 40px 0;
    }

    /* 페이지 나누기 (인쇄용) */
    @media print {
      body { padding: 20px 28px; max-width: 100%; }
      h1 { page-break-before: always; }
      h1:first-of-type { page-break-before: avoid; }
      table { page-break-inside: avoid; }
      pre { page-break-inside: avoid; }
      blockquote { page-break-inside: avoid; }
    }

    /* 강조 */
    strong { color: #000666; font-weight: 700; }
    em { color: #6066EE; font-style: normal; font-weight: 500; }

    /* 경고/노트 박스 */
    .note {
      background: #FFF8E1;
      border-left: 4px solid #F59E0B;
      border-radius: 0 8px 8px 0;
      padding: 14px 18px;
      margin: 16px 0;
      font-size: 13px;
    }
    .warning {
      background: #FFF0F0;
      border-left: 4px solid #EF4444;
      border-radius: 0 8px 8px 0;
      padding: 14px 18px;
      margin: 16px 0;
      font-size: 13px;
    }

    /* 푸터 */
    footer {
      text-align: center;
      color: #9BA4C0;
      font-size: 11px;
      padding: 32px 0 0;
      border-top: 1px solid #E8EAF0;
      margin-top: 60px;
    }
  </style>
</head>
<body>

  <!-- 표지 -->
  <div class="cover">
    <div class="logo">IM DEALER ADMIN</div>
    <h1>관리자 운영 매뉴얼</h1>
    <div class="subtitle">Admin Operation Manual v2.0</div>
    <div class="meta">
      <strong>버전</strong>: 2.0<br>
      <strong>최종 수정</strong>: 2026-04-21<br>
      <strong>대상</strong>: 아임딜러 어드민 운영팀
    </div>
  </div>

  <!-- 목차 -->
  <div class="toc">
    <h2>📋 목차</h2>
    <ol>
      <li>시스템 접속 및 로그인</li>
      <li>전체 레이아웃 및 사이드바 구조</li>
      <li>대시보드 (Dashboard)</li>
      <li>데이터 분석 (Analytics)</li>
      <li>차량 관리 (Vehicle Management)</li>
      <li>견적 데이터 (Quotations)</li>
      <li>사용자 관리 (Users)</li>
      <li>재고 관리 (Inventory)</li>
      <li>견적 산출 로직 관리 (Finance)</li>
      <li>AI 관리 (AI Management)</li>
      <li>운영 메모 (Memo)</li>
      <li>설정 (Settings)</li>
      <li>서류 확인 (Verifications)</li>
      <li>회수율 설정 (Recovery Rates)</li>
      <li>부록: API 엔드포인트 요약 / 색상 체계</li>
    </ol>
  </div>

  <!-- 본문 (마크다운을 HTML로 변환한 내용이 여기에 삽입됨) -->
  <div id="content">
    <!-- 아래 내용을 직접 편집하거나, marked.js 등 라이브러리로 변환하세요 -->
    <p style="color:#9BA4C0; text-align:center; padding: 40px;">
      이 HTML 파일을 브라우저에서 열고 <strong>Ctrl+P (또는 Cmd+P)</strong>로 인쇄 → PDF로 저장하세요.<br><br>
      또는 터미널에서 아래 명령어를 실행하세요:<br><br>
      <code>npx md-to-pdf ADMIN_MANUAL.md</code>
    </p>
  </div>

  <footer>
    아임딜러(IM DEALER) 관리자 운영 매뉴얼 v2.0 &nbsp;|&nbsp; 2026-04-21 &nbsp;|&nbsp; 내부 배포용 문서
  </footer>

</body>
</html>`;

writeFileSync(join(ROOT, 'ADMIN_MANUAL.html'), html, 'utf-8');
console.log('✅ ADMIN_MANUAL.html 생성 완료');
console.log('');
console.log('PDF 변환 방법:');
console.log('  방법 1: 브라우저에서 ADMIN_MANUAL.html 열기 → Ctrl+P → PDF로 저장');
console.log('  방법 2: npx md-to-pdf ADMIN_MANUAL.md');
console.log('  방법 3: VS Code에서 "Markdown PDF" 확장 사용');

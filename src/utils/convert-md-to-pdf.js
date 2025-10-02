const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일이 존재하지 않습니다: ${filePath}`);
  }
}

function extractMermaidBlocks(markdown) {
  const regex = /```mermaid\s*[\r\n]+([\s\S]*?)[\r\n]*```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({ code: match[1].trim() });
  }
  return blocks;
}

function replaceBlocksWithSvgs(markdown, svgContents) {
  const regex = /```mermaid\s*[\r\n]+([\s\S]*?)[\r\n]*```/g;
  let result = "";
  let lastIndex = 0;
  let i = 0;
  let m;
  while ((m = regex.exec(markdown)) !== null) {
    result += markdown.slice(lastIndex, m.index);
    result += `<div class="mermaid-diagram">${svgContents[i]}</div>`;
    lastIndex = regex.lastIndex;
    i += 1;
  }
  result += markdown.slice(lastIndex);
  return result;
}

// 이미지를 Base64로 변환하는 함수
function convertImageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = "image/png";

    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".svg") mimeType = "image/svg+xml";
    else if (ext === ".webp") mimeType = "image/webp";

    const base64 = imageBuffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.log("Base64 변환 실패:", err.message);
    return null;
  }
}

// ### [수정됨] 이미지 경로를 마크다운 파일 기준으로 변환하는 함수 ###
function resolveImagePaths(markdown, basePath) {
  // basePath는 마크다운 파일이 위치한 디렉토리입니다.
  // 예: /path/to/project/docs/
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    // 1. URL(http, https)이거나 이미 Base64 데이터 URI인 경우, 원본을 그대로 반환합니다.
    if (src.startsWith("http") || src.startsWith("data:")) {
      return match;
    }

    // 2. 마크다운 파일의 위치(basePath)를 기준으로 이미지의 절대 경로를 생성합니다.
    // 예: basePath가 '/user/docs'이고 src가 'assets/images/pic.png'라면,
    // imagePath는 '/user/docs/assets/images/pic.png'가 됩니다.
    const imagePath = path.resolve(basePath, src);

    // 3. 해당 경로에 파일이 실제로 존재하는지 확인합니다.
    if (fs.existsSync(imagePath)) {
      // 파일이 존재하면 Base64로 변환합니다.
      const base64Data = convertImageToBase64(imagePath);
      if (base64Data) {
        // 변환에 성공하면 Base64 데이터를 포함한 이미지 태그로 교체합니다.
        return `![${alt}](${base64Data})`;
      } else {
        console.warn(`이미지 Base64 변환 실패: ${imagePath}`);
      }
    }

    // 4. 이미지를 찾지 못한 경우, 사용자에게 알려주는 HTML 블록을 반환합니다.
    console.warn(
      `이미지 파일을 찾을 수 없습니다. src: "${src}", 기준 경로: "${basePath}"`
    );

    // basePath가 null이면 드래그앤드롭으로 인한 경로 문제임을 안내
    const isDroppedFile =
      basePath === null ||
      basePath.includes("Desktop") ||
      basePath.includes("Temp");
    const helpMessage = isDroppedFile
      ? "드래그앤드롭 대신 '파일 선택' 버튼을 사용하면 이미지가 정확히 표시됩니다."
      : "마크다운 파일 위치 기준으로 경로가 올바른지 확인해주세요.";

    return `<div style="border: 2px dashed #ff6b6b; padding: 20px; text-align: center; margin: 1em 0; background-color: #fff5f5;">
      <p>🖼️ 이미지를 찾을 수 없습니다</p>
      <p><strong>${alt}</strong></p>
      <p>원본 경로: <code>${src}</code></p>
      <p style="font-size: 0.9em; color: #e74c3c; font-weight: bold;">${helpMessage}</p>
    </div>`;
  });
}

// 인라인 마크다운 처리 함수
function processInlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" style="max-width: 100%; height: auto; display: block; margin: 1em 0;">'
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// 테이블 파싱 함수
function parseTable(tableText) {
  const lines = tableText.trim().split("\n");
  if (lines.length < 2) return tableText;

  const headerLine = lines[0];
  const separatorLine = lines[1];
  const dataLines = lines.slice(2);

  if (!separatorLine.includes("|") || !separatorLine.includes("-")) {
    return tableText;
  }

  const headers = headerLine
    .split("|")
    .slice(1, -1)
    .map((cell) => processInlineMarkdown(cell.trim()));

  const alignments = separatorLine
    .split("|")
    .slice(1, -1)
    .map((cell) => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
        return "center";
      } else if (trimmed.endsWith(":")) {
        return "right";
      } else {
        return "left";
      }
    });

  const rows = dataLines.map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => processInlineMarkdown(cell.trim()))
  );

  let tableHtml = '<table class="markdown-table">\n';

  if (headers.length > 0) {
    tableHtml += "  <thead>\n    <tr>\n";
    headers.forEach((header, index) => {
      const alignment = alignments[index] || "left";
      tableHtml += `      <th style="text-align: ${alignment};">${header}</th>\n`;
    });
    tableHtml += "    </tr>\n  </thead>\n";
  }

  if (rows.length > 0) {
    tableHtml += "  <tbody>\n";
    rows.forEach((row) => {
      if (row.length > 0) {
        tableHtml += "    <tr>\n";
        row.forEach((cell, index) => {
          const alignment = alignments[index] || "left";
          tableHtml += `      <td style="text-align: ${alignment};">${cell}</td>\n`;
        });
        tableHtml += "    </tr>\n";
      }
    });
    tableHtml += "  </tbody>\n";
  }

  tableHtml += "</table>";
  return tableHtml;
}

// 마크다운을 HTML로 변환하는 함수
function markdownToHtml(markdown) {
  // 테이블을 임시 플레이스홀더로 보호
  const tables = [];

  // 테이블 감지를 위한 더 정확한 정규식
  let html = markdown.replace(/((?:^\|.*\|[ \t]*(?:\r?\n|$))+)/gm, (match) => {
    const lines = match
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length >= 2) {
      const separatorLine = lines[1];
      // 구분자 라인이 올바른 테이블 형식인지 확인
      if (
        separatorLine.match(/^\|[\s\-:|]+\|$/) &&
        separatorLine.includes("-")
      ) {
        const tableHtml = parseTable(match.trim());
        const placeholder = `__TABLE_PLACEHOLDER_${tables.length}__`;
        tables.push(tableHtml);
        return "\n" + placeholder + "\n";
      }
    }

    return match;
  });

  // 일반 마크다운 처리 - 제목은 가장 긴 것부터 처리
  html = html
    .replace(/^#{6}\s+(.*?)$/gim, "<h6>$1</h6>")
    .replace(/^#{5}\s+(.*?)$/gim, "<h5>$1</h5>")
    .replace(/^#{4}\s+(.*?)$/gim, "<h4>$1</h4>")
    .replace(/^#{3}\s+(.*?)$/gim, "<h3>$1</h3>")
    .replace(/^#{2}\s+(.*?)$/gim, "<h2>$1</h2>")
    .replace(/^#{1}\s+(.*?)$/gim, "<h1>$1</h1>");

  // 코드 블록 처리 (mermaid 제외)
  html = html.replace(
    /```(?!mermaid)([\w]*)\n([\s\S]*?)```/g,
    (match, lang, code) => {
      return `<pre><code class="language-${
        lang || "text"
      }">${code.trim()}</code></pre>`;
    }
  );

  // 이미지 처리
  html = html
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" style="max-width: 100%; height: auto; display: block; margin: 1em 0;">'
    )
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\.\s+(.*$)/gim, "<oli>$1</oli>") // 순서 있는 리스트
    .replace(/^[-*+]\s+(.*$)/gim, "<li>$1</li>") // 순서 없는 리스트
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // 순서 있는 리스트 처리
  html = html.replace(/(<oli>.*?<\/oli>(?:<br>)*)+/g, (match) => {
    return (
      "<ol>" +
      match
        .replace(/<oli>/g, "<li>")
        .replace(/<\/oli>/g, "</li>")
        .replace(/<br>/g, "") +
      "</ol>"
    );
  });

  // 순서 없는 리스트 처리
  html = html.replace(/(<li>.*?<\/li>(?:<br>)*)+/g, (match) => {
    return "<ul>" + match.replace(/<br>/g, "") + "</ul>";
  });

  // 문단 처리 - 제목, 리스트, 테이블, 다이어그램, HTML 태그가 아닌 텍스트만 p 태그로 감싸기
  html = html.replace(
    /^(?!<[hult]|<div|__TABLE_PLACEHOLDER_)([^<\n].*)$/gim,
    "<p>$1</p>"
  );

  // 테이블 플레이스홀더를 실제 테이블로 복원
  tables.forEach((tableHtml, index) => {
    html = html.replace(`__TABLE_PLACEHOLDER_${index}__`, tableHtml);
  });

  return html;
}

async function convertOne(
  inputPath,
  statusCallback = () => {},
  originalPath = null, // GUI에서 반드시 원본 파일의 전체 경로를 이 인자로 전달해야 합니다.
  options = { showPageNumbers: true } // 페이지 번호 표시 옵션 (기본값: true)
) {
  // 입력 매개변수 검증
  if (!inputPath || typeof inputPath !== "string") {
    const error = new Error("입력 파일 경로가 유효하지 않습니다.");
    console.error("❌ 매개변수 오류:", error.message);
    throw error;
  }

  if (typeof statusCallback !== "function") {
    console.warn(
      "⚠️  statusCallback이 함수가 아닙니다. 기본 콜백을 사용합니다."
    );
    statusCallback = () => {};
  }

  // --- 디버깅 로그 추가 ---
  console.log("=============================================");
  console.log("[Debug] convertOne 함수가 수신한 경로 정보:");
  console.log("  - inputPath (처리 대상 경로):", inputPath);
  console.log("  - originalPath (이미지 기준 경로용):", originalPath);
  console.log("=============================================");

  let absoluteInput, dir, base, safeName, outputDir, markdown;

  try {
    // 파일 경로 처리 및 검증
    absoluteInput = path.resolve(inputPath);
    ensureFileExists(absoluteInput);

    dir = path.dirname(absoluteInput);
    base = path.basename(absoluteInput, path.extname(absoluteInput));
    safeName = base.replace(/[^\w\-_.]/g, "_");

    // 안전한 파일명 검증
    if (!safeName || safeName.length === 0) {
      safeName = "converted_document";
      console.warn(
        "⚠️  파일명이 유효하지 않아 기본 이름을 사용합니다:",
        safeName
      );
    }

    outputDir = path.join(dir, "output");
    console.log("✅ 파일 경로 처리 완료:", {
      absoluteInput,
      outputDir,
      safeName,
    });
  } catch (pathError) {
    const error = new Error(`파일 경로 처리 중 오류: ${pathError.message}`);
    console.error("❌ 파일 경로 오류:", error.message);
    throw error;
  }

  try {
    // 출력 디렉토리 생성
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log("✅ 출력 디렉토리 생성:", outputDir);
    }
  } catch (dirError) {
    const error = new Error(`출력 디렉토리 생성 실패: ${dirError.message}`);
    console.error("❌ 디렉토리 생성 오류:", error.message);
    throw error;
  }

  try {
    statusCallback("마크다운 파일 읽는 중...");
    // 인코딩 문제 방지를 위해 'utf8' 명시
    markdown = fs.readFileSync(absoluteInput, "utf8");

    if (!markdown || markdown.trim().length === 0) {
      console.warn("⚠️  마크다운 파일이 비어있습니다. 기본 내용을 추가합니다.");
      markdown =
        "# 빈 문서\n\n이 문서는 내용이 없어 기본 텍스트가 추가되었습니다.";
    }

    console.log("✅ 마크다운 파일 읽기 완료:", `${markdown.length} 문자`);
  } catch (readError) {
    const error = new Error(`마크다운 파일 읽기 실패: ${readError.message}`);
    console.error("❌ 파일 읽기 오류:", error.message);
    throw error;
  }

  try {
    // 줄바꿈 문자 통일
    markdown = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // [중요] 이미지 경로를 해결하기 위한 기준 경로(base path) 설정
    // originalPath가 있으면 그것을 사용하고, 없으면 inputPath의 디렉토리를 사용합니다.
    const imageBasePath = originalPath ? path.dirname(originalPath) : dir;

    // --- 디버깅 로그 추가 ---
    console.log(
      `[Debug] 최종 이미지 검색 기준 경로(imageBasePath): ${imageBasePath}`
    );

    if (!originalPath) {
      console.warn(
        `[Warning] originalPath가 null입니다. 드래그앤드롭으로 인해 이미지 경로 해결에 문제가 있을 수 있습니다.`
      );
    }

    // 이미지 경로 처리 - 오류 발생 시에도 계속 진행
    try {
      markdown = resolveImagePaths(markdown, imageBasePath);
      console.log("✅ 이미지 경로 처리 완료");
    } catch (imageError) {
      console.error("❌ 이미지 경로 처리 중 오류:", imageError.message);
      console.warn("⚠️  이미지 처리 오류를 무시하고 계속 진행합니다.");
      // 이미지 처리 실패해도 변환은 계속 진행
    }
  } catch (preprocessError) {
    console.error("❌ 마크다운 전처리 중 오류:", preprocessError.message);
    console.warn(
      "⚠️  전처리 오류를 무시하고 원본 마크다운으로 계속 진행합니다."
    );
    // 전처리 실패해도 원본 마크다운으로 계속 진행
  }

  // Mermaid 다이어그램 처리 - 강화된 에러 처리
  let blocks, processedMarkdown;

  try {
    blocks = extractMermaidBlocks(markdown);
    processedMarkdown = markdown;
    console.log(`✅ Mermaid 블록 추출 완료: ${blocks.length}개 발견`);
  } catch (extractError) {
    console.error("❌ Mermaid 블록 추출 중 오류:", extractError.message);
    console.warn("⚠️  Mermaid 처리를 건너뛰고 계속 진행합니다.");
    blocks = [];
    processedMarkdown = markdown;
  }

  if (blocks.length > 0) {
    statusCallback(`${blocks.length}개 Mermaid 다이어그램 처리 중...`);

    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
        ],
        timeout: 60000,
      });
      console.log("✅ Puppeteer 브라우저 시작 완료");
    } catch (browserError) {
      console.error("❌ Puppeteer 브라우저 시작 실패:", browserError.message);
      console.warn("⚠️  Mermaid 다이어그램 처리를 건너뛰고 계속 진행합니다.");
      // 브라우저 시작 실패 시 다이어그램 없이 계속 진행
      blocks = [];
    }

    if (browser) {
      try {
        const svgContents = [];

        for (let i = 0; i < blocks.length; i++) {
          statusCallback(`다이어그램 ${i + 1}/${blocks.length} 생성 중...`);

          try {
            const diagramPage = await browser.newPage();

            const mermaidHtml = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/mermaid@10.6.1/dist/mermaid.min.js"></script>
</head>
<body>
    <div class="mermaid">
${blocks[i].code}
    </div>
    <script>
        mermaid.initialize({ 
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Arial, sans-serif'
        });
    </script>
</body>
</html>`;

            await diagramPage.setContent(mermaidHtml);
            await diagramPage.waitForSelector(".mermaid svg", {
              timeout: 20000,
            });

            const svgContent = await diagramPage.evaluate(() => {
              const svg = document.querySelector(".mermaid svg");
              if (svg) {
                svg.style.maxWidth = "100%";
                svg.style.height = "auto";
                svg.style.display = "block";
                svg.style.margin = "20px auto";
                return svg.outerHTML;
              }
              return null;
            });

            if (svgContent) {
              svgContents.push(svgContent);
              statusCallback(`다이어그램 ${i + 1} 완료`);
            } else {
              throw new Error("SVG 생성 실패");
            }

            await diagramPage.close();
          } catch (error) {
            statusCallback(`다이어그램 ${i + 1} 생성 실패, 대체 이미지 사용`);

            const fallbackSvg = `
<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">
  <rect width="600" height="200" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
  <text x="300" y="80" text-anchor="middle" font-family="Arial" font-size="16" fill="#6c757d">
    📊 Mermaid 다이어그램
  </text>
  <text x="300" y="110" text-anchor="middle" font-family="Arial" font-size="14" fill="#6c757d">
    (생성 중 오류 발생)
  </text>
  <text x="300" y="140" text-anchor="middle" font-family="monospace" font-size="12" fill="#adb5bd">
    ${blocks[i].code.split("\n")[0].substring(0, 50)}...
  </text>
</svg>`;
            svgContents.push(fallbackSvg);
          }
        }

        try {
          processedMarkdown = replaceBlocksWithSvgs(markdown, svgContents);
          console.log("✅ Mermaid 다이어그램 교체 완료");
        } catch (replaceError) {
          console.error(
            "❌ Mermaid 다이어그램 교체 중 오류:",
            replaceError.message
          );
          console.warn("⚠️  원본 마크다운을 사용합니다.");
          processedMarkdown = markdown;
        }
      } finally {
        try {
          if (browser) {
            await browser.close();
            console.log("✅ Puppeteer 브라우저 종료 완료");
          }
        } catch (closeError) {
          console.error("❌ 브라우저 종료 중 오류:", closeError.message);
          // 브라우저 종료 실패는 치명적이지 않으므로 계속 진행
        }
      }
    }
  }

  let html;
  try {
    statusCallback("HTML로 변환 중...");
    html = markdownToHtml(processedMarkdown);

    if (!html || html.trim().length === 0) {
      throw new Error("HTML 변환 결과가 비어있습니다.");
    }

    console.log("✅ HTML 변환 완료:", `${html.length} 문자`);
  } catch (htmlError) {
    console.error("❌ HTML 변환 중 오류:", htmlError.message);
    console.warn("⚠️  기본 HTML 템플릿을 사용합니다.");

    // 안전장치: 기본 HTML 생성
    html = `<h1>변환 오류</h1><p>마크다운을 HTML로 변환하는 중 오류가 발생했습니다.</p><pre>${processedMarkdown}</pre>`;
  }

  // CSS에서는 페이지 번호 관련 설정 제거 (Puppeteer displayHeaderFooter 사용)
  const pageNumberCSS = "";

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        ${pageNumberCSS}
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Malgun Gothic', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 { 
            color: #2c3e50; 
            margin-top: 2em;
            margin-bottom: 1em;
        }
        h1 { font-size: 2.2em; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
        h2 { font-size: 1.8em; border-bottom: 1px solid #bdc3c7; padding-bottom: 0.3em; }
        h3 { font-size: 1.4em; }
        h4 { font-size: 1.2em; }
        h5 { font-size: 1.1em; }
        h6 { font-size: 1.0em; font-weight: bold; }
        code { 
            background: #f8f9fa; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }
        pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            margin: 1em 0;
        }
        pre code {
            background: none;
            padding: 0;
            border-radius: 0;
            font-size: 0.85em;
            line-height: 1.45;
        }
        ul, ol { padding-left: 1.5em; margin: 1em 0; }
        li { margin: 0.5em 0; }
        p { margin: 1em 0; }
        strong { color: #2c3e50; }
        .mermaid-diagram {
            text-align: center;
            margin: 2em 0;
            padding: 1em;
            background: #fafafa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .mermaid-diagram svg {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 0 auto !important;
        }
        .markdown-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5em 0;
            font-size: 0.9em;
            border: 2px solid #333 !important;
            page-break-inside: auto;
        }
        .markdown-table thead { display: table-header-group; }
        .markdown-table tbody { display: table-row-group; }
        .markdown-table th,
        .markdown-table td {
            border: 1px solid #333 !important;
            padding: 8px 12px;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            page-break-inside: avoid;
        }
        .markdown-table th {
            background-color: #f0f0f0 !important;
            font-weight: bold;
            color: #000 !important;
            border-bottom: 2px solid #333 !important;
        }
        .markdown-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        .markdown-table tr:nth-child(even) td {
            background-color: #f8f8f8 !important;
        }
        .markdown-table tbody tr {
            border-bottom: 1px solid #333 !important;
        }
        img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 1em auto !important;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px;
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;

  statusCallback("PDF 생성 중...");

  let browser2 = null;
  try {
    browser2 = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("✅ PDF 생성용 Puppeteer 브라우저 시작 완료");
  } catch (browserError) {
    const error = new Error(
      `PDF 생성용 브라우저 시작 실패: ${browserError.message}`
    );
    console.error("❌ 브라우저 시작 오류:", error.message);
    throw error;
  }

  try {
    let page;
    try {
      page = await browser2.newPage();
      console.log("✅ 새 페이지 생성 완료");
    } catch (pageError) {
      const error = new Error(`새 페이지 생성 실패: ${pageError.message}`);
      console.error("❌ 페이지 생성 오류:", error.message);
      throw error;
    }

    try {
      await page.setContent(fullHtml, { waitUntil: "networkidle0" });
      console.log("✅ HTML 콘텐츠 설정 완료");
    } catch (contentError) {
      console.error("❌ HTML 콘텐츠 설정 실패:", contentError.message);
      console.warn("⚠️  기본 대기 옵션으로 재시도합니다.");

      try {
        await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
        console.log("✅ HTML 콘텐츠 설정 완료 (기본 옵션)");
      } catch (retryError) {
        const error = new Error(`HTML 콘텐츠 설정 실패: ${retryError.message}`);
        console.error("❌ HTML 콘텐츠 재시도 실패:", error.message);
        throw error;
      }
    }



    const pdfPath = path.join(outputDir, `${safeName}.pdf`);

    // PDF 생성 옵션 설정 - 에러 처리 강화
    let pdfOptions;

    pdfOptions = {
      path: pdfPath,
      format: "A4",
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: options && options.showPageNumbers ? "25mm" : "20mm", // 페이지 번호 공간 확보
        left: "20mm",
      },
      printBackground: true,
      preferCSSPageSize: true,
    };

    // 페이지 번호 표시 옵션 처리
    if (options && options.showPageNumbers) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = "<div></div>"; // 빈 헤더
      pdfOptions.footerTemplate = `
        <div style="
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Malgun Gothic', sans-serif;
          font-size: 10px; 
          color: #666; 
          text-align: center; 
          width: 100%; 
          margin: 0 auto;
          padding: 5px 0;
          display: flex;
          justify-content: center;
          align-items: center;
          line-height: 1.4;
          font-weight: 400;
        ">
          <span class="pageNumber"></span>
        </div>
      `;
      console.log("✅ 페이지 번호 표시 활성화");
    } else {
      console.log("✅ 페이지 번호 표시 비활성화");
    }

    // PDF 생성 실행
    try {
      await page.pdf(pdfOptions);
      console.log("✅ PDF 생성 성공");
    } catch (pdfError) {
      console.error("❌ PDF 생성 실패:", pdfError.message);
      throw pdfError;
    }

    statusCallback(`완료: ${safeName}.pdf`);
    console.log("✅ PDF 변환 전체 프로세스 완료:", pdfPath);
    return pdfPath;
  } finally {
    try {
      if (browser2) {
        await browser2.close();
        console.log("✅ PDF 생성용 브라우저 종료 완료");
      }
    } catch (closeError) {
      console.error("❌ PDF 생성용 브라우저 종료 중 오류:", closeError.message);
      // 브라우저 종료 실패는 치명적이지 않으므로 계속 진행
    }
  }
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("❌ 사용법: node convert-md-to-pdf.js <markdown 파일...>");
    process.exit(1);
  }

  console.log(`🚀 PDF 변환 시작: ${inputs.length}개 파일 처리`);

  let successCount = 0;
  let failureCount = 0;

  for (const input of inputs) {
    try {
      console.log(`\n📄 처리 중: ${input}`);
      const outputPath = await convertOne(input, console.log);
      console.log(`✅ 성공: ${input} → ${outputPath}`);
      successCount++;
    } catch (err) {
      console.error(`❌ 변환 실패: ${input}`);
      console.error(`   오류 내용: ${err.message || err}`);

      // 상세 오류 정보 로깅
      if (err.stack) {
        console.error(`   스택 트레이스: ${err.stack}`);
      }

      failureCount++;
      process.exitCode = 2;
    }
  }

  console.log(`\n📊 변환 완료 요약:`);
  console.log(`   ✅ 성공: ${successCount}개`);
  console.log(`   ❌ 실패: ${failureCount}개`);
  console.log(`   📁 총 처리: ${inputs.length}개`);

  if (failureCount > 0) {
    console.log(`\n⚠️  ${failureCount}개 파일 변환에 실패했습니다.`);
    process.exit(2);
  } else {
    console.log(`\n🎉 모든 파일이 성공적으로 변환되었습니다!`);
    process.exit(0);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = { convertOne };
}

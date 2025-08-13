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
    // SVG를 직접 HTML에 임베드
    result += `<div class="mermaid-diagram">${svgContents[i]}</div>`;
    lastIndex = regex.lastIndex;
    i += 1;
  }
  result += markdown.slice(lastIndex);
  return result;
}

// 간단한 마크다운 파서
function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // 리스트 처리
  html = html.replace(/(<li>.*?<\/li>(?:<br>)*)+/g, (match) => {
    return "<ul>" + match.replace(/<br>/g, "") + "</ul>";
  });

  // 문단 처리 (mermaid-diagram div는 제외)
  html = html.replace(
    /^(?!<[hul]|<div class="mermaid-diagram")([^<\n].*)$/gim,
    "<p>$1</p>"
  );

  return html;
}

async function convertOne(inputPath, statusCallback = () => {}) {
  const absoluteInput = path.resolve(inputPath);
  ensureFileExists(absoluteInput);
  const dir = path.dirname(absoluteInput);
  const base = path.basename(absoluteInput, path.extname(absoluteInput));
  const safeName = base.replace(/[^\w\-_.]/g, "_");
  const outputDir = path.join(dir, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  statusCallback("마크다운 파일 읽는 중...");
  const markdown = fs.readFileSync(absoluteInput, "utf8");
  const blocks = extractMermaidBlocks(markdown);

  let processedMarkdown = markdown;

  if (blocks.length > 0) {
    statusCallback(`${blocks.length}개 Mermaid 다이어그램 처리 중...`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
      ],
      timeout: 60000,
    });

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
          await diagramPage.waitForSelector(".mermaid svg", { timeout: 20000 });

          // SVG 추출하고 스타일 개선
          const svgContent = await diagramPage.evaluate(() => {
            const svg = document.querySelector(".mermaid svg");
            if (svg) {
              // SVG에 스타일 추가
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

      processedMarkdown = replaceBlocksWithSvgs(markdown, svgContents);
    } finally {
      await browser.close();
    }
  }

  statusCallback("HTML로 변환 중...");
  const html = markdownToHtml(processedMarkdown);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
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
        code { 
            background: #f8f9fa; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }
        ul {
            padding-left: 1.5em;
        }
        li {
            margin: 0.5em 0;
        }
        p {
            margin: 1em 0;
        }
        strong {
            color: #2c3e50;
        }
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
    </style>
</head>
<body>
    ${html}
</body>
</html>`;

  statusCallback("PDF 생성 중...");
  const browser2 = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser2.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    const pdfPath = path.join(outputDir, `${safeName}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
      printBackground: true,
    });

    statusCallback(`완료: ${safeName}.pdf`);
    return pdfPath;
  } finally {
    await browser2.close();
  }
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("사용법: node convert-md-to-pdf.js <markdown 파일...>");
    process.exit(1);
  }

  for (const input of inputs) {
    try {
      await convertOne(input, console.log);
    } catch (err) {
      console.error(`변환 실패: ${input}`);
      console.error(err.message || err);
      process.exitCode = 2;
    }
  }

  process.exit(0);
}

if (require.main === module) {
  main();
} else {
  module.exports = { convertOne };
}

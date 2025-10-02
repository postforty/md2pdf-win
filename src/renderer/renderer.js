const dropZone = document.getElementById("drop-zone");
const statusDiv = document.getElementById("status");

// Function to collect conversion options from UI
function getConversionOptions() {
  const showPageNumbers = document.getElementById("page-numbers").checked;

  return {
    showPageNumbers: showPageNumbers,
  };
}



function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Prevent default drag behaviors on the whole window
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  document.body.addEventListener(eventName, preventDefaults, false);
});

// Highlight drop zone when item is dragged over it
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    () => dropZone.classList.add("drag-over"),
    false
  );
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    () => dropZone.classList.remove("drag-over"),
    false
  );
});

// Handle dropped files
dropZone.addEventListener(
  "drop",
  async (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileName = file.name.toLowerCase();

      // 마크다운 파일인지 확인
      if (fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
        statusDiv.textContent = `📄 파일 선택됨: ${file.name}`;

        // 디버깅을 위한 로그
        console.log("File object:", file);
        console.log("File path:", file.path);
        console.log("File name:", file.name);

        try {
          // Get conversion options from UI
          const options = getConversionOptions();

          // Electron에서는 file.path가 있어야 함
          if (
            file.path &&
            typeof file.path === "string" &&
            file.path.trim() !== ""
          ) {
            console.log("Sending file path:", file.path);
            console.log("Conversion options:", options);
            window.electronAPI.sendFilePath(file.path, options);
          } else {
            console.log(
              "No file path available, using file content with warning"
            );
            // 파일 내용을 읽어서 전달하되, 이미지 경로 문제 경고
            const content = await file.text();

            // 이미지 참조가 있는지 확인
            const hasImages = /!\[.*?\]\((?!data:|https?:\/\/).*?\)/g.test(
              content
            );
            if (hasImages) {
              statusDiv.textContent = `⚠️ 이미지가 포함된 파일입니다. 파일 탐색기를 사용하면 이미지가 정확히 표시됩니다.`;
              setTimeout(() => {
                statusDiv.textContent = `📄 파일 선택됨: ${file.name}`;
              }, 3000);
            }

            window.electronAPI.sendFileContent(
              {
                name: file.name,
                content: content,
                originalPath: null, // 드래그앤드롭에서는 원본 경로를 알 수 없음
              },
              options
            );
          }
        } catch (error) {
          console.error("Error processing file:", error);
          statusDiv.textContent = `❌ 파일 처리 중 오류가 발생했습니다`;
          setTimeout(() => {
            statusDiv.textContent = "📁 파일을 기다리는 중...";
          }, 3000);
        }
      } else {
        statusDiv.textContent = `❌ 마크다운 파일만 지원됩니다 (.md, .markdown)`;
        setTimeout(() => {
          statusDiv.textContent = "📁 파일을 기다리는 중...";
        }, 3000);
      }
    }
  },
  false
);

// Handle click to open file dialog
dropZone.addEventListener("click", async () => {
  try {
    statusDiv.textContent = "📂 파일 선택 대화상자 열기...";
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
      const fileName = filePath.split(/[\\/]/).pop();
      statusDiv.textContent = `📄 파일 선택됨: ${fileName}`;

      // Get conversion options from UI
      const options = getConversionOptions();
      console.log("Conversion options:", options);
      window.electronAPI.sendFilePath(filePath, options);
    } else {
      statusDiv.textContent = "📁 파일을 기다리는 중...";
    }
  } catch (error) {
    console.error("File dialog error:", error);
    statusDiv.textContent = "❌ 파일 선택 중 오류가 발생했습니다";
    setTimeout(() => {
      statusDiv.textContent = "📁 파일을 기다리는 중...";
    }, 3000);
  }
});

// Listen for status updates from the main process
window.electronAPI.onUpdateStatus((message) => {
  statusDiv.textContent = message;
});



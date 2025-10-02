const dropZone = document.getElementById("drop-zone");
const statusDiv = document.getElementById("status");

// Function to collect conversion options from UI
function getConversionOptions() {
  const showPageNumbers = document.getElementById("page-numbers").checked;
  const startNumberInput = document.getElementById("start-number");

  // 시작 번호 검증 및 기본값 처리
  let startNumber = 1; // 기본값

  // 페이지 번호 표시가 활성화된 경우에만 시작 번호 처리
  if (showPageNumbers) {
    const inputValue = startNumberInput.value.trim();

    // 빈 값이 아닌 경우 검증 후 적용
    if (inputValue !== "") {
      const numValue = parseInt(inputValue, 10);
      // 유효한 범위(1-9999) 내의 숫자인 경우에만 적용
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 9999) {
        startNumber = numValue;
      }
      // 유효하지 않은 값인 경우 기본값 1 유지 (로그 출력)
      else {
        console.warn(
          `Invalid start number "${inputValue}", using default value 1`
        );
      }
    }
  }
  // 페이지 번호 표시가 비활성화된 경우 시작 번호는 무시되고 기본값 1 사용

  return {
    showPageNumbers: showPageNumbers,
    startPageNumber: startNumber,
  };
}

// 입력 검증 함수들
function validateStartNumber(value) {
  const numValue = parseInt(value, 10);

  // 빈 값은 허용 (기본값 1 사용)
  if (value === "" || value === null || value === undefined) {
    return { isValid: true, value: 1, message: "" };
  }

  // 숫자가 아닌 경우
  if (isNaN(numValue)) {
    return {
      isValid: false,
      value: null,
      message: "숫자만 입력할 수 있습니다",
    };
  }

  // 범위 검증 (1-9999)
  if (numValue < 1) {
    return {
      isValid: false,
      value: null,
      message: "1 이상의 숫자를 입력하세요",
    };
  }

  if (numValue > 9999) {
    return {
      isValid: false,
      value: null,
      message: "9999 이하의 숫자를 입력하세요",
    };
  }

  return { isValid: true, value: numValue, message: "" };
}

function sanitizeNumericInput(input) {
  // 숫자가 아닌 문자 제거 (음수 부호 제외하고 처리)
  let sanitized = input.replace(/[^\d]/g, "");

  // 빈 문자열이면 그대로 반환
  if (sanitized === "") {
    return "";
  }

  // 숫자로 변환하여 범위 체크
  const numValue = parseInt(sanitized, 10);

  // 최대값 초과 시 자동으로 최대값으로 조정
  if (numValue > 9999) {
    return "9999";
  }

  return sanitized;
}

function applyValidationFeedback(inputElement, validation) {
  if (validation.isValid) {
    inputElement.classList.remove("invalid");
    inputElement.setCustomValidity("");
    inputElement.title = "";
  } else {
    inputElement.classList.add("invalid");
    inputElement.setCustomValidity(validation.message);
    inputElement.title = validation.message;
  }
}

// 페이지 번호 표시 옵션과 시작 번호 필드 연동
function setupOptionInteractions() {
  const pageNumbersCheckbox = document.getElementById("page-numbers");
  const startNumberGroup = document.getElementById("start-number-group");
  const startNumberInput = document.getElementById("start-number");

  // 페이지 번호 표시 옵션 변경 시 (향상된 연동)
  pageNumbersCheckbox.addEventListener("change", function () {
    const isEnabled = this.checked;

    if (isEnabled) {
      startNumberGroup.classList.remove("disabled");
      startNumberInput.disabled = false;

      // 활성화 시 포커스 이동 (사용자 편의성)
      setTimeout(() => {
        startNumberInput.focus();
      }, 100);
    } else {
      startNumberGroup.classList.add("disabled");
      startNumberInput.disabled = true;

      // 비활성화 시 검증 상태 초기화
      startNumberInput.classList.remove("invalid");
      startNumberInput.setCustomValidity("");
    }

    // 상태 변경 로깅 (디버깅용)
    console.log(`Page numbers ${isEnabled ? "enabled" : "disabled"}`);
  });

  // 실시간 입력 검증 및 자동 수정
  startNumberInput.addEventListener("input", function (e) {
    // 숫자가 아닌 문자 자동 제거
    const sanitized = sanitizeNumericInput(this.value);
    if (this.value !== sanitized) {
      this.value = sanitized;
    }

    // 입력 검증 및 시각적 피드백
    const validation = validateStartNumber(this.value);
    applyValidationFeedback(this, validation);
  });

  // 키 입력 시 숫자가 아닌 문자 차단
  startNumberInput.addEventListener("keypress", function (e) {
    // Enter 키 처리
    if (e.key === "Enter") {
      this.blur();
      return;
    }

    // 숫자, 백스페이스, 삭제, 탭, 화살표 키만 허용
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];
    const isNumber = /^[0-9]$/.test(e.key);

    if (!isNumber && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  });

  // 붙여넣기 시 숫자가 아닌 문자 제거
  startNumberInput.addEventListener("paste", function (e) {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData(
      "text"
    );
    const sanitized = sanitizeNumericInput(pastedText);
    this.value = sanitized;

    // 검증 및 피드백 적용
    const validation = validateStartNumber(sanitized);
    applyValidationFeedback(this, validation);
  });

  // 포커스 시 전체 선택
  startNumberInput.addEventListener("focus", function () {
    // 약간의 지연을 두어 클릭 이벤트와 충돌 방지
    setTimeout(() => {
      this.select();
    }, 10);
  });

  // 포커스 해제 시 빈 값 처리
  startNumberInput.addEventListener("blur", function () {
    if (this.value === "" || this.value === "0") {
      this.value = "1";
    }

    // 최종 검증
    const validation = validateStartNumber(this.value);
    applyValidationFeedback(this, validation);
  });

  // 키보드 네비게이션 향상 (화살표 키로 값 증감)
  startNumberInput.addEventListener("keydown", function (e) {
    // 위/아래 화살표로 값 증감
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const currentValue = parseInt(this.value, 10) || 1;
      const newValue = Math.min(currentValue + 1, 9999);
      this.value = newValue.toString();

      const validation = validateStartNumber(this.value);
      applyValidationFeedback(this, validation);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const currentValue = parseInt(this.value, 10) || 1;
      const newValue = Math.max(currentValue - 1, 1);
      this.value = newValue.toString();

      const validation = validateStartNumber(this.value);
      applyValidationFeedback(this, validation);
    }
  });

  // 마우스 휠로 값 증감 (포커스된 상태에서)
  startNumberInput.addEventListener("wheel", function (e) {
    if (document.activeElement === this && !this.disabled) {
      e.preventDefault();
      const currentValue = parseInt(this.value, 10) || 1;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newValue = Math.max(1, Math.min(9999, currentValue + delta));

      this.value = newValue.toString();
      const validation = validateStartNumber(this.value);
      applyValidationFeedback(this, validation);
    }
  });

  // 더블클릭으로 빠른 값 설정 (자주 사용되는 값들로 순환)
  startNumberInput.addEventListener("dblclick", function () {
    const commonValues = [1, 2, 3, 5, 10];
    const currentValue = parseInt(this.value, 10) || 1;
    const currentIndex = commonValues.indexOf(currentValue);
    const nextIndex = (currentIndex + 1) % commonValues.length;

    this.value = commonValues[nextIndex].toString();
    const validation = validateStartNumber(this.value);
    applyValidationFeedback(this, validation);

    // 값 변경 후 선택 상태 유지
    this.select();
  });

  // 초기 상태 설정
  if (!pageNumbersCheckbox.checked) {
    startNumberGroup.classList.add("disabled");
    startNumberInput.disabled = true;
  }

  // 초기 값 검증
  const initialValidation = validateStartNumber(startNumberInput.value);
  applyValidationFeedback(startNumberInput, initialValidation);

  // 접근성 향상을 위한 ARIA 속성 설정
  startNumberInput.setAttribute("aria-label", "페이지 시작 번호 (1-9999)");
  startNumberInput.setAttribute("aria-describedby", "start-number-help");

  // 도움말 텍스트 추가 (화면 리더용)
  if (!document.getElementById("start-number-help")) {
    const helpText = document.createElement("div");
    helpText.id = "start-number-help";
    helpText.className = "sr-only";
    helpText.textContent =
      "1부터 9999 사이의 숫자를 입력하세요. 화살표 키로 값을 조정할 수 있습니다.";
    startNumberGroup.appendChild(helpText);
  }
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

// DOM 로드 후 초기화
document.addEventListener("DOMContentLoaded", setupOptionInteractions);

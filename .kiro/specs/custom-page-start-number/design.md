# Design Document

## Overview

기존 페이지 번호 표시 기능을 확장하여 사용자가 페이지 시작 번호를 직접 지정할 수 있는 기능을 추가합니다. 이 기능은 현재 구현된 페이지 번호 표시 시스템과 완전히 통합되며, Puppeteer의 footerTemplate에서 JavaScript를 활용하여 동적으로 페이지 번호를 계산합니다.

## Architecture

### 시스템 구성 요소

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Renderer UI   │───▶│   Main Process   │───▶│  PDF Converter  │
│  (시작번호 입력) │    │  (옵션 전달)     │    │  (Puppeteer +   │
│  (페이지번호 옵션)│    │                  │    │   동적 계산)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 데이터 흐름

1. **사용자 입력**: 렌더러에서 페이지 번호 표시 옵션 + 시작 번호 입력
2. **입력 검증**: 클라이언트 사이드에서 실시간 검증 (양의 정수, 최대값 제한)
3. **옵션 전달**: IPC를 통해 메인 프로세스로 확장된 옵션 객체 전달
4. **PDF 생성**: convert-md-to-pdf.js에서 시작 번호를 반영한 footerTemplate 생성
5. **동적 계산**: Puppeteer 내부에서 JavaScript로 실제 페이지 번호 계산

## Components and Interfaces

### 1. UI 컴포넌트 확장 (renderer/index.html)

#### 기존 옵션 패널 확장

현재 옵션 패널에 시작 번호 입력 필드를 추가합니다:

```html
<div id="options-panel">
  <!-- 기존 페이지 번호 표시 체크박스 -->
  <label class="option-checkbox">
    <input type="checkbox" id="page-numbers" checked />
    <span class="checkmark"></span>
    페이지 번호 표시
  </label>

  <!-- 새로 추가되는 시작 번호 입력 필드 -->
  <div class="option-group" id="start-number-group">
    <label for="start-number" class="option-label">시작 번호:</label>
    <input
      type="number"
      id="start-number"
      min="1"
      max="9999"
      value="1"
      class="number-input"
      placeholder="1"
    />
  </div>
</div>
```

#### 새로운 CSS 스타일

```css
.option-group {
  display: flex;
  align-items: center;
  margin-top: 12px;
  gap: 10px;
}

.option-label {
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
  min-width: 80px;
}

.number-input {
  width: 80px;
  padding: 6px 10px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  transition: all 0.2s ease;
  background: #fff;
}

.number-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.number-input:invalid {
  border-color: #e74c3c;
  background-color: #fdf2f2;
}

.number-input:disabled {
  background-color: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
}

#start-number-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

### 2. 렌더러 프로세스 확장 (renderer/renderer.js)

#### 옵션 수집 함수 확장

```javascript
function getConversionOptions() {
  const showPageNumbers = document.getElementById("page-numbers").checked;
  const startNumberInput = document.getElementById("start-number");

  // 시작 번호 검증 및 기본값 처리
  let startNumber = 1;
  if (showPageNumbers && startNumberInput.value) {
    const inputValue = parseInt(startNumberInput.value, 10);
    if (inputValue >= 1 && inputValue <= 9999) {
      startNumber = inputValue;
    }
  }

  return {
    showPageNumbers: showPageNumbers,
    startPageNumber: startNumber,
  };
}
```

#### UI 상호작용 로직

```javascript
// 페이지 번호 표시 옵션과 시작 번호 필드 연동
function setupOptionInteractions() {
  const pageNumbersCheckbox = document.getElementById("page-numbers");
  const startNumberGroup = document.getElementById("start-number-group");
  const startNumberInput = document.getElementById("start-number");

  // 페이지 번호 표시 옵션 변경 시
  pageNumbersCheckbox.addEventListener("change", function () {
    if (this.checked) {
      startNumberGroup.classList.remove("disabled");
      startNumberInput.disabled = false;
    } else {
      startNumberGroup.classList.add("disabled");
      startNumberInput.disabled = true;
    }
  });

  // 시작 번호 입력 시 실시간 검증
  startNumberInput.addEventListener("input", function () {
    const value = parseInt(this.value, 10);
    if (isNaN(value) || value < 1 || value > 9999) {
      this.setCustomValidity("1부터 9999 사이의 숫자를 입력하세요");
    } else {
      this.setCustomValidity("");
    }
  });

  // Enter 키 처리
  startNumberInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      this.blur();
    }
  });

  // 포커스 시 전체 선택
  startNumberInput.addEventListener("focus", function () {
    this.select();
  });

  // 초기 상태 설정
  if (!pageNumbersCheckbox.checked) {
    startNumberGroup.classList.add("disabled");
    startNumberInput.disabled = true;
  }
}

// DOM 로드 후 초기화
document.addEventListener("DOMContentLoaded", setupOptionInteractions);
```

### 3. 메인 프로세스 (main/main.js)

기존 IPC 핸들러는 이미 옵션 객체를 받도록 구현되어 있으므로 추가 수정이 필요하지 않습니다. 확장된 옵션 객체가 자동으로 전달됩니다.

### 4. PDF 변환기 확장 (utils/convert-md-to-pdf.js)

#### convertOne 함수 옵션 확장

```javascript
async function convertOne(
  inputPath,
  statusCallback = () => {},
  originalPath = null,
  options = {
    showPageNumbers: true,
    startPageNumber: 1  // 새로 추가되는 옵션
  }
)
```

#### Puppeteer footerTemplate 동적 생성

```javascript
// 페이지 번호 표시 옵션 추가
if (options.showPageNumbers) {
  const startNumber = options.startPageNumber || 1;

  pdfOptions.displayHeaderFooter = true;
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
      <span style="
        font-family: inherit;
        font-size: 10px;
        color: #666;
        font-weight: 400;
        letter-spacing: 0.2px;
      ">
        <script>
          document.write(${
            startNumber - 1
          } + parseInt(document.querySelector('.pageNumber').textContent));
        </script>
      </span>
    </div>
  `;
  pdfOptions.headerTemplate = "<div></div>";
}
```

## Data Models

### 확장된 ConversionOptions 인터페이스

```typescript
interface ConversionOptions {
  showPageNumbers: boolean; // 페이지 번호 표시 여부
  startPageNumber: number; // 페이지 시작 번호 (1-9999)
}
```

### 입력 검증 규칙

```javascript
const ValidationRules = {
  startPageNumber: {
    min: 1,
    max: 9999,
    type: "integer",
    required: false,
    default: 1,
  },
};
```

## Error Handling

### 1. 클라이언트 사이드 검증

- **실시간 검증**: 입력 시 즉시 유효성 검사
- **시각적 피드백**: 잘못된 입력 시 빨간 테두리 및 배경색 변경
- **자동 수정**: 범위를 벗어난 값 입력 시 자동으로 최소/최대값으로 조정

### 2. 서버 사이드 안전장치

```javascript
function validateOptions(options) {
  const validated = { ...options };

  // 시작 번호 검증
  if (
    typeof validated.startPageNumber !== "number" ||
    validated.startPageNumber < 1 ||
    validated.startPageNumber > 9999
  ) {
    console.warn("Invalid startPageNumber, using default value 1");
    validated.startPageNumber = 1;
  }

  // 페이지 번호 표시가 비활성화된 경우 시작 번호 무시
  if (!validated.showPageNumbers) {
    validated.startPageNumber = 1;
  }

  return validated;
}
```

### 3. PDF 생성 오류 처리

- **템플릿 오류**: JavaScript 실행 실패 시 기본 페이지 번호로 대체
- **범위 초과**: 매우 큰 시작 번호로 인한 오버플로우 방지
- **호환성**: 기존 옵션 구조와의 하위 호환성 보장

## Testing Strategy

### 1. 단위 테스트

- **옵션 수집**: `getConversionOptions()` 함수의 다양한 입력값 테스트
- **입력 검증**: 유효/무효한 시작 번호 값에 대한 검증 로직 테스트
- **UI 상호작용**: 체크박스와 입력 필드 간의 연동 테스트

### 2. 통합 테스트

- **전체 플로우**: UI 입력 → IPC 전달 → PDF 생성까지의 완전한 테스트
- **다양한 시작 번호**: 1, 5, 100, 9999 등 다양한 값으로 PDF 생성 테스트
- **에지 케이스**: 0, 음수, 10000 등 경계값 테스트

### 3. 사용자 시나리오 테스트

- **기본 사용**: 시작 번호 5로 설정하여 3페이지 문서 생성 (5, 6, 7 표시 확인)
- **옵션 조합**: 페이지 번호 비활성화 시 시작 번호 무시 확인
- **UI 피드백**: 잘못된 값 입력 시 시각적 피드백 확인

## Implementation Details

### Puppeteer footerTemplate JavaScript 실행

Puppeteer의 footerTemplate에서는 제한적인 JavaScript만 실행 가능하므로, 다음과 같은 방식으로 구현합니다:

```javascript
// 방법 1: 간단한 산술 연산 (권장)
const footerTemplate = `
  <div style="...">
    <span>
      <script>
        document.write(${
          startNumber - 1
        } + parseInt(document.querySelector('.pageNumber').textContent));
      </script>
    </span>
  </div>
`;

// 방법 2: CSS counter 활용 (대안)
const footerTemplate = `
  <style>
    .custom-page-number::before {
      counter-reset: page ${startNumber - 1};
      content: counter(page);
    }
  </style>
  <div style="...">
    <span class="custom-page-number pageNumber"></span>
  </div>
`;
```

### 성능 최적화

- **템플릿 캐싱**: 동일한 시작 번호에 대해 템플릿 재사용
- **검증 최적화**: 클라이언트 사이드에서 대부분의 검증 수행
- **메모리 효율성**: 큰 시작 번호로 인한 메모리 사용량 증가 방지

### 접근성 고려사항

- **키보드 네비게이션**: Tab 키로 모든 컨트롤 접근 가능
- **스크린 리더**: 적절한 label과 aria 속성 제공
- **시각적 대비**: 충분한 색상 대비로 가독성 확보

### 국제화 지원

현재는 한국어로 구현되지만, 향후 다국어 지원을 위한 구조:

```javascript
const messages = {
  ko: {
    startNumber: "시작 번호:",
    invalidRange: "1부터 9999 사이의 숫자를 입력하세요",
    showPageNumbers: "페이지 번호 표시",
  },
  en: {
    startNumber: "Start Number:",
    invalidRange: "Please enter a number between 1 and 9999",
    showPageNumbers: "Show Page Numbers",
  },
};
```

### 하위 호환성 보장

- **기존 옵션**: `showPageNumbers`만 있는 기존 옵션 객체 완전 지원
- **기본값**: `startPageNumber`가 없는 경우 자동으로 1 사용
- **API 호환성**: 기존 `convertOne()` 함수 호출 방식 유지

### 확장성 고려

향후 추가될 수 있는 기능들을 위한 구조적 준비:

- **페이지 번호 형식**: "페이지 X", "X/총페이지수" 등
- **위치 옵션**: 하단 중앙, 하단 우측, 상단 등
- **스타일 옵션**: 폰트 크기, 색상 등

이러한 확장을 위해 옵션 구조를 다음과 같이 설계할 수 있습니다:

```typescript
interface PageNumberOptions {
  show: boolean;
  startNumber: number;
  format?: "number" | "page-x" | "x-of-total";
  position?: "bottom-center" | "bottom-right" | "top-center";
  style?: {
    fontSize?: number;
    color?: string;
  };
}
```

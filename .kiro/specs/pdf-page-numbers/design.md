# Design Document

## Overview

PDF 변환 시 페이지 번호 표시 기능을 기존 Markdown to PDF Converter에 통합합니다. 이 기능은 Puppeteer의 PDF 생성 옵션을 활용하여 각 페이지 하단에 페이지 번호를 표시하며, 사용자가 UI를 통해 이 기능을 활성화/비활성화할 수 있도록 합니다.

## Architecture

### 시스템 구성 요소

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Renderer UI   │───▶│   Main Process   │───▶│  PDF Converter  │
│  (페이지 번호    │    │  (옵션 전달)     │    │  (Puppeteer)    │
│   옵션 UI)      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 데이터 흐름

1. **사용자 입력**: 렌더러 프로세스에서 페이지 번호 옵션 선택
2. **옵션 전달**: IPC를 통해 메인 프로세스로 옵션 전달
3. **PDF 생성**: convert-md-to-pdf.js에서 Puppeteer 옵션에 페이지 번호 설정 적용
4. **결과 반환**: 생성된 PDF 파일 경로 반환

## Components and Interfaces

### 1. UI 컴포넌트 (renderer/index.html)

#### 페이지 번호 옵션 체크박스

- **위치**: 드롭존 하단, 상태 메시지 위
- **기본값**: 체크됨 (페이지 번호 표시)
- **스타일**: 기존 UI와 일관된 디자인

```html
<div id="options-panel">
  <label class="option-checkbox">
    <input type="checkbox" id="page-numbers" checked />
    <span class="checkmark"></span>
    페이지 번호 표시
  </label>
</div>
```

### 2. 렌더러 프로세스 (renderer/renderer.js)

#### 옵션 수집 함수

```javascript
function getConversionOptions() {
  return {
    showPageNumbers: document.getElementById("page-numbers").checked,
  };
}
```

#### 파일 전송 시 옵션 포함

- 기존 `sendFilePath()` 및 `sendFileContent()` 호출 시 옵션 객체 추가
- IPC 메시지에 변환 옵션 포함

### 3. 메인 프로세스 (main/main.js)

#### IPC 핸들러 수정

```javascript
// 기존 파일 처리 핸들러에 옵션 매개변수 추가
ipcMain.handle("send-file-path", async (event, filePath, options) => {
  // convertOne 함수에 옵션 전달
});
```

### 4. PDF 변환기 (utils/convert-md-to-pdf.js)

#### convertOne 함수 시그니처 수정

```javascript
async function convertOne(
  inputPath,
  statusCallback = () => {},
  originalPath = null,
  options = { showPageNumbers: true }
)
```

#### Puppeteer PDF 옵션 설정

```javascript
const pdfOptions = {
  path: pdfPath,
  format: "A4",
  margin: {
    top: "20mm",
    right: "20mm",
    bottom: options.showPageNumbers ? "25mm" : "20mm", // 페이지 번호 공간 확보
    left: "20mm",
  },
  printBackground: true,
  preferCSSPageSize: true,
};

// 페이지 번호 표시 옵션 추가
if (options.showPageNumbers) {
  pdfOptions.displayHeaderFooter = true;
  pdfOptions.footerTemplate = `
    <div style="font-size: 10px; color: #666; text-align: center; width: 100%; margin: 0 auto;">
      <span class="pageNumber"></span>
    </div>
  `;
  pdfOptions.headerTemplate = "<div></div>"; // 빈 헤더
}
```

## Data Models

### ConversionOptions 인터페이스

```typescript
interface ConversionOptions {
  showPageNumbers: boolean; // 페이지 번호 표시 여부
}
```

### IPC 메시지 구조

```javascript
// 파일 경로 전송 시
{
  type: 'file-path',
  filePath: string,
  options: ConversionOptions
}

// 파일 내용 전송 시
{
  type: 'file-content',
  name: string,
  content: string,
  originalPath: string | null,
  options: ConversionOptions
}
```

## Error Handling

### 1. 옵션 검증

- UI에서 옵션 값이 유효하지 않은 경우 기본값 사용
- 타입 검증을 통한 안전한 옵션 처리

### 2. PDF 생성 오류

- 페이지 번호 템플릿 오류 시 기본 템플릿으로 대체
- Puppeteer 옵션 오류 시 페이지 번호 없이 생성 후 사용자에게 알림

### 3. 호환성 처리

- 기존 코드와의 하위 호환성 유지
- 옵션이 전달되지 않은 경우 기본값 적용

## Testing Strategy

### 1. 단위 테스트

- `getConversionOptions()` 함수 테스트
- PDF 옵션 생성 로직 테스트
- 페이지 번호 템플릿 렌더링 테스트

### 2. 통합 테스트

- UI 옵션 변경 → IPC 전달 → PDF 생성 전체 플로우 테스트
- 다양한 마크다운 파일 크기에 대한 페이지 번호 표시 테스트

### 3. 사용자 시나리오 테스트

- 단일 페이지 문서의 페이지 번호 표시
- 다중 페이지 문서의 연속 페이지 번호
- 옵션 활성화/비활성화 시 결과 차이 확인

## Implementation Details

### 페이지 번호 스타일링

```css
/* Puppeteer footerTemplate에 적용될 스타일 */
.footer-template {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Malgun Gothic", sans-serif;
  font-size: 10px;
  color: #666;
  text-align: center;
  width: 100%;
  margin: 0 auto;
  padding: 5px 0;
}
```

### UI 옵션 패널 스타일링

```css
#options-panel {
  margin: 20px 0;
  padding: 15px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.option-checkbox {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #2c3e50;
  cursor: pointer;
}

.option-checkbox input[type="checkbox"] {
  margin-right: 8px;
  transform: scale(1.2);
}
```

### 하위 호환성 보장

- 기존 `convertOne()` 함수 호출 시 옵션 매개변수가 없어도 정상 동작
- 기본값으로 페이지 번호 표시 활성화
- 기존 IPC 메시지 구조와 호환되는 확장된 구조 사용

### 성능 고려사항

- 페이지 번호 템플릿은 간단한 HTML로 구성하여 렌더링 성능 최적화
- 옵션 처리 로직은 PDF 생성 전에 한 번만 실행
- 기존 변환 성능에 미치는 영향 최소화

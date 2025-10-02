# 페이지 번호 비활성화 테스트 문서

이 문서는 페이지 번호 표시가 비활성화되었을 때 시작 번호가 무시되는지 확인하기 위한 테스트 문서입니다.

## 테스트 목적

페이지 번호 표시 옵션이 비활성화된 경우, 시작 번호 설정과 관계없이 페이지 번호가 표시되지 않는지 확인합니다.

## 테스트 시나리오

### 시나리오 1: 페이지 번호 비활성화 + 시작 번호 1

- **설정**: 페이지 번호 표시 = OFF, 시작 번호 = 1
- **예상 결과**: 페이지 번호 표시되지 않음

### 시나리오 2: 페이지 번호 비활성화 + 시작 번호 5

- **설정**: 페이지 번호 표시 = OFF, 시작 번호 = 5
- **예상 결과**: 페이지 번호 표시되지 않음 (시작 번호 무시)

### 시나리오 3: 페이지 번호 비활성화 + 시작 번호 100

- **설정**: 페이지 번호 표시 = OFF, 시작 번호 = 100
- **예상 결과**: 페이지 번호 표시되지 않음 (시작 번호 무시)

### 시나리오 4: 페이지 번호 비활성화 + 시작 번호 9999

- **설정**: 페이지 번호 표시 = OFF, 시작 번호 = 9999
- **예상 결과**: 페이지 번호 표시되지 않음 (시작 번호 무시)

## 검증 포인트

1. **완전한 무시**: 시작 번호 값과 관계없이 페이지 번호가 표시되지 않아야 함
2. **하단 여백**: 페이지 번호 공간이 없으므로 하단 여백이 20mm로 설정되어야 함
3. **옵션 처리**: validateOptions 함수에서 showPageNumbers가 false일 때 startPageNumber를 1로 리셋
4. **로그 메시지**: 페이지 번호 비활성화 시 적절한 경고 메시지 출력

## 추가 내용

이 문서는 여러 페이지로 구성되어 페이지 번호 비활성화 기능을 더 철저히 테스트할 수 있도록 합니다.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### 기능 설명

페이지 번호 비활성화 기능은 다음과 같이 동작합니다:

1. **UI 레벨**: 페이지 번호 체크박스가 해제되면 시작 번호 입력 필드가 비활성화됨
2. **옵션 수집**: getConversionOptions()에서 showPageNumbers가 false면 startPageNumber는 무시됨
3. **서버 검증**: validateOptions()에서 추가 검증 및 경고 메시지 출력
4. **PDF 생성**: displayHeaderFooter가 false로 설정되어 페이지 번호 미표시

### 코드 동작 확인

```javascript
// renderer.js의 getConversionOptions() 함수
if (showPageNumbers) {
  // 시작 번호 처리 로직
} else {
  // 페이지 번호 비활성화 시 시작 번호 무시
}

// convert-md-to-pdf.js의 validateOptions() 함수
if (!validated.showPageNumbers) {
  if (originalStartNumber && originalStartNumber !== 1) {
    warnings.push(
      "페이지 번호 표시가 비활성화되어 있어 시작 번호가 무시됩니다."
    );
  }
  validated.startPageNumber = 1;
}
```

## 테스트 체크리스트

이 문서로 테스트할 때 다음 사항들을 확인해야 합니다:

- [ ] 페이지 번호가 전혀 표시되지 않음
- [ ] 시작 번호 값과 관계없이 동일한 결과
- [ ] 하단 여백이 적절히 설정됨 (25mm → 20mm)
- [ ] 콘솔에 적절한 경고 메시지 출력
- [ ] PDF 파일 크기나 생성 시간에 영향 없음

### 추가 섹션

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## 마무리

페이지 번호 비활성화 테스트를 통해 옵션 간의 올바른 상호작용을 검증할 수 있습니다.

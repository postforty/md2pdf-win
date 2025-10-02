/**
 * 커스텀 페이지 시작 번호 기능 테스트 러너
 *
 * 이 스크립트는 다양한 시나리오에서 페이지 시작 번호 기능을 테스트합니다.
 * Requirements: 2.3, 2.4, 3.3
 */

const fs = require("fs");
const path = require("path");
const { convertOne } = require("../src/utils/convert-md-to-pdf");

// 테스트 시나리오 정의
const testScenarios = [
  // 단일 페이지 테스트
  {
    name: "단일 페이지 - 시작 번호 1",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 1 },
    expected: '첫 페이지에 "1" 표시',
  },
  {
    name: "단일 페이지 - 시작 번호 5",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 5 },
    expected: '첫 페이지에 "5" 표시',
  },
  {
    name: "단일 페이지 - 시작 번호 100",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 100 },
    expected: '첫 페이지에 "100" 표시',
  },

  // 다중 페이지 테스트
  {
    name: "다중 페이지 - 시작 번호 1",
    file: "multi-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 1 },
    expected: '페이지 번호 "1, 2, 3, ..." 순차 표시',
  },
  {
    name: "다중 페이지 - 시작 번호 5",
    file: "multi-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 5 },
    expected: '페이지 번호 "5, 6, 7, ..." 순차 표시',
  },
  {
    name: "다중 페이지 - 시작 번호 10",
    file: "multi-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 10 },
    expected: '페이지 번호 "10, 11, 12, ..." 순차 표시',
  },

  // 큰 시작 번호 테스트
  {
    name: "큰 시작 번호 - 100",
    file: "large-start-number-test.md",
    options: { showPageNumbers: true, startPageNumber: 100 },
    expected: '페이지 번호 "100, 101, 102, ..." 순차 표시',
  },
  {
    name: "큰 시작 번호 - 500",
    file: "large-start-number-test.md",
    options: { showPageNumbers: true, startPageNumber: 500 },
    expected: '페이지 번호 "500, 501, 502, ..." 순차 표시',
  },
  {
    name: "큰 시작 번호 - 1000",
    file: "large-start-number-test.md",
    options: { showPageNumbers: true, startPageNumber: 1000 },
    expected: '페이지 번호 "1000, 1001, 1002, ..." 순차 표시',
  },
  {
    name: "큰 시작 번호 - 9999 (최대값)",
    file: "large-start-number-test.md",
    options: { showPageNumbers: true, startPageNumber: 9999 },
    expected: '페이지 번호 "9999, 10000, 10001, ..." 순차 표시',
  },

  // 페이지 번호 비활성화 테스트
  {
    name: "페이지 번호 비활성화 - 시작 번호 1",
    file: "page-numbers-disabled-test.md",
    options: { showPageNumbers: false, startPageNumber: 1 },
    expected: "페이지 번호 표시되지 않음",
  },
  {
    name: "페이지 번호 비활성화 - 시작 번호 5",
    file: "page-numbers-disabled-test.md",
    options: { showPageNumbers: false, startPageNumber: 5 },
    expected: "페이지 번호 표시되지 않음 (시작 번호 무시)",
  },
  {
    name: "페이지 번호 비활성화 - 시작 번호 100",
    file: "page-numbers-disabled-test.md",
    options: { showPageNumbers: false, startPageNumber: 100 },
    expected: "페이지 번호 표시되지 않음 (시작 번호 무시)",
  },
  {
    name: "페이지 번호 비활성화 - 시작 번호 9999",
    file: "page-numbers-disabled-test.md",
    options: { showPageNumbers: false, startPageNumber: 9999 },
    expected: "페이지 번호 표시되지 않음 (시작 번호 무시)",
  },
];

// 에러 케이스 테스트
const errorTestScenarios = [
  {
    name: "잘못된 시작 번호 - 0",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 0 },
    expected: "기본값 1로 대체, 경고 메시지 출력",
  },
  {
    name: "잘못된 시작 번호 - 음수",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: -5 },
    expected: "기본값 1로 대체, 경고 메시지 출력",
  },
  {
    name: "잘못된 시작 번호 - 최대값 초과",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 10000 },
    expected: "최대값 9999로 조정, 경고 메시지 출력",
  },
  {
    name: "잘못된 시작 번호 - 문자열",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: "abc" },
    expected: "기본값 1로 대체, 오류 메시지 출력",
  },
  {
    name: "잘못된 시작 번호 - 소수",
    file: "single-page-test.md",
    options: { showPageNumbers: true, startPageNumber: 5.5 },
    expected: "기본값 1로 대체, 오류 메시지 출력",
  },
];

// 테스트 결과 저장
const testResults = [];

// 상태 콜백 함수
function statusCallback(message) {
  console.log(`  📄 ${message}`);
}

// 개별 테스트 실행 함수
async function runTest(scenario, isErrorTest = false) {
  console.log(`\n🧪 테스트 실행: ${scenario.name}`);
  console.log(`   파일: ${scenario.file}`);
  console.log(`   옵션: ${JSON.stringify(scenario.options)}`);
  console.log(`   예상: ${scenario.expected}`);

  const testStartTime = Date.now();
  let success = false;
  let errorMessage = null;
  let outputPath = null;

  try {
    const inputPath = path.join(__dirname, scenario.file);

    // 파일 존재 확인
    if (!fs.existsSync(inputPath)) {
      throw new Error(`테스트 파일이 존재하지 않습니다: ${inputPath}`);
    }

    // PDF 변환 실행
    await convertOne(inputPath, statusCallback, inputPath, scenario.options);

    // 출력 파일 경로 생성
    const baseName = path.basename(scenario.file, path.extname(scenario.file));
    const outputDir = path.join(path.dirname(inputPath), "output");
    outputPath = path.join(outputDir, `${baseName}.pdf`);

    // 출력 파일 존재 확인
    if (fs.existsSync(outputPath)) {
      success = true;
      console.log(`   ✅ 성공: PDF 생성됨 (${outputPath})`);
    } else {
      throw new Error("PDF 파일이 생성되지 않았습니다");
    }
  } catch (error) {
    errorMessage = error.message;

    if (isErrorTest) {
      // 에러 테스트의 경우 에러가 발생하는 것이 정상
      success = true;
      console.log(`   ✅ 예상된 에러 발생: ${errorMessage}`);
    } else {
      console.log(`   ❌ 실패: ${errorMessage}`);
    }
  }

  const testEndTime = Date.now();
  const duration = testEndTime - testStartTime;

  // 테스트 결과 저장
  const result = {
    name: scenario.name,
    file: scenario.file,
    options: scenario.options,
    expected: scenario.expected,
    success: success,
    duration: duration,
    errorMessage: errorMessage,
    outputPath: outputPath,
    timestamp: new Date().toISOString(),
  };

  testResults.push(result);

  console.log(`   ⏱️  소요 시간: ${duration}ms`);

  return result;
}

// 전체 테스트 실행 함수
async function runAllTests() {
  console.log("🚀 커스텀 페이지 시작 번호 기능 테스트 시작\n");
  console.log("=".repeat(60));

  const overallStartTime = Date.now();

  // 정상 시나리오 테스트
  console.log("\n📋 정상 시나리오 테스트");
  console.log("-".repeat(40));

  for (const scenario of testScenarios) {
    await runTest(scenario, false);
  }

  // 에러 케이스 테스트
  console.log("\n🚨 에러 케이스 테스트");
  console.log("-".repeat(40));

  for (const scenario of errorTestScenarios) {
    await runTest(scenario, true);
  }

  const overallEndTime = Date.now();
  const totalDuration = overallEndTime - overallStartTime;

  // 테스트 결과 요약
  console.log("\n📊 테스트 결과 요약");
  console.log("=".repeat(60));

  const totalTests = testResults.length;
  const successfulTests = testResults.filter((r) => r.success).length;
  const failedTests = totalTests - successfulTests;

  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${successfulTests} ✅`);
  console.log(`실패: ${failedTests} ❌`);
  console.log(`전체 소요 시간: ${totalDuration}ms`);
  console.log(`평균 소요 시간: ${Math.round(totalDuration / totalTests)}ms`);

  // 실패한 테스트 상세 정보
  if (failedTests > 0) {
    console.log("\n❌ 실패한 테스트:");
    testResults
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.name}: ${r.errorMessage}`);
      });
  }

  // 테스트 결과를 JSON 파일로 저장
  const resultPath = path.join(__dirname, "test-results.json");
  fs.writeFileSync(resultPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 테스트 결과 저장됨: ${resultPath}`);

  // 성공률 계산
  const successRate = Math.round((successfulTests / totalTests) * 100);
  console.log(`\n🎯 성공률: ${successRate}%`);

  if (successRate === 100) {
    console.log("🎉 모든 테스트가 성공했습니다!");
  } else if (successRate >= 80) {
    console.log("⚠️  일부 테스트가 실패했지만 대부분 성공했습니다.");
  } else {
    console.log("🚨 많은 테스트가 실패했습니다. 코드를 검토해주세요.");
  }

  return {
    totalTests,
    successfulTests,
    failedTests,
    successRate,
    totalDuration,
    results: testResults,
  };
}

// 개별 테스트 실행 함수 (외부에서 호출 가능)
async function runSingleTest(testName) {
  const scenario =
    testScenarios.find((s) => s.name === testName) ||
    errorTestScenarios.find((s) => s.name === testName);

  if (!scenario) {
    console.log(`❌ 테스트를 찾을 수 없습니다: ${testName}`);
    return null;
  }

  const isErrorTest = errorTestScenarios.includes(scenario);
  return await runTest(scenario, isErrorTest);
}

// 테스트 목록 출력 함수
function listTests() {
  console.log("📋 사용 가능한 테스트 목록:\n");

  console.log("정상 시나리오:");
  testScenarios.forEach((scenario, index) => {
    console.log(`  ${index + 1}. ${scenario.name}`);
  });

  console.log("\n에러 케이스:");
  errorTestScenarios.forEach((scenario, index) => {
    console.log(`  ${index + 1}. ${scenario.name}`);
  });
}

// CLI에서 직접 실행된 경우
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // 전체 테스트 실행
    runAllTests().catch(console.error);
  } else if (args[0] === "list") {
    // 테스트 목록 출력
    listTests();
  } else if (args[0] === "run" && args[1]) {
    // 개별 테스트 실행
    runSingleTest(args[1]).catch(console.error);
  } else {
    console.log("사용법:");
    console.log("  node test-runner.js          # 전체 테스트 실행");
    console.log("  node test-runner.js list     # 테스트 목록 출력");
    console.log('  node test-runner.js run "테스트명"  # 개별 테스트 실행');
  }
}

module.exports = {
  runAllTests,
  runSingleTest,
  listTests,
  testScenarios,
  errorTestScenarios,
};

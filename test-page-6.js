const { convertOne } = require("./src/utils/convert-md-to-pdf");
const path = require("path");

async function test() {
  try {
    const testFile = path.join(__dirname, "page-number-test.md");
    const options = { showPageNumbers: true, startPageNumber: 6 };

    console.log("🧪 시작 번호 6으로 테스트 실행...");
    console.log("옵션:", options);

    const result = await convertOne(
      testFile,
      (msg) => console.log("📄", msg),
      testFile,
      options
    );
    console.log("✅ 테스트 완료:", result);
  } catch (error) {
    console.error("❌ 테스트 실패:", error.message);
  }
}

test();

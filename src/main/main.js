const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../renderer/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Open DevTools only when explicitly requested to avoid Autofill.* DevTools warnings
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "undocked" });
  }

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Markdown Files", extensions: ["md", "markdown"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (canceled) {
    return undefined;
  } else {
    return filePaths[0];
  }
});

const { convertOne } = require("../utils/convert-md-to-pdf.js");

// 옵션 검증 및 기본값 처리 함수


// 파일 내용 처리를 위한 핸들러
ipcMain.handle("handle-file-content", async (event, fileData, options) => {
  const webContents = event.sender;

  const statusCallback = (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cleanMessage = message.replace(/\\/g, "/").split("/").pop();
      webContents.send("update-status", cleanMessage);
    }
  };

  try {
    console.log("Received file data:", fileData);
    console.log("Received options:", options);

    console.log("Received options:", options);

    if (!fileData || !fileData.name || !fileData.content) {
      statusCallback(`❌ 잘못된 파일 데이터입니다`);
      return;
    }

    // 사용자 데스크톱에 임시 파일 생성 (찾기 쉽도록)
    const os = require("os");
    const desktopPath = path.join(os.homedir(), "Desktop");
    const workDir = fs.existsSync(desktopPath) ? desktopPath : os.homedir();
    const tempFilePath = path.join(workDir, fileData.name);

    fs.writeFileSync(tempFilePath, fileData.content, "utf8");

    statusCallback(`🚀 변환 시작: ${fileData.name}`);

    // originalPath가 있으면 전달, 없으면 null (드래그앤드롭의 경우)
    const originalPath = fileData.originalPath || null;
    // 간단한 옵션 처리
    const processedOptions = {
      showPageNumbers: options && typeof options.showPageNumbers === "boolean" ? options.showPageNumbers : true
    };
    
    await convertOne(tempFilePath, statusCallback, originalPath, processedOptions);

    const safeName = path
      .basename(fileData.name, path.extname(fileData.name))
      .replace(/[^\w\-_.]/g, "_");

    // 생성된 PDF 파일 경로 확인
    const outputDir = path.join(workDir, "output");
    const pdfPath = path.join(outputDir, `${safeName}.pdf`);

    if (fs.existsSync(pdfPath)) {
      statusCallback(`✅ 변환 완료: ${workDir}\\output\\${safeName}.pdf`);

      // PDF 파일이 있는 폴더 자동으로 열기
      const { shell } = require("electron");
      shell.showItemInFolder(pdfPath);
    } else {
      statusCallback(`✅ 변환 완료: ${safeName}.pdf (output 폴더 확인)`);

      // output 폴더가 있으면 열기
      if (fs.existsSync(outputDir)) {
        const { shell } = require("electron");
        shell.openPath(outputDir);
      }
    }

    // 임시 마크다운 파일 정리 (PDF는 유지)
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.log("임시 파일 정리 실패:", e.message);
    }
  } catch (error) {
    console.error("File content conversion failed:", error);
    statusCallback(`❌ 변환 실패: ${fileData?.name || "알 수 없는 파일"}`);
  }
});

// 파일 객체 처리를 위한 핸들러 (기존)
ipcMain.handle("handle-file-object", async (event, file, options) => {
  const webContents = event.sender;

  const statusCallback = (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cleanMessage = message.replace(/\\/g, "/").split("/").pop();
      webContents.send("update-status", cleanMessage);
    }
  };

  try {
    console.log("Received file object:", file);
    console.log("Received options:", options);

    console.log("Received options:", options);

    // 파일 객체에서 ArrayBuffer로 데이터 읽기
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const content = buffer.toString("utf8");

    // 임시 파일 생성
    const os = require("os");
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, file.name);

    fs.writeFileSync(tempFilePath, content);

    statusCallback(`🚀 변환 시작: ${file.name}`);
    // 간단한 옵션 처리
    const processedOptions = {
      showPageNumbers: options && typeof options.showPageNumbers === "boolean" ? options.showPageNumbers : true
    };
    
    await convertOne(tempFilePath, statusCallback, null, processedOptions);

    const safeName = path
      .basename(file.name, path.extname(file.name))
      .replace(/[^\w\-_.]/g, "_");
    statusCallback(`✅ 변환 완료: ${safeName}.pdf`);

    // 임시 파일 정리
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.log("임시 파일 정리 실패:", e.message);
    }
  } catch (error) {
    console.error("File object conversion failed:", error);
    statusCallback(`❌ 변환 실패: ${file.name}`);
  }
});

ipcMain.on("file-path", async (event, filePath, options) => {
  const webContents = event.sender;

  const statusCallback = (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Sanitize message for display
      const cleanMessage = message.replace(/\\/g, "/").split("/").pop();
      webContents.send("update-status", cleanMessage);
    }
  };

  // 디버깅을 위한 로그
  console.log("Received filePath:", filePath, "Type:", typeof filePath);
  console.log("Received options:", options);

  console.log("Received options:", options);

  // filePath 검증
  if (!filePath || typeof filePath !== "string") {
    console.log("Invalid filePath detected");
    statusCallback(`❌ 잘못된 파일 경로입니다`);
    return;
  }

  // 파일 존재 여부 확인
  if (!fs.existsSync(filePath)) {
    statusCallback(`❌ 파일을 찾을 수 없습니다: ${path.basename(filePath)}`);
    return;
  }

  // 마크다운 파일인지 확인
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    statusCallback(`❌ 마크다운 파일만 지원됩니다 (.md, .markdown)`);
    return;
  }

  try {
    statusCallback(`🚀 변환 시작: ${path.basename(filePath)}`);
    // 간단한 옵션 처리
    const processedOptions = {
      showPageNumbers: options && typeof options.showPageNumbers === "boolean" ? options.showPageNumbers : true
    };
    
    await convertOne(filePath, statusCallback, null, processedOptions);
    // Mark success explicitly to avoid stale failure message if downstream logged an error
    const safeName = path
      .basename(filePath, path.extname(filePath))
      .replace(/[^\w\-_.]/g, "_");
    statusCallback(`✅ 변환 완료: ${safeName}.pdf`);
  } catch (error) {
    console.error("Conversion failed:", error);
    // If output PDF exists despite an error (e.g., timeout), report success
    try {
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, path.extname(filePath));
      const safeName = base.replace(/[^\w\-_.]/g, "_");
      const candidates = [
        path.join(dir, "output", `${safeName}.pdf`),
        path.join(dir, "output", `${safeName}_pdf.pdf`),
      ];
      const existing = candidates.find((p) => {
        try {
          return fs.existsSync(p);
        } catch (_) {
          return false;
        }
      });
      if (existing) {
        statusCallback(`✅ 변환 완료: ${path.basename(existing)}`);
      } else {
        statusCallback(
          `❌ 변환 실패: ${
            filePath ? path.basename(filePath) : "알 수 없는 파일"
          }`
        );
      }
    } catch (_) {
      statusCallback(
        `❌ 변환 실패: ${
          filePath ? path.basename(filePath) : "알 수 없는 파일"
        }`
      );
    }
  }
});

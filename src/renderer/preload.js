const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Renderer to Main
  sendFilePath: (filePath, options) =>
    ipcRenderer.send("file-path", filePath, options),
  sendFileObject: (file, options) =>
    ipcRenderer.invoke("handle-file-object", file, options),
  sendFileContent: (fileData, options) =>
    ipcRenderer.invoke("handle-file-content", fileData, options),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  // Main to Renderer
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (event, ...args) => callback(...args)),
});

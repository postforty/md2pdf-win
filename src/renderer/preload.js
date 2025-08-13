const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Renderer to Main
  sendFilePath: (filePath) => ipcRenderer.send("file-path", filePath),
  sendFileObject: (file) => ipcRenderer.invoke("handle-file-object", file),
  sendFileContent: (fileData) =>
    ipcRenderer.invoke("handle-file-content", fileData),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  // Main to Renderer
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (event, ...args) => callback(...args)),
});

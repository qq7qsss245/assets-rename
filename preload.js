const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  renameFiles: (data) => ipcRenderer.invoke('rename-files', data),
  batchRenameFiles: (data) => ipcRenderer.invoke('batch-rename-files', data),
  validateVideoFiles: (filePaths) => ipcRenderer.invoke('validate-video-files', filePaths),
  getFileMetadata: (data) => ipcRenderer.invoke('get-file-metadata', data),
  detectFilenameConflicts: (data) => ipcRenderer.invoke('detect-filename-conflicts', data),
  undoLastRename: () => ipcRenderer.invoke('undo-last-rename'),
  getUndoStatus: () => ipcRenderer.invoke('get-undo-status'),
  clearUndoData: () => ipcRenderer.invoke('clear-undo-data'),
  clearVideoCache: () => ipcRenderer.invoke('clear-video-cache'),
  getPathForFile: (file) => {
    try {
      // 使用 Electron 的 webUtils.getPathForFile 获取拖拽文件的真实路径
      return webUtils.getPathForFile(file);
    } catch (error) {
      console.error('getPathForFile 错误:', error);
      throw error;
    }
  }
});

// 预加载脚本，目前暂时为空，后续可扩展
window.addEventListener('DOMContentLoaded', () => {
  // 这里可以暴露API给渲染进程
});
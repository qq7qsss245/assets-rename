const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  renameFiles: (data) => ipcRenderer.invoke('rename-files', data)
});

// 预加载脚本，目前暂时为空，后续可扩展
window.addEventListener('DOMContentLoaded', () => {
  // 这里可以暴露API给渲染进程
}); 
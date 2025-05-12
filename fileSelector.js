const { dialog } = require('electron');

async function selectFiles() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm'] }
    ]
  });
  if (result.canceled) {
    return [];
  } else {
    return result.filePaths;
  }
}

module.exports = { selectFiles }; 
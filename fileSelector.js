const { dialog } = require('electron');

async function selectFiles() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) {
    return [];
  } else {
    return result.filePaths;
  }
}

module.exports = { selectFiles }; 
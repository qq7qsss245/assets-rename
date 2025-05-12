const path = require('path');
const fs = require('fs');

function getNewName(index, oldPath) {
  const ext = path.extname(oldPath);
  return `${index + 1}${ext}`;
}

async function renameFiles(filePaths) {
  const results = [];
  for (let i = 0; i < filePaths.length; i++) {
    const oldPath = filePaths[i];
    const dir = path.dirname(oldPath);
    const newName = getNewName(i, oldPath);
    const newPath = path.join(dir, newName);
    try {
      await fs.promises.rename(oldPath, newPath);
      results.push({ oldPath, newPath, success: true });
    } catch (err) {
      results.push({ oldPath, newPath, success: false, error: err.message });
    }
  }
  return results;
}

module.exports = { renameFiles }; 
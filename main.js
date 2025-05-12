const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { selectFiles } = require('./fileSelector');
const { renameFiles } = require('./fileRenamer');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-files', async () => {
  return await selectFiles();
});

ipcMain.handle('rename-files', async (event, data) => {
  return await renameFiles(data.files, data.fields);
}); 
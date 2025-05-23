const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { selectFiles } = require('./fileSelector');
const { renameFiles } = require('./fileRenamer');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');

// 判断是否是开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 设置ffprobe路径
function setupFfprobePath() {
  let ffprobePath;
  
  if (isDev) {
    // 开发环境，直接使用node_modules中的路径
    ffprobePath = ffprobeStatic.path;
  } else {
    // 生产环境，需要根据打包后的路径进行调整
    // 在打包后，ffprobe-static会被解压到resources/app.asar.unpacked/目录下
    if (process.platform === 'win32') {
      ffprobePath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'ffprobe-static',
        'bin',
        'win32',
        'x64',
        'ffprobe.exe'
      );
    } else if (process.platform === 'darwin') {
      ffprobePath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'ffprobe-static',
        'bin',
        'darwin',
        'x64',
        'ffprobe'
      );
    } else {
      ffprobePath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'ffprobe-static',
        'bin',
        'linux',
        'x64',
        'ffprobe'
      );
    }
  }
  
  // 确保路径存在
  if (fs.existsSync(ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath);
    console.log('FFprobe路径设置成功:', ffprobePath);
  } else {
    console.error('FFprobe路径不存在:', ffprobePath);
  }
}

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
  
  // 在开发环境下打开开发者工具
  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // 设置ffprobe路径
  setupFfprobePath();
  
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
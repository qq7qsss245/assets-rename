const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { selectFiles } = require('./fileSelector');
const { renameFiles, undoLastRename, getUndoStatus, clearUndoData, getVideoSize, getVideoDuration, extractLanguageCode, extractVideoName, getNearestRatio, buildName, getTodayStr, determineFinalLanguage, calculateRatioGroupIndexes } = require('./fileRenamer');
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
  return await renameFiles(data.files, data.fields, data.options);
});

ipcMain.handle('validate-video-files', async (event, filePaths) => {
  const supportedExtensions = ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm'];
  const validFiles = [];
  const invalidFiles = [];
  
  console.log('=== 文件验证 ===');
  console.log('接收到文件数量:', filePaths.length);
  
  filePaths.forEach((filePath, index) => {
    if (!filePath || filePath.trim() === '') {
      console.log(`文件 ${index + 1}: 路径为空 -> 无效`);
      invalidFiles.push(filePath);
      return;
    }
    
    const extension = path.extname(filePath).toLowerCase().slice(1);
    const fileExists = fs.existsSync(filePath);
    
    if (supportedExtensions.includes(extension) && fileExists) {
      console.log(`文件 ${index + 1}: ${path.basename(filePath)} -> 有效`);
      validFiles.push(filePath);
    } else {
      console.log(`文件 ${index + 1}: ${path.basename(filePath)} -> 无效 (扩展名:${extension}, 存在:${fileExists})`);
      invalidFiles.push(filePath);
    }
  });
  
  console.log(`验证结果: ${validFiles.length} 有效, ${invalidFiles.length} 无效`);
  return { validFiles, invalidFiles };
});

// 获取文件元数据的IPC处理程序
ipcMain.handle('get-file-metadata', async (event, data) => {
  const { filePaths, fields } = data;
  const results = [];
  
  console.log('=== 获取文件元数据 ===');
  console.log('文件数量:', filePaths.length);
  
  // 计算每个文件在其比例组内的序号
  const ratioGroupIndexes = await calculateRatioGroupIndexes(filePaths);
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const ext = path.extname(filePath);
    
    try {
      // 获取视频尺寸
      const { width, height } = await getVideoSize(filePath);
      const ratio = getNearestRatio(width, height);
      
      // 获取视频时长
      const videoDuration = await getVideoDuration(filePath) || "unknown";
      
      // 使用新的语言优先级逻辑：用户输入 > 文件名识别 > 默认值
      const finalLanguage = determineFinalLanguage(fields.language, filePath);
      
      // 获取该文件在其比例组内的序号
      const ratioGroupIndex = ratioGroupIndexes.get(i);
      
      // 生成预览文件名（按比例分组的序号）- 每个比例组内第一个文件不加序号，后续文件使用普通数字
      let videoSuffix = '';
      if (ratioGroupIndex > 0) {
        videoSuffix = String(ratioGroupIndex + 1); // 第二个文件用2，第三个文件用3，以此类推
      }
      const previewName = buildName(fields, ext, ratio, finalLanguage, videoDuration, videoSuffix);
      
      results.push({
        originalPath: filePath,
        originalName: path.basename(filePath),
        previewName: previewName,
        width,
        height,
        ratio,
        videoDuration,
        languageCode: finalLanguage,
        videoSuffix: videoSuffix,
        ratioGroupIndex: ratioGroupIndex,
        success: true
      });
      
      console.log(`文件 ${i + 1}: ${path.basename(filePath)} -> 元数据获取成功 (比例:${ratio}, 组内序号:${ratioGroupIndex})`);
    } catch (error) {
      console.error(`文件 ${i + 1}: ${path.basename(filePath)} -> 元数据获取失败:`, error);
      results.push({
        originalPath: filePath,
        originalName: path.basename(filePath),
        previewName: '无法生成预览',
        error: error.message,
        success: false
      });
    }
  }
  
  console.log(`元数据获取完成: ${results.filter(r => r.success).length} 成功, ${results.filter(r => !r.success).length} 失败`);
  return results;
});

// 批量重命名文件的IPC处理程序
ipcMain.handle('batch-rename-files', async (event, data) => {
  const { files, fields, options } = data;
  console.log('=== 批量重命名文件 ===');
  console.log('文件数量:', files.length);
  
  try {
    const results = await renameFiles(files, fields, options);
    console.log(`批量重命名完成: ${results.filter(r => r.success).length} 成功, ${results.filter(r => !r.success).length} 失败`);
    return results;
  } catch (error) {
    console.error('批量重命名失败:', error);
    throw error;
  }
});

// 检测文件名冲突的IPC处理程序
ipcMain.handle('detect-filename-conflicts', async (event, data) => {
  const { filePaths, fields } = data;
  console.log('=== 检测文件名冲突 ===');
  console.log('文件数量:', filePaths.length);
  
  const conflicts = new Map();
  const nameMap = new Map();
  
  try {
    // 计算每个文件在其比例组内的序号
    const ratioGroupIndexes = await calculateRatioGroupIndexes(filePaths);
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const ext = path.extname(filePath);
      
      // 获取视频尺寸
      const { width, height } = await getVideoSize(filePath);
      const ratio = getNearestRatio(width, height);
      
      // 获取视频时长
      const videoDuration = await getVideoDuration(filePath) || "unknown";
      
      // 使用新的语言优先级逻辑：用户输入 > 文件名识别 > 默认值
      const finalLanguage = determineFinalLanguage(fields.language, filePath);
      
      // 获取该文件在其比例组内的序号
      const ratioGroupIndex = ratioGroupIndexes.get(i);
      
      // 生成预览文件名（按比例分组的序号）- 每个比例组内第一个文件不加序号，后续文件使用普通数字
      let videoSuffix = '';
      if (ratioGroupIndex > 0) {
        videoSuffix = String(ratioGroupIndex + 1); // 第二个文件用2，第三个文件用3，以此类推
      }
      const previewName = buildName(fields, ext, ratio, finalLanguage, videoDuration, videoSuffix);
      
      if (!nameMap.has(previewName)) {
        nameMap.set(previewName, []);
      }
      nameMap.get(previewName).push({
        index: i,
        originalPath: filePath,
        originalName: path.basename(filePath),
        previewName,
        ratio,
        ratioGroupIndex
      });
    }
    
    // 找出冲突的文件名
    nameMap.forEach((files, name) => {
      if (files.length > 1) {
        conflicts.set(name, files);
      }
    });
    
    console.log(`冲突检测完成: 发现 ${conflicts.size} 个冲突组`);
    return Array.from(conflicts.entries()).map(([name, files]) => ({
      conflictName: name,
      files: files
    }));
  } catch (error) {
    console.error('冲突检测失败:', error);
    throw error;
  }
});

// 撤回最后一次重命名操作的IPC处理程序
ipcMain.handle('undo-last-rename', async (event) => {
  console.log('=== IPC: 收到撤回请求 ===');
  
  try {
    const result = await undoLastRename();
    console.log(`IPC: 撤回操作完成: ${result.successCount} 成功, ${result.errorCount} 失败`);
    return result;
  } catch (error) {
    console.error('IPC: 撤回操作失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 返回结构化的错误信息而不是抛出异常
    return {
      success: false,
      error: `撤回操作失败: ${error.message}`,
      errorType: error.name,
      successCount: 0,
      errorCount: 0,
      results: []
    };
  }
});

// 获取撤回状态的IPC处理程序
ipcMain.handle('get-undo-status', async (event) => {
  return getUndoStatus();
});

// 清除撤回数据的IPC处理程序
ipcMain.handle('clear-undo-data', async (event) => {
  clearUndoData();
  console.log('撤回数据已清除');
  return { success: true };
});
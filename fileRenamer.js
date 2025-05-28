const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
// ffprobe路径现在在main.js中统一设置

// 撤回功能数据存储
let lastRenameOperation = null;

function getTodayStr() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

const ratioList = [
  { name: '916', value: 9 / 16 },
  { name: '169', value: 16 / 9 },
  { name: '11', value: 1 },
  { name: '45', value: 4 / 5 },
  { name: '34', value: 3 / 4 },
  { name: '43', value: 4 / 3 }
];

function getNearestRatio(width, height) {
  if (!width || !height) return '未知';
  const actual = width / height;
  let minDiff = Infinity;
  let nearest = '未知';
  for (const r of ratioList) {
    const diff = Math.abs(actual - r.value);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = r.name;
    }
  }
  return nearest;
}

function extractLanguageCode(filePath) {
  // 从文件名中提取语言代码，格式为[xx]，如[en]、[zh]、[fr]等
  const fileName = path.basename(filePath);
  const match = fileName.match(/\[([a-z]{2})\]/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * 智能提取视频名称（去除扩展名和语言标识）
 * @param {string} filename - 文件名
 * @returns {string} 提取的视频名称
 */
function extractVideoName(filename) {
  // 1. 去除文件扩展名
  let name = filename.replace(/\.[^.]+$/, '');
  
  // 2. 去除语言标识 [xx]
  name = name.replace(/\[[a-zA-Z]{2,3}\]/g, '');
  
  // 3. 清理多余空格
  return name.trim();
}

/**
 * 构建文件名
 * @param {Object} fields - 用户填写的字段
 * @param {string} ext - 文件扩展名
 * @param {string} ratio - 比例
 * @param {string} language - 语言代码
 * @param {string|number} videoDuration - 视频时长（秒）
 * @param {string} videoSuffix - 视频名后缀
 * @returns {string} 构建的文件名
 */
function buildName(fields, ext, ratio, language, videoDuration, videoSuffix = '') {
  // S-比例、L-语言为占位符，VL-L为视频时长（秒），M为制作时长（小时）
  // videoSuffix 用于在视频名后添加数字后缀
  const videoName = `${fields.video}${videoSuffix}`;
  return `${getTodayStr()}_P-${fields.product}_T-${fields.template}_C-${videoName}_S-${ratio}_L-${language}_VL-L-${videoDuration}_D-${fields.author}_M-${fields.duration}${ext}`;
}

/**
 * 确定最终使用的语言代码（实现优先级逻辑）
 * @param {string} userLanguage - 用户手动输入的语言代码
 * @param {string} filePath - 文件路径（用于从文件名提取语言）
 * @returns {string} 最终使用的语言代码
 */
function determineFinalLanguage(userLanguage, filePath) {
  // 优先级：用户手动输入 > 文件名识别 > 默认值
  if (userLanguage && userLanguage.trim().length > 0) {
    return userLanguage.trim().toLowerCase();
  }
  
  const extractedLanguage = extractLanguageCode(filePath);
  if (extractedLanguage) {
    return extractedLanguage;
  }
  
  return "unknown";
}

/**
 * 获取一个唯一的视频名称，避免重复
 * @param {string} dir - 目录路径
 * @param {Object} fields - 用户填写的字段
 * @param {string} ext - 文件扩展名
 * @param {string} ratio - 比例
 * @param {string} language - 语言代码
 * @param {string|number} videoDuration - 视频时长（秒）
 * @param {boolean} useNumberSuffix - 是否使用数字后缀
 * @returns {Object} 包含生成的名称和使用的后缀
 */
function getUniqueVideoName(dir, fields, ext, ratio, language, videoDuration, useNumberSuffix = true) {
  // 先尝试不带后缀的原始名称
  let videoSuffix = '';
  let baseName = buildName(fields, '', ratio, language, videoDuration, videoSuffix);
  let fullName = `${baseName}${ext}`;
  
  if (!fs.existsSync(path.join(dir, fullName))) {
    return { name: fullName, videoSuffix: '' };
  }
  
  // 始终使用数字后缀格式，在视频名后添加数字
  let counter = 2; // 从2开始，因为第一个不加后缀
  
  while (fs.existsSync(path.join(dir, fullName))) {
    videoSuffix = counter.toString();
    baseName = buildName(fields, '', ratio, language, videoDuration, videoSuffix);
    fullName = `${baseName}${ext}`;
    counter++;
  }
  
  return { name: fullName, videoSuffix };
}

function getVideoSize(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve({ width: null, height: null });
      const stream = metadata.streams.find(s => s.width && s.height);
      if (stream) {
        resolve({ width: stream.width, height: stream.height });
      } else {
        resolve({ width: null, height: null });
      }
    });
  });
}

/**
 * 获取视频文件的时长（秒）
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<number|null>} 视频时长（秒），如果获取失败则返回null
 */
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(null);
      // 尝试从格式信息中获取时长
      if (metadata.format && metadata.format.duration) {
        // 将浮点数时长转换为整数秒
        resolve(Math.round(metadata.format.duration));
        return;
      }
      // 如果格式信息中没有时长，尝试从视频流中获取
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream && videoStream.duration) {
        resolve(Math.round(videoStream.duration));
        return;
      }
      // 无法获取时长
      resolve(null);
    });
  });
}

/**
 * 重命名文件
 * @param {Array<string>} filePaths - 文件路径数组
 * @param {Object} fields - 用户填写的字段
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 重命名结果
 */
async function renameFiles(filePaths, fields, options = {}) {
  const useNumberSuffix = true; // 始终启用数字后缀序号
  const results = [];
  const successfulRenames = []; // 存储成功的重命名操作，用于撤回
  
  for (let i = 0; i < filePaths.length; i++) {
    const oldPath = filePaths[i];
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    
    // 检测视频尺寸
    const { width, height } = await getVideoSize(oldPath);
    const ratio = getNearestRatio(width, height);
    
    // 获取视频时长
    const videoDuration = await getVideoDuration(oldPath) || "unknown";
    
    // 使用新的语言优先级逻辑：用户输入 > 文件名识别 > 默认值
    const finalLanguage = determineFinalLanguage(fields.language, oldPath);
    
    // 获取唯一的文件名，处理重名情况
    const { name: newName, videoSuffix } = getUniqueVideoName(dir, fields, ext, ratio, finalLanguage, videoDuration, useNumberSuffix);
    const newPath = path.join(dir, newName);
    
    try {
      await fs.promises.rename(oldPath, newPath);
      results.push({ oldPath, newPath, success: true, videoSuffix });
      // 保存成功的重命名操作用于撤回
      successfulRenames.push({ oldPath, newPath });
    } catch (err) {
      results.push({ oldPath, newPath, success: false, error: err.message, videoSuffix });
    }
  }
  
  // 只有当有成功的重命名操作时才保存撤回数据
  if (successfulRenames.length > 0) {
    lastRenameOperation = {
      timestamp: new Date().toISOString(),
      operations: successfulRenames,
      totalCount: successfulRenames.length
    };
  }
  
  return results;
}

/**
 * 撤回最后一次重命名操作
 * @returns {Promise<Object>} 撤回结果
 */
async function undoLastRename() {
  if (!lastRenameOperation) {
    return {
      success: false,
      error: '没有可撤回的重命名操作',
      results: []
    };
  }
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  
  // 逐个撤回重命名操作
  for (const operation of lastRenameOperation.operations) {
    const { oldPath, newPath } = operation;
    
    try {
      // 检查新文件是否存在
      if (!fs.existsSync(newPath)) {
        results.push({
          oldPath,
          newPath,
          success: false,
          error: '目标文件不存在，可能已被移动或删除'
        });
        errorCount++;
        continue;
      }
      
      // 检查原文件名是否已被占用
      if (fs.existsSync(oldPath)) {
        results.push({
          oldPath,
          newPath,
          success: false,
          error: '原文件名已被占用，无法撤回'
        });
        errorCount++;
        continue;
      }
      
      // 执行撤回操作（将新文件名改回原文件名）
      await fs.promises.rename(newPath, oldPath);
      results.push({
        oldPath,
        newPath,
        success: true
      });
      successCount++;
      
    } catch (err) {
      results.push({
        oldPath,
        newPath,
        success: false,
        error: err.message
      });
      errorCount++;
    }
  }
  
  // 如果所有操作都成功，清除撤回数据
  if (errorCount === 0) {
    lastRenameOperation = null;
  }
  
  return {
    success: successCount > 0,
    totalCount: lastRenameOperation.operations.length,
    successCount,
    errorCount,
    results,
    timestamp: lastRenameOperation.timestamp
  };
}

/**
 * 检查是否有可撤回的操作
 * @returns {Object} 撤回状态信息
 */
function getUndoStatus() {
  if (!lastRenameOperation) {
    return {
      canUndo: false,
      message: '没有可撤回的操作'
    };
  }
  
  return {
    canUndo: true,
    timestamp: lastRenameOperation.timestamp,
    operationCount: lastRenameOperation.totalCount,
    message: `可撤回 ${lastRenameOperation.totalCount} 个文件的重命名操作`
  };
}

/**
 * 清除撤回数据（用于手动清除）
 */
function clearUndoData() {
  lastRenameOperation = null;
}

module.exports = {
  renameFiles,
  undoLastRename,
  getUndoStatus,
  clearUndoData,
  getVideoSize,
  getVideoDuration,
  extractLanguageCode,
  extractVideoName,
  getNearestRatio,
  buildName,
  getTodayStr,
  determineFinalLanguage
};
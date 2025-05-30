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
  // videoSuffix 用于在视频名后添加数字后缀，直接附加到视频名后面，不加下划线
  const videoName = videoSuffix ? `${fields.video}${videoSuffix}` : fields.video;
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
 * 获取带序号的视频名称
 * @param {string} dir - 目录路径
 * @param {Object} fields - 用户填写的字段
 * @param {string} ext - 文件扩展名
 * @param {string} ratio - 比例
 * @param {string} language - 语言代码
 * @param {string|number} videoDuration - 视频时长（秒）
 * @param {number} fileIndex - 文件索引（从0开始）
 * @param {boolean} useNumberSuffix - 是否使用数字后缀
 * @returns {Object} 包含生成的名称和使用的后缀
 */
function getUniqueVideoName(dir, fields, ext, ratio, language, videoDuration, fileIndex = 0, useNumberSuffix = true) {
  // 第一个文件（index=0）不添加序号，后续文件添加普通数字序号
  let videoSuffix = '';
  if (fileIndex > 0) {
    videoSuffix = String(fileIndex + 1); // 第二个文件用2，第三个文件用3，以此类推
  }
  
  const baseName = buildName(fields, '', ratio, language, videoDuration, videoSuffix);
  const fullName = `${baseName}${ext}`;
  
  // 如果文件已存在，继续递增序号直到找到可用的名称
  let counter = fileIndex;
  let currentSuffix = videoSuffix;
  let currentName = fullName;
  
  while (fs.existsSync(path.join(dir, currentName))) {
    counter++;
    // 如果是第一个文件且存在冲突，从2开始编号
    currentSuffix = counter === 0 ? '2' : String(counter + 1);
    const currentBaseName = buildName(fields, '', ratio, language, videoDuration, currentSuffix);
    currentName = `${currentBaseName}${ext}`;
  }
  
  return { name: currentName, videoSuffix: currentSuffix };
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
  
  // 计算每个文件在其比例组内的序号
  const ratioGroupIndexes = await calculateRatioGroupIndexes(filePaths);
  
  // 按原始顺序处理文件，使用比例组内的序号
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
    
    // 获取该文件在其比例组内的序号
    const ratioGroupIndex = ratioGroupIndexes.get(i);
    
    // 获取带序号的文件名，传递比例组内的索引
    const { name: newName, videoSuffix } = getUniqueVideoName(dir, fields, ext, ratio, finalLanguage, videoDuration, ratioGroupIndex, useNumberSuffix);
    const newPath = path.join(dir, newName);
    
    try {
      await fs.promises.rename(oldPath, newPath);
      results.push({ oldPath, newPath, success: true, videoSuffix, ratio, ratioGroupIndex });
      // 保存成功的重命名操作用于撤回
      successfulRenames.push({ oldPath, newPath });
    } catch (err) {
      results.push({ oldPath, newPath, success: false, error: err.message, videoSuffix, ratio, ratioGroupIndex });
    }
  }
  
  // 只有当有成功的重命名操作时才保存撤回数据
  if (successfulRenames.length > 0) {
    lastRenameOperation = {
      timestamp: new Date().toISOString(),
      operations: successfulRenames,
      totalCount: successfulRenames.length
    };
    console.log('=== 撤回数据已保存 ===');
    console.log('成功重命名文件数量:', successfulRenames.length);
    console.log('撤回数据时间戳:', lastRenameOperation.timestamp);
    console.log('撤回数据结构验证:', {
      hasOperations: !!lastRenameOperation.operations,
      operationsLength: lastRenameOperation.operations.length,
      hasTimestamp: !!lastRenameOperation.timestamp,
      hasTotalCount: !!lastRenameOperation.totalCount
    });
  } else {
    console.log('=== 没有成功的重命名操作，不保存撤回数据 ===');
    lastRenameOperation = null; // 确保清空之前的撤回数据
  }
  
  return results;
}

/**
 * 撤回最后一次重命名操作
 * @returns {Promise<Object>} 撤回结果
 */
async function undoLastRename() {
  console.log('=== 开始撤回操作 ===');
  console.log('lastRenameOperation 状态:', lastRenameOperation ? '存在' : 'null');
  
  if (!lastRenameOperation) {
    console.log('撤回失败: lastRenameOperation 为 null');
    return {
      success: false,
      error: '没有可撤回的重命名操作',
      results: []
    };
  }
  
  console.log('lastRenameOperation 结构:', {
    timestamp: lastRenameOperation.timestamp,
    totalCount: lastRenameOperation.totalCount,
    operationsLength: lastRenameOperation.operations ? lastRenameOperation.operations.length : 'operations为null'
  });
  
  if (!lastRenameOperation.operations) {
    console.log('撤回失败: lastRenameOperation.operations 为 null');
    return {
      success: false,
      error: '撤回数据结构异常：operations 为空',
      results: []
    };
  }
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  
  // 保存原始数据的引用，避免在处理过程中被修改
  const operationsToUndo = [...lastRenameOperation.operations];
  const originalTimestamp = lastRenameOperation.timestamp;
  const originalTotalCount = lastRenameOperation.totalCount;
  
  console.log('准备撤回', operationsToUndo.length, '个操作');
  
  // 逐个撤回重命名操作
  for (const operation of operationsToUndo) {
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
    console.log('所有撤回操作成功，清除撤回数据');
    lastRenameOperation = null;
  } else {
    console.log('部分撤回操作失败，保留撤回数据');
  }
  
  console.log('撤回操作完成:', {
    successCount,
    errorCount,
    totalCount: originalTotalCount
  });
  
  return {
    success: successCount > 0,
    totalCount: originalTotalCount,
    successCount,
    errorCount,
    results,
    timestamp: originalTimestamp
  };
}

/**
 * 检查是否有可撤回的操作
 * @returns {Object} 撤回状态信息
 */
function getUndoStatus() {
  console.log('=== 检查撤回状态 ===');
  console.log('lastRenameOperation 存在:', !!lastRenameOperation);
  
  if (!lastRenameOperation) {
    console.log('返回状态: 无可撤回操作');
    return {
      canUndo: false,
      message: '没有可撤回的操作'
    };
  }
  
  console.log('返回状态: 可撤回', lastRenameOperation.totalCount, '个文件');
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

/**
 * 按视频比例分组并计算每个文件在其比例组内的序号
 * @param {Array<string>} filePaths - 文件路径数组
 * @returns {Promise<Map<number, number>>} 文件索引到比例组内序号的映射
 */
async function calculateRatioGroupIndexes(filePaths) {
  // 第一步：获取所有文件的比例信息，按比例分组
  const filesByRatio = new Map();
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    
    // 检测视频尺寸
    const { width, height } = await getVideoSize(filePath);
    const ratio = getNearestRatio(width, height);
    
    if (!filesByRatio.has(ratio)) {
      filesByRatio.set(ratio, []);
    }
    
    filesByRatio.get(ratio).push({
      originalIndex: i,
      filePath: filePath
    });
  }
  
  // 第二步：为每个比例组分配序号
  const fileIndexMap = new Map(); // 存储每个文件的比例组内序号
  
  filesByRatio.forEach((files, ratio) => {
    files.forEach((fileInfo, indexInGroup) => {
      fileIndexMap.set(fileInfo.originalIndex, indexInGroup);
    });
  });
  
  return fileIndexMap;
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
  determineFinalLanguage,
  calculateRatioGroupIndexes
};
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
// ffprobe路径现在在main.js中统一设置

// 撤回功能数据存储
let lastRenameOperation = null;

// 视频元数据缓存
const videoMetadataCache = new Map();

/**
 * 获取文件的修改时间戳
 * @param {string} filePath - 文件路径
 * @returns {number|null} 文件修改时间戳，如果文件不存在则返回null
 */
function getFileTimestamp(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.getTime();
  } catch (error) {
    return null;
  }
}

/**
 * 检查缓存是否有效
 * @param {string} filePath - 文件路径
 * @param {Object} cachedData - 缓存的数据
 * @returns {boolean} 缓存是否有效
 */
function isCacheValid(filePath, cachedData) {
  if (!cachedData || !cachedData.timestamp) {
    return false;
  }
  
  const currentTimestamp = getFileTimestamp(filePath);
  if (currentTimestamp === null) {
    return false;
  }
  
  return cachedData.timestamp === currentTimestamp;
}

/**
 * 清理无效的缓存条目
 * @param {Array<string>} validFilePaths - 当前有效的文件路径列表
 */
function cleanupCache(validFilePaths = []) {
  const validPathSet = new Set(validFilePaths);
  
  for (const [filePath, cachedData] of videoMetadataCache.entries()) {
    // 如果文件不在有效列表中，或者缓存已过期，则删除
    if (!validPathSet.has(filePath) || !isCacheValid(filePath, cachedData)) {
      videoMetadataCache.delete(filePath);
    }
  }
}

/**
 * 手动清理所有缓存
 */
function clearAllCache() {
  videoMetadataCache.clear();
}

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
function buildName(fields, ext, ratio, language, videoDuration, videoSuffix = '', originalFileName = '') {
  // S-比例、L-语言为占位符，VL-L为视频时长（秒），M为制作时长（小时）
  // videoSuffix 用于在视频名后添加数字后缀，直接附加到视频名后面，不加下划线
  console.log('=== buildName 调试信息 ===');
  console.log('传入的 fields.video:', `"${fields.video}"`);
  console.log('fields.video 是否为空:', fields.video === '');
  console.log('fields.video 是否为默认值"视频名":', fields.video === '视频名');
  console.log('originalFileName:', originalFileName);
  console.log('videoSuffix:', videoSuffix);
  
  // 处理视频名：如果为空或为默认值，则使用原文件名
  let finalVideoName = fields.video;
  if (!finalVideoName || finalVideoName === '视频名') {
    if (originalFileName) {
      finalVideoName = extractVideoName(originalFileName);
      console.log('视频名为空，使用原文件名提取:', `"${finalVideoName}"`);
    } else {
      finalVideoName = '视频名'; // 兜底默认值
      console.log('视频名为空且无原文件名，使用默认值');
    }
  }
  
  const videoName = videoSuffix ? `${finalVideoName}${videoSuffix}` : finalVideoName;
  console.log('最终使用的 videoName:', `"${videoName}"`);
  
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
function getUniqueVideoName(dir, fields, ext, ratio, language, videoDuration, fileIndex = 0, useNumberSuffix = true, originalFileName = '') {
  // 第一个文件（index=0）不添加序号，后续文件添加普通数字序号
  let videoSuffix = '';
  if (fileIndex > 0) {
    videoSuffix = String(fileIndex + 1); // 第二个文件用2，第三个文件用3，以此类推
  }
  
  const baseName = buildName(fields, '', ratio, language, videoDuration, videoSuffix, originalFileName);
  const fullName = `${baseName}${ext}`;
  
  // 如果文件已存在，继续递增序号直到找到可用的名称
  let counter = fileIndex;
  let currentSuffix = videoSuffix;
  let currentName = fullName;
  
  while (fs.existsSync(path.join(dir, currentName))) {
    counter++;
    // 如果是第一个文件且存在冲突，从2开始编号
    currentSuffix = counter === 0 ? '2' : String(counter + 1);
    const currentBaseName = buildName(fields, '', ratio, language, videoDuration, currentSuffix, originalFileName);
    currentName = `${currentBaseName}${ext}`;
  }
  
  return { name: currentName, videoSuffix: currentSuffix };
}

function getVideoSize(filePath) {
  return new Promise((resolve, reject) => {
    // 检查缓存
    const cachedData = videoMetadataCache.get(filePath);
    if (cachedData && isCacheValid(filePath, cachedData)) {
      console.log(`使用缓存的视频尺寸: ${filePath}`);
      return resolve({
        width: cachedData.width,
        height: cachedData.height
      });
    }

    console.log(`获取视频尺寸: ${filePath}`);
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error(`获取视频尺寸失败: ${filePath}`, err.message);
        return resolve({ width: null, height: null });
      }
      
      const stream = metadata.streams.find(s => s.width && s.height);
      const width = stream ? stream.width : null;
      const height = stream ? stream.height : null;
      
      // 缓存结果
      const timestamp = getFileTimestamp(filePath);
      if (timestamp !== null) {
        const existingCache = videoMetadataCache.get(filePath) || {};
        videoMetadataCache.set(filePath, {
          ...existingCache,
          width,
          height,
          timestamp
        });
      }
      
      resolve({ width, height });
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
    // 检查缓存
    const cachedData = videoMetadataCache.get(filePath);
    if (cachedData && isCacheValid(filePath, cachedData) && cachedData.duration !== undefined) {
      console.log(`使用缓存的视频时长: ${filePath}`);
      return resolve(cachedData.duration);
    }

    console.log(`获取视频时长: ${filePath}`);
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error(`获取视频时长失败: ${filePath}`, err.message);
        return resolve(null);
      }
      
      let duration = null;
      
      // 尝试从格式信息中获取时长
      if (metadata.format && metadata.format.duration) {
        duration = Math.round(metadata.format.duration);
      } else {
        // 如果格式信息中没有时长，尝试从视频流中获取
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (videoStream && videoStream.duration) {
          duration = Math.round(videoStream.duration);
        }
      }
      
      // 缓存结果
      const timestamp = getFileTimestamp(filePath);
      if (timestamp !== null) {
        const existingCache = videoMetadataCache.get(filePath) || {};
        videoMetadataCache.set(filePath, {
          ...existingCache,
          duration,
          timestamp
        });
      }
      
      resolve(duration);
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
  
  // 计算每个文件在其比例+视频名组内的序号
  const ratioGroupIndexes = await calculateRatioGroupIndexes(filePaths, fields);
  
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
    
    // 获取原文件名（不含路径和扩展名）
    const originalFileName = path.basename(oldPath, ext);
    
    // 获取带序号的文件名，传递比例组内的索引和原文件名
    const { name: newName, videoSuffix } = getUniqueVideoName(dir, fields, ext, ratio, finalLanguage, videoDuration, ratioGroupIndex, useNumberSuffix, originalFileName);
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
 * 按视频比例和处理后的视频文件名分组并计算每个文件在其组内的序号
 * @param {Array<string>} filePaths - 文件路径数组
 * @param {Object} fields - 用户填写的字段（用于确定最终视频名）
 * @returns {Promise<Map<number, number>>} 文件索引到组内序号的映射
 */
async function calculateRatioGroupIndexes(filePaths, fields = null) {
  // 第一步：获取所有文件的比例信息和处理后的视频名，按比例+视频名分组
  const filesByGroup = new Map();
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const ext = path.extname(filePath);
    
    // 检测视频尺寸
    const { width, height } = await getVideoSize(filePath);
    const ratio = getNearestRatio(width, height);
    
    // 确定最终使用的视频名
    let finalVideoName = '';
    if (fields && fields.video && fields.video !== '视频名') {
      // 如果用户填写了视频名且不是默认值，使用用户填写的
      finalVideoName = fields.video;
    } else {
      // 否则使用从原文件名提取的视频名
      const originalFileName = path.basename(filePath, ext);
      finalVideoName = extractVideoName(originalFileName);
    }
    
    // 创建分组键：比例 + 处理后的视频名
    const groupKey = `${ratio}_${finalVideoName}`;
    
    if (!filesByGroup.has(groupKey)) {
      filesByGroup.set(groupKey, []);
    }
    
    filesByGroup.get(groupKey).push({
      originalIndex: i,
      filePath: filePath,
      ratio: ratio,
      finalVideoName: finalVideoName
    });
  }
  
  // 第二步：为每个分组分配序号
  const fileIndexMap = new Map(); // 存储每个文件的组内序号
  
  filesByGroup.forEach((files, groupKey) => {
    console.log(`=== 分组 ${groupKey} 包含 ${files.length} 个文件 ===`);
    files.forEach((fileInfo, indexInGroup) => {
      fileIndexMap.set(fileInfo.originalIndex, indexInGroup);
      console.log(`文件 ${fileInfo.originalIndex + 1}: ${path.basename(fileInfo.filePath)} -> 组内序号: ${indexInGroup}`);
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
  calculateRatioGroupIndexes,
  cleanupCache,
  clearAllCache
};
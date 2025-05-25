const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
// ffprobe路径现在在main.js中统一设置

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

function buildName(fields, ext, ratio, language, videoSuffix = '') {
  // S-比例、L-语言为占位符
  // videoSuffix 用于在视频名后添加数字后缀
  const videoName = `${fields.video}${videoSuffix}`;
  return `${getTodayStr()}_P-${fields.product}_T-${fields.template}_C-${videoName}_S-${ratio}_L-${language}_D-${fields.author}_M-${fields.duration}${ext}`;
}

function getUniqueVideoName(dir, fields, ext, ratio, language, useNumberSuffix = false) {
  // 先尝试不带后缀的原始名称
  let videoSuffix = '';
  let baseName = buildName(fields, '', ratio, language, videoSuffix);
  let fullName = `${baseName}${ext}`;
  
  if (!fs.existsSync(path.join(dir, fullName))) {
    return { name: fullName, videoSuffix: '' };
  }
  
  if (!useNumberSuffix) {
    // 如果不使用数字后缀，则使用原来的括号格式处理整个文件名
    let counter = 1;
    while (fs.existsSync(path.join(dir, fullName))) {
      baseName = buildName(fields, '', ratio, language, '');
      fullName = `${baseName}(${counter})${ext}`;
      counter++;
    }
    return { name: fullName, videoSuffix: '' };
  }
  
  // 使用数字后缀格式，在视频名后添加数字
  let counter = 2; // 从2开始，因为第一个不加后缀
  
  while (fs.existsSync(path.join(dir, fullName))) {
    videoSuffix = counter.toString();
    baseName = buildName(fields, '', ratio, language, videoSuffix);
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

async function renameFiles(filePaths, fields, options = {}) {
  const useNumberSuffix = options.useNumberSuffix || false;
  const results = [];
  
  for (let i = 0; i < filePaths.length; i++) {
    const oldPath = filePaths[i];
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    
    // 检测视频尺寸
    const { width, height } = await getVideoSize(oldPath);
    const ratio = getNearestRatio(width, height);
    
    // 从文件名中提取语言代码，如果没有则使用默认值"unknown"
    const languageCode = extractLanguageCode(oldPath) || "unknown";
    
    // 获取唯一的文件名，处理重名情况
    const { name: newName, videoSuffix } = getUniqueVideoName(dir, fields, ext, ratio, languageCode, useNumberSuffix);
    const newPath = path.join(dir, newName);
    
    try {
      await fs.promises.rename(oldPath, newPath);
      results.push({ oldPath, newPath, success: true, videoSuffix });
    } catch (err) {
      results.push({ oldPath, newPath, success: false, error: err.message, videoSuffix });
    }
  }
  
  return results;
}

module.exports = { renameFiles }; 
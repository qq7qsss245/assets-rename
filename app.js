/**
 * 主应用逻辑模块
 * 负责应用的核心业务逻辑和事件处理
 */

// 全局变量
let previewManager;
let progressManager;
let undoManager;

/**
 * 主应用初始化
 */
async function initializeApp() {
  console.log('=== DOM 内容加载完成，开始初始化 ===');
  
  try {
    // 初始化全局变量
    console.log('初始化全局变量...');
    if (typeof window.selectedFiles === 'undefined') {
      window.selectedFiles = [];
      console.log('✅ window.selectedFiles 已初始化');
    }
    if (typeof window.previewData === 'undefined') {
      window.previewData = [];
      console.log('✅ window.previewData 已初始化');
    }
    
    // 等待Bootstrap加载完成
    console.log('等待Bootstrap库加载...');
    await waitForBootstrap();
    console.log('Bootstrap库加载完成');
    
    // 检查必要的依赖
    console.log('检查依赖...');
    if (typeof FieldValidator === 'undefined') {
      console.warn('⚠️ FieldValidator 未定义，将使用降级验证');
    } else {
      console.log('✅ FieldValidator 可用');
    }
    
    // 初始化各个组件
    safeInitializeDropdowns();
    setupDragAndDrop();
    setupFormFieldListeners();
    setupNewEventListeners();
    
    // 初始化管理器实例
    window.previewManager = new PreviewManager();
    window.progressManager = new ProgressManager();
    window.progressManager.init();
    
    // 初始化撤回管理器
    console.log('准备初始化撤回管理器...');
    window.undoManager = new UndoManager();
    console.log('撤回管理器初始化完成');
    
    // 设置主要事件监听器
    setupMainEventListeners();
    
    // 初始化工具提示
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[title]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    console.log('✅ 应用初始化完成');
    console.log('UI界面重构完成：紧凑布局，拖拽区域可点击选择文件');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    showAlert('应用初始化失败，请刷新页面重试', 'danger');
  }
}

/**
 * 设置主要事件监听器
 */
function setupMainEventListeners() {
  console.log('设置主要事件监听器...');
  
  // 清空字段按钮
  const clearButton = document.getElementById('clear-fields');
  if (clearButton) {
    clearButton.addEventListener('click', async () => {
      // 清空所有输入字段
      const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
      fieldNames.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
          field.value = '';
        }
      });
      showAlert('已清空所有字段', 'info');
      
      // 刷新预览
      if (window.previewManager && typeof window.previewManager.refreshPreview === 'function') {
        await window.previewManager.refreshPreview();
      }
    });
    console.log('✅ 清空字段按钮事件监听器已绑定');
  } else {
    console.error('❌ 清空字段按钮元素不存在');
  }
  
  // 重命名文件按钮
  const renameButton = document.getElementById('rename-files');
  if (renameButton) {
    renameButton.addEventListener('click', handleRenameFiles);
    console.log('✅ 重命名按钮事件监听器已绑定');
  } else {
    console.error('❌ 重命名按钮元素不存在');
  }
}

/**
 * 处理重命名文件操作
 */
async function handleRenameFiles() {
  console.log('=== 开始重命名文件处理 ===');
  
  // 确保selectedFiles已初始化
  if (typeof window.selectedFiles === 'undefined') {
    window.selectedFiles = [];
    console.warn('window.selectedFiles 未初始化，已设置为空数组');
  }
  
  // 获取当前选择的文件
  const currentSelectedFiles = window.selectedFiles || [];
  console.log('当前选择的文件数量:', currentSelectedFiles.length);
  console.log('选择的文件列表:', currentSelectedFiles);
  
  if (!currentSelectedFiles || currentSelectedFiles.length === 0) {
    console.error('没有选择文件');
    showAlert('请先选择文件！', 'danger');
    return;
  }
  
  // 获取表单字段值
  const product = document.getElementById('product').value.trim();
  const template = document.getElementById('template').value.trim();
  const video = document.getElementById('video').value.trim();
  const author = document.getElementById('author').value.trim();
  const duration = document.getElementById('duration').value.trim();
  const language = document.getElementById('language').value.trim();
  
  console.log('表单字段值:', { product, template, video, author, duration, language });
  
  // 验证必填字段（视频名允许为空，将在buildName中处理）
  const missingFields = [];
  if (!product) missingFields.push('产品名');
  if (!template) missingFields.push('模板名');
  if (!author) missingFields.push('制作人');
  if (!duration) missingFields.push('制作时长');
  
  if (missingFields.length > 0) {
    const errorMsg = `请填写以下必填字段：${missingFields.join('、')}`;
    console.error('必填字段验证失败:', errorMsg);
    showAlert(errorMsg, 'danger');
    return;
  }
  
  // 验证制作时长是否为有效数字
  const durationNum = parseFloat(duration);
  if (isNaN(durationNum) || durationNum <= 0) {
    console.error('制作时长验证失败:', duration);
    showAlert('制作时长必须是大于0的数字！', 'danger');
    return;
  }
  
  console.log('基本字段验证通过');
  
  // 验证所有字段
  if (typeof FieldValidator !== 'undefined') {
    const validation = FieldValidator.validateAllFields();
    if (!validation.allValid) {
      showAlert('请修正表单中的错误：' + validation.errors.join(', '), 'danger');
      return;
    }
  } else {
    console.warn('FieldValidator未定义，跳过字段验证');
    // 降级处理：基本验证
    if (!product || !template || !author || !duration) {
      showAlert('请填写所有必填字段！', 'danger');
      return;
    }
  }
  
  // 保存到历史记录
  addToHistory('product', product);
  addToHistory('template', template);
  addToHistory('video', video);
  addToHistory('author', author);
  addToHistory('duration', duration);
  if (language) {
    addToHistory('language', language);
  }
  
  // 准备重命名参数
  const fields = { product, template, video, author, duration, language };
  const options = { useNumberSuffix: true }; // 始终启用数字后缀序号
  
  console.log('=== 开始重命名操作 ===');
  console.log('调用 renameFiles API，文件数量:', currentSelectedFiles.length);
  
  // 检查electronAPI是否存在
  if (typeof window.electronAPI === 'undefined') {
    console.error('electronAPI 不存在，可能在浏览器环境中运行');
    showAlert('此功能需要在Electron应用中运行，浏览器环境不支持文件重命名操作', 'warning');
    return;
  }
  
  if (typeof window.electronAPI.renameFiles !== 'function') {
    console.error('electronAPI.renameFiles 方法不存在');
    showAlert('重命名API不可用，请检查应用版本', 'danger');
    return;
  }
  
  try {
    // 执行重命名操作
    const result = await window.electronAPI.renameFiles({
      files: currentSelectedFiles,
      fields,
      options
    });
    
    console.log('重命名操作完成，结果:', result);
    
    // 处理重命名结果
    handleRenameResult(result);
    
  } catch (error) {
    console.error('重命名操作失败:', error);
    showAlert('重命名操作失败：' + error.message, 'danger');
  }
}

/**
 * 处理重命名结果
 * @param {Array} result - 重命名结果数组
 */
async function handleRenameResult(result) {
  // 显示重命名结果
  let html = '';
  result.forEach(r => {
    if (r.success) {
      html += `
        <tr class="table-success">
          <td class="preview-filename">${r.oldPath.split(/[/\\]/).pop()}</td>
          <td class="preview-filename">${r.newPath.split(/[/\\]/).pop()}</td>
        </tr>
      `;
    } else {
      html += `
        <tr class="table-danger">
          <td class="preview-filename">${r.oldPath.split(/[/\\]/).pop()}</td>
          <td class="preview-filename text-danger">重命名失败</td>
        </tr>
      `;
    }
  });
  
  // 更新预览表格显示结果
  window.previewManager.previewTableBody.innerHTML = html;
  
  // 显示成功消息
  const successCount = result.filter(r => r.success).length;
  const failCount = result.filter(r => !r.success).length;
  
  if (successCount > 0) {
    showAlert(
      `重命名完成：${successCount} 个文件成功${failCount > 0 ? `，${failCount} 个文件失败` : ''}`,
      failCount > 0 ? 'warning' : 'success'
    );
    
    // 重命名成功后更新撤回按钮状态
    console.log('重命名成功，更新撤回按钮状态');
    if (window.undoManager) {
      await window.undoManager.updateUndoButtonState();
      console.log('撤回按钮状态已更新');
    }
  } else {
    showAlert('重命名失败，请检查文件权限或路径', 'danger');
  }
  
  // 清空选择的文件
  window.selectedFiles = [];
  window.previewData = [];
  
  // 显示拖拽区域
  if (window.previewManager) {
    window.previewManager.showDropZone();
  }
}

/**
 * 处理文件选择完成事件
 * @param {Array} files - 选择的文件路径数组
 */
async function handleFilesSelected(files) {
  if (files && files.length > 0) {
    window.selectedFiles = files;
    await updateFileListDisplay(files);
    
    // 自动填入视频名
    autoFillVideoName(files);
    showAlert(`成功选择 ${files.length} 个视频文件`, 'success');
  }
}

/**
 * 处理拖拽文件事件
 * @param {FileList} files - 拖拽的文件列表
 */
async function handleDroppedFiles(files) {
  const fileArray = Array.from(files);
  
  console.log('=== 拖拽文件处理 ===');
  console.log('拖拽文件数量:', fileArray.length);
  
  // 使用 Electron 的 webUtils.getPathForFile() 获取拖拽文件路径
  const filePaths = [];
  
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    let filePath = file.path;
    
    // 如果 path 为 undefined，使用 webUtils.getPathForFile() 获取路径
    if (!filePath && window.electronAPI && window.electronAPI.getPathForFile) {
      try {
        filePath = await window.electronAPI.getPathForFile(file);
        console.log(`文件 ${i + 1}: ${file.name} -> 路径获取成功`);
      } catch (error) {
        console.log(`文件 ${i + 1}: ${file.name} -> 路径获取失败:`, error);
      }
    }
    
    if (filePath) {
      filePaths.push(filePath);
    } else {
      console.log(`文件 ${i + 1}: ${file.name} -> 无法获取路径`);
    }
  }
  
  if (filePaths.length === 0) {
    showAlert('无法获取拖拽文件的路径，请使用点击选择文件功能', 'danger');
    return;
  }
  
  try {
    const { validFiles, invalidFiles } = await window.electronAPI.validateVideoFiles(filePaths);
    
    if (validFiles.length > 0) {
      window.selectedFiles = validFiles;
      await updateFileListDisplay(validFiles);
      
      // 自动填入视频名
      autoFillVideoName(validFiles);
      
      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles.map(path => path.split(/[/\\]/).pop());
        showAlert(
          `成功添加 ${validFiles.length} 个视频文件。忽略了 ${invalidFiles.length} 个不支持的文件：${invalidNames.join(', ')}`,
          'warning'
        );
      } else {
        showAlert(`成功添加 ${validFiles.length} 个视频文件`, 'success');
      }
    } else {
      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles.map(path => path.split(/[/\\]/).pop());
        showAlert(
          `不支持的文件格式：${invalidNames.join(', ')}。请选择视频文件（${SUPPORTED_VIDEO_EXTENSIONS.join(', ')}）`,
          'danger'
        );
      }
    }
  } catch (error) {
    console.error('文件验证失败:', error);
    showAlert('文件验证失败，请重试', 'danger');
  }
}

/**
 * 获取应用状态
 * @returns {Object} 应用状态对象
 */
function getAppState() {
  return {
    selectedFiles: window.selectedFiles || [],
    previewData: window.previewData || [],
    formFields: {
      product: document.getElementById('product').value.trim(),
      template: document.getElementById('template').value.trim(),
      video: document.getElementById('video').value.trim(),
      author: document.getElementById('author').value.trim(),
      duration: document.getElementById('duration').value.trim(),
      language: document.getElementById('language').value.trim()
    }
  };
}

/**
 * 重置应用状态
 */
function resetAppState() {
  window.selectedFiles = [];
  window.previewData = [];
  
  // 清空表单字段
  const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  fieldNames.forEach(fieldName => {
    document.getElementById(fieldName).value = '';
  });
  
  // 显示拖拽区域
  if (window.previewManager) {
    window.previewManager.showDropZone();
  }
}

/**
 * 实时诊断功能
 * 检查应用关键组件的状态
 */
function runDiagnostics() {
  console.log('=== 运行实时诊断 ===');
  
  const issues = [];
  const checks = [];
  
  // 检查DOM元素
  const renameButton = document.getElementById('rename-files');
  if (!renameButton) {
    issues.push('重命名按钮元素不存在');
  } else {
    checks.push('✅ 重命名按钮存在');
  }
  
  // 检查全局变量
  if (typeof window.selectedFiles === 'undefined') {
    issues.push('window.selectedFiles 未定义');
  } else {
    checks.push(`✅ selectedFiles: ${window.selectedFiles.length} 个文件`);
  }
  
  if (typeof FieldValidator === 'undefined') {
    issues.push('FieldValidator 未定义');
  } else {
    checks.push('✅ FieldValidator 可用');
  }
  
  if (typeof window.electronAPI === 'undefined') {
    issues.push('electronAPI 未定义（浏览器环境正常）');
  } else {
    checks.push('✅ electronAPI 可用');
  }
  
  // 输出结果
  console.log('诊断检查通过:', checks);
  if (issues.length > 0) {
    console.warn('诊断发现问题:', issues);
  } else {
    console.log('✅ 所有关键组件正常');
  }
  
  return { issues, checks };
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 导出主要函数供全局使用
window.handleFilesSelected = handleFilesSelected;
window.handleDroppedFiles = handleDroppedFiles;
window.getAppState = getAppState;
window.resetAppState = resetAppState;
window.runDiagnostics = runDiagnostics;
window.previewManager = previewManager;
// 这些变量已经在初始化时设置为window属性，无需重复导出
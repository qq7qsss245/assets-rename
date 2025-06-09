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
    // 历史记录功能会自动初始化
    setupFormFieldListeners();
    setupFieldValidation();
    
    // 初始化管理器实例
    window.fileManager = new FileManager();
    window.progressManager = new ProgressManager();
    window.progressManager.init();
    window.undoManager = new UndoManager();
    
    // 设置previewManager引用，指向fileManager（因为FileManager包含预览功能）
    window.previewManager = window.fileManager;
    
    // 设置主要事件监听器
    setupMainEventListeners();
    
    // 添加缓存管理按钮（用于调试和优化）
    if (typeof addCacheManagementButton === 'function') {
      addCacheManagementButton();
    }
    
    // 初始化工具提示
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[title]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    console.log('✅ 应用初始化完成');
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
  
  // 保存当前输入值
  if (window.historyManager && typeof window.historyManager.saveCurrentValues === 'function') {
    window.historyManager.saveCurrentValues();
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
  if (window.previewManager && window.previewManager.previewTableBody) {
    window.previewManager.previewTableBody.innerHTML = html;
  } else {
    console.warn('previewManager 或 previewTableBody 不存在，跳过预览表格更新');
  }
  
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
  
  // 清空选择的文件并显示拖拽区域
  if (window.fileManager) {
    window.fileManager.showDropZone();
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
  // 清空表单字段
  const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  fieldNames.forEach(fieldName => {
    document.getElementById(fieldName).value = '';
  });
  
  // 显示拖拽区域
  if (window.fileManager) {
    window.fileManager.showDropZone();
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
window.getAppState = getAppState;
window.resetAppState = resetAppState;
window.runDiagnostics = runDiagnostics;
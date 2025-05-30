/**
 * UI交互功能模块
 * 负责处理用户界面交互、拖拽、进度显示等功能
 */

// 全局变量
let selectedFiles = [];
let previewData = [];

/**
 * 预览管理器类
 * 负责文件预览功能的管理
 */
class PreviewManager {
  constructor() {
    this.previewContainer = document.getElementById('preview-container');
    this.dropZone = document.getElementById('drop-zone');
    this.previewTable = document.getElementById('preview-table');
    this.previewTableBody = document.getElementById('preview-table-body');
  }
  
  /**
   * 显示拖拽区域
   */
  showDropZone() {
    this.dropZone.classList.remove('d-none');
    this.previewTable.classList.add('d-none');
    selectedFiles = [];
    previewData = [];
  }
  
  /**
   * 显示预览表格
   */
  showPreviewTable() {
    this.dropZone.classList.add('d-none');
    this.previewTable.classList.remove('d-none');
  }
  
  /**
   * 更新预览数据
   * @param {Array} files - 文件路径数组
   */
  async updatePreview(files) {
    if (!files || files.length === 0) {
      this.showDropZone();
      return;
    }
    
    selectedFiles = files;
    this.showPreviewTable();
    
    // 显示加载状态
    this.showLoadingState(files);
    
    // 获取表单字段
    const fields = this.getFormFields();
    
    // 获取文件元数据和预览名称
    try {
      const metadata = await window.electronAPI.getFileMetadata({ filePaths: files, fields });
      previewData = metadata;
      this.renderPreviewTable(metadata);
    } catch (error) {
      console.error('获取文件元数据失败:', error);
      this.showErrorState(files, error.message);
    }
  }
  
  /**
   * 获取表单字段
   * @returns {Object} 表单字段对象
   */
  getFormFields() {
    return {
      product: document.getElementById('product').value.trim() || '产品名',
      template: document.getElementById('template').value.trim() || '模板名',
      video: document.getElementById('video').value.trim() || '视频名',
      author: document.getElementById('author').value.trim() || '制作人',
      duration: document.getElementById('duration').value.trim() || '1',
      language: document.getElementById('language').value.trim() || ''
    };
  }
  
  /**
   * 显示加载状态
   * @param {Array} files - 文件路径数组
   */
  showLoadingState(files) {
    let html = '';
    files.forEach((filePath, index) => {
      const fileName = filePath.split(/[/\\]/).pop();
      html += `
        <tr>
          <td class="preview-filename">${fileName}</td>
          <td class="preview-filename preview-loading">
            <i class="bi bi-hourglass-split me-2"></i>正在生成预览...
          </td>
        </tr>
      `;
    });
    this.previewTableBody.innerHTML = html;
  }
  
  /**
   * 显示错误状态
   * @param {Array} files - 文件路径数组
   * @param {string} errorMessage - 错误消息
   */
  showErrorState(files, errorMessage) {
    let html = '';
    files.forEach((filePath, index) => {
      const fileName = filePath.split(/[/\\]/).pop();
      html += `
        <tr>
          <td class="preview-filename">${fileName}</td>
          <td class="preview-filename preview-status-error">
            <i class="bi bi-exclamation-triangle me-2"></i>预览生成失败
          </td>
        </tr>
      `;
    });
    this.previewTableBody.innerHTML = html;
  }
  
  /**
   * 渲染预览表格
   * @param {Array} metadata - 文件元数据数组
   */
  renderPreviewTable(metadata) {
    let html = '';
    
    metadata.forEach((item, index) => {
      const previewClass = item.success ? 'preview-status-success' : 'preview-status-error';
      
      html += `
        <tr>
          <td class="preview-filename" title="${item.originalPath || item.originalName}">
            ${item.originalName}
          </td>
          <td class="preview-filename ${previewClass}" title="${item.previewName}">
            ${item.previewName}
          </td>
        </tr>
      `;
    });
    
    this.previewTableBody.innerHTML = html;
  }
  
  /**
   * 实时更新预览（当表单字段变更时）
   */
  async refreshPreview() {
    if (selectedFiles.length === 0) return;
    
    // 显示加载状态
    this.showLoadingState(selectedFiles);
    
    // 获取表单字段
    const fields = this.getFormFields();
    
    // 重新获取预览数据
    try {
      const metadata = await window.electronAPI.getFileMetadata({ filePaths: selectedFiles, fields });
      previewData = metadata;
      this.renderPreviewTable(metadata);
    } catch (error) {
      console.error('刷新预览失败:', error);
      this.showErrorState(selectedFiles, error.message);
    }
  }
}

/**
 * 进度管理器类
 * 负责显示和管理操作进度
 */
class ProgressManager {
  constructor() {
    this.modal = null;
    this.progressBar = null;
    this.progressText = null;
    this.currentFile = null;
    this.successCount = null;
    this.errorCount = null;
    this.remainingCount = null;
    this.progressLog = null;
    this.isCancelled = false;
  }
  
  /**
   * 初始化进度管理器
   */
  init() {
    try {
      if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        console.error('Bootstrap Modal未加载');
        return;
      }
      
      this.modal = new bootstrap.Modal(document.getElementById('progressModal'));
      this.progressBar = document.getElementById('progress-bar');
      this.progressText = document.getElementById('progress-text');
      this.currentFile = document.getElementById('current-file');
      this.successCount = document.getElementById('success-count');
      this.errorCount = document.getElementById('error-count');
      this.remainingCount = document.getElementById('remaining-count');
      this.progressLog = document.getElementById('progress-log');
      
      // 取消按钮事件
      document.getElementById('cancel-operation').addEventListener('click', () => {
        this.cancel();
      });
      
      // 完成按钮事件
      document.getElementById('close-progress').addEventListener('click', () => {
        this.close();
      });
    } catch (error) {
      console.error('ProgressManager初始化失败:', error);
    }
  }
  
  /**
   * 显示进度对话框
   * @param {number} totalFiles - 总文件数
   */
  show(totalFiles) {
    try {
      this.isCancelled = false;
      this.reset();
      this.remainingCount.textContent = totalFiles;
      this.progressText.textContent = `0 / ${totalFiles}`;
      
      if (this.modal) {
        this.modal.show();
      } else {
        console.error('Progress modal未初始化');
      }
      
      // 启用取消按钮
      document.getElementById('cancel-operation').disabled = false;
      document.getElementById('close-progress').style.display = 'none';
    } catch (error) {
      console.error('显示进度对话框失败:', error);
    }
  }
  
  /**
   * 更新进度
   * @param {number} current - 当前进度
   * @param {number} total - 总数
   * @param {string} fileName - 当前文件名
   */
  updateProgress(current, total, fileName) {
    if (this.isCancelled) return;
    
    const percentage = Math.round((current / total) * 100);
    this.progressBar.style.width = `${percentage}%`;
    this.progressBar.setAttribute('aria-valuenow', percentage);
    this.progressText.textContent = `${current} / ${total}`;
    this.currentFile.textContent = fileName;
    this.remainingCount.textContent = total - current;
  }
  
  /**
   * 更新计数
   * @param {number} success - 成功数
   * @param {number} error - 错误数
   */
  updateCounts(success, error) {
    this.successCount.textContent = success;
    this.errorCount.textContent = error;
  }
  
  /**
   * 添加日志
   * @param {string} message - 日志消息
   * @param {string} type - 日志类型
   */
  addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logClass = type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-muted';
    const logEntry = document.createElement('div');
    logEntry.className = `small ${logClass}`;
    logEntry.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
    this.progressLog.appendChild(logEntry);
    this.progressLog.scrollTop = this.progressLog.scrollHeight;
  }
  
  /**
   * 完成操作
   */
  complete() {
    this.currentFile.textContent = '处理完成';
    this.progressBar.classList.remove('progress-bar-animated');
    
    // 禁用取消按钮，显示完成按钮
    document.getElementById('cancel-operation').disabled = true;
    document.getElementById('close-progress').style.display = 'inline-block';
    
    this.addLog('所有文件处理完成', 'success');
  }
  
  /**
   * 取消操作
   */
  cancel() {
    this.isCancelled = true;
    this.currentFile.textContent = '操作已取消';
    this.addLog('用户取消了操作', 'error');
    this.complete();
  }
  
  /**
   * 关闭进度对话框
   */
  close() {
    try {
      if (this.modal) {
        this.modal.hide();
      }
    } catch (error) {
      console.error('关闭进度对话框失败:', error);
    }
  }
  
  /**
   * 重置进度状态
   */
  reset() {
    this.progressBar.style.width = '0%';
    this.progressBar.classList.add('progress-bar-animated');
    this.successCount.textContent = '0';
    this.errorCount.textContent = '0';
    this.remainingCount.textContent = '0';
    this.progressLog.innerHTML = '';
    this.currentFile.textContent = '准备开始...';
  }
}

/**
 * 撤回功能管理器
 */
class UndoManager {
  constructor() {
    console.log('=== 初始化撤回管理器 ===');
    this.undoButton = document.getElementById('undo-rename');
    console.log('撤回按钮元素:', this.undoButton);
    this.setupEventListeners();
    this.updateUndoButtonState();
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 撤回按钮点击事件
    this.undoButton.addEventListener('click', () => {
      console.log('=== 撤回按钮被点击 ===');
      console.log('按钮状态 - disabled:', this.undoButton.disabled);
      console.log('按钮标题:', this.undoButton.title);
      this.showUndoConfirmDialog();
    });
    
    // 撤回确认对话框事件
    document.getElementById('confirm-undo-checkbox').addEventListener('change', (e) => {
      document.getElementById('confirm-undo-btn').disabled = !e.target.checked;
    });
    
    document.getElementById('confirm-undo-btn').addEventListener('click', () => {
      this.performUndo();
    });
    
    document.getElementById('close-undo-progress').addEventListener('click', () => {
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(document.getElementById('undoProgressModal'));
          if (modal) {
            modal.hide();
          }
        }
      } catch (error) {
        console.error('关闭撤回进度对话框失败:', error);
      }
    });
  }
  
  /**
   * 更新撤回按钮状态
   */
  async updateUndoButtonState() {
    console.log('=== 更新撤回按钮状态 ===');
    try {
      const status = await window.electronAPI.getUndoStatus();
      console.log('撤回状态:', status);
      
      this.undoButton.disabled = !status.canUndo;
      
      if (status.canUndo) {
        this.undoButton.title = status.message;
        console.log('撤回按钮已启用:', status.message);
      } else {
        this.undoButton.title = '没有可撤回的操作';
        console.log('撤回按钮已禁用: 没有可撤回的操作');
      }
    } catch (error) {
      console.error('获取撤回状态失败:', error);
      this.undoButton.disabled = true;
    }
  }
  
  /**
   * 显示撤回确认对话框
   */
  async showUndoConfirmDialog() {
    try {
      const status = await window.electronAPI.getUndoStatus();
      
      if (!status.canUndo) {
        showAlert('没有可撤回的重命名操作', 'info');
        return;
      }
      
      // 显示撤回详情
      const detailsHtml = `
        <div class="mb-2">
          <strong>操作时间：</strong>${new Date(status.timestamp).toLocaleString()}
        </div>
        <div class="mb-2">
          <strong>文件数量：</strong>${status.operationCount} 个文件
        </div>
        <div class="text-muted small">
          此操作将把这些文件的名称恢复到重命名前的状态。
        </div>
      `;
      
      document.getElementById('undo-details').innerHTML = detailsHtml;
      
      // 重置确认复选框
      document.getElementById('confirm-undo-checkbox').checked = false;
      document.getElementById('confirm-undo-btn').disabled = true;
      
      // 显示确认对话框
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(document.getElementById('undoConfirmModal'));
        modal.show();
      } else {
        console.error('Bootstrap Modal未加载');
        showAlert('界面组件未加载完成，请刷新页面重试', 'danger');
      }
      
    } catch (error) {
      console.error('显示撤回确认对话框失败:', error);
      showAlert('获取撤回信息失败：' + error.message, 'danger');
    }
  }
  
  /**
   * 执行撤回操作
   */
  async performUndo() {
    try {
      // 隐藏确认对话框
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const confirmModal = bootstrap.Modal.getInstance(document.getElementById('undoConfirmModal'));
        if (confirmModal) {
          confirmModal.hide();
        }
      }
      
      // 显示进度对话框
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const progressModal = new bootstrap.Modal(document.getElementById('undoProgressModal'));
        progressModal.show();
      } else {
        console.error('Bootstrap Modal未加载');
        showAlert('界面组件未加载完成，请刷新页面重试', 'danger');
        return;
      }
    
      try {
        const result = await window.electronAPI.undoLastRename();
        
        // 更新进度显示
        document.getElementById('undo-progress-text').textContent = '撤回完成';
        document.getElementById('undo-status').innerHTML = this.generateUndoResultHtml(result);
        document.getElementById('close-undo-progress').style.display = 'block';
        
        // 更新撤回按钮状态
        await this.updateUndoButtonState();
        
        // 如果当前有预览数据，刷新预览
        if (selectedFiles.length > 0) {
          window.previewManager.refreshPreview();
        }
        
      } catch (error) {
        console.error('撤回操作失败:', error);
        document.getElementById('undo-progress-text').textContent = '撤回失败';
        document.getElementById('undo-status').innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            撤回操作失败：${error.message}
          </div>
        `;
        document.getElementById('close-undo-progress').style.display = 'block';
      }
    } catch (error) {
      console.error('执行撤回操作失败:', error);
      showAlert('撤回操作失败：' + error.message, 'danger');
    }
  }
  
  /**
   * 生成撤回结果HTML
   * @param {Object} result - 撤回结果
   * @returns {string} HTML字符串
   */
  generateUndoResultHtml(result) {
    let html = '';
    
    if (result.success) {
      html += `
        <div class="alert alert-success">
          <i class="bi bi-check-circle me-2"></i>
          撤回操作完成！成功恢复 ${result.successCount} 个文件的名称。
        </div>
      `;
    } else {
      html += `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          撤回操作失败！
        </div>
      `;
    }
    
    if (result.errorCount > 0) {
      html += `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          ${result.errorCount} 个文件撤回失败，请检查文件是否被占用或已被移动。
        </div>
      `;
    }
    
    return html;
  }
}

/**
 * 更新文件列表显示（现在使用预览管理器）
 * @param {Array} files - 文件路径数组
 */
async function updateFileListDisplay(files) {
  await window.previewManager.updatePreview(files);
}

/**
 * 设置拖拽和文件选择功能
 */
function setupDragAndDrop() {
  const fileListDiv = document.getElementById('drop-zone');
  
  // 阻止默认拖拽行为
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileListDiv.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // 高亮拖拽区域
  ['dragenter', 'dragover'].forEach(eventName => {
    fileListDiv.addEventListener(eventName, highlight, false);
  });
  
  // 取消高亮
  ['dragleave', 'drop'].forEach(eventName => {
    fileListDiv.addEventListener(eventName, unhighlight, false);
  });
  
  // 处理文件拖拽
  fileListDiv.addEventListener('drop', handleDrop, false);
  
  // 添加点击事件处理（合并文件选择功能）
  fileListDiv.addEventListener('click', async () => {
    console.log('=== 点击拖拽区域选择文件 ===');
    
    const files = await window.electronAPI.selectFiles();
    console.log('点击选择文件数量:', files ? files.length : 0);
    
    if (files && files.length > 0) {
      selectedFiles = files;
      updateFileListDisplay(files);
      
      // 自动填入视频名
      autoFillVideoName(files);
      showAlert(`成功选择 ${files.length} 个视频文件`, 'success');
    }
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight(e) {
    fileListDiv.classList.add('drag-over');
  }
  
  function unhighlight(e) {
    fileListDiv.classList.remove('drag-over');
  }
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    handleFiles(files);
  }
  
  async function handleFiles(files) {
    const fileArray = Array.from(files);
    
    console.log('=== 拖拽文件处理 ===');
    console.log('拖拽文件数量:', fileArray.length);
    
    // 修复：使用 Electron 的 webUtils.getPathForFile() 获取拖拽文件路径
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
        selectedFiles = validFiles;
        updateFileListDisplay(validFiles);
        
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
}

/**
 * 添加表单字段变更监听器
 */
function setupFormFieldListeners() {
  // 防抖函数，避免频繁更新
  let debounceTimer;
  const debounceDelay = 500; // 500ms延迟
  
  function debouncedRefresh() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      window.previewManager.refreshPreview();
    }, debounceDelay);
  }
  
  // 为所有表单字段添加监听器
  const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  fieldNames.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    field.addEventListener('input', debouncedRefresh);
    field.addEventListener('change', debouncedRefresh);
  });
}

/**
 * 添加新的事件监听器
 */
function setupNewEventListeners() {
  // 字段验证事件
  const allFieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  allFieldNames.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    
    // 实时验证
    field.addEventListener('input', (e) => {
      FieldValidator.validateField(fieldName, e.target.value);
    });
    
    field.addEventListener('blur', (e) => {
      FieldValidator.validateField(fieldName, e.target.value);
    });
  });
}

// 导出全局变量和函数供其他模块使用
window.selectedFiles = selectedFiles;
window.previewData = previewData;
window.updateFileListDisplay = updateFileListDisplay;
// 导出全局变量和函数供其他模块使用
window.selectedFiles = selectedFiles;
window.previewData = previewData;
window.updateFileListDisplay = updateFileListDisplay;

// 创建全局实例变量
window.previewManager = null;
window.progressManager = null;
window.undoManager = null;
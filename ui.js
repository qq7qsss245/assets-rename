/**
 * UI交互功能模块
 * 负责处理用户界面交互、拖拽、进度显示等功能
 */

// 全局状态
window.selectedFiles = [];
window.previewData = [];

/**
 * 文件管理器 - 负责文件选择和预览
 */
class FileManager {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.previewTable = document.getElementById('preview-table');
    this.previewTableBody = document.getElementById('preview-table-body');
    this.init();
  }
  
  init() {
    this.setupDragAndDrop();
    this.setupClickSelect();
  }
  
  /**
   * 设置拖拽功能
   */
  setupDragAndDrop() {
    // 阻止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // 拖拽高亮
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.add('drag-over');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.remove('drag-over');
      }, false);
    });
    
    // 处理文件拖拽
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
  }
  
  /**
   * 设置点击选择功能
   */
  setupClickSelect() {
    this.dropZone.addEventListener('click', async () => {
      try {
        const files = await window.electronAPI.selectFiles();
        if (files && files.length > 0) {
          this.handleFiles(files);
        }
      } catch (error) {
        console.error('选择文件失败:', error);
        showAlert('选择文件失败', 'danger');
      }
    });
  }
  
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  async handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    
    // 获取文件路径
    const filePaths = [];
    for (const file of files) {
      try {
        const filePath = await window.electronAPI.getPathForFile(file);
        if (filePath) {
          filePaths.push(filePath);
        }
      } catch (error) {
        console.error('获取文件路径失败:', error);
      }
    }
    
    if (filePaths.length > 0) {
      this.handleFiles(filePaths);
    } else {
      showAlert('无法获取拖拽文件的路径，请使用点击选择文件功能', 'danger');
    }
  }
  
  /**
   * 处理文件列表
   */
  async handleFiles(files) {
    try {
      // 验证文件
      const { validFiles, invalidFiles } = await window.electronAPI.validateVideoFiles(files);
      
      if (validFiles.length > 0) {
        // 更新全局状态
        window.selectedFiles = validFiles;
        
        // 切换到预览模式
        this.showPreview();
        
        // 生成预览
        await this.generatePreview(validFiles);
        
        // 自动填入视频名
        if (typeof autoFillVideoName === 'function') {
          autoFillVideoName(validFiles);
        }
        
        // 显示成功消息
        if (invalidFiles.length > 0) {
          const invalidNames = invalidFiles.map(path => path.split(/[/\\]/).pop());
          showAlert(
            `成功添加 ${validFiles.length} 个视频文件。忽略了 ${invalidFiles.length} 个不支持的文件：${invalidNames.join(', ')}`,
            'warning'
          );
        } else {
          showAlert(`成功选择 ${validFiles.length} 个视频文件`, 'success');
        }
      } else {
        if (invalidFiles.length > 0) {
          const invalidNames = invalidFiles.map(path => path.split(/[/\\]/).pop());
          showAlert(`不支持的文件格式：${invalidNames.join(', ')}`, 'danger');
        }
      }
    } catch (error) {
      console.error('处理文件失败:', error);
      showAlert('处理文件失败，请重试', 'danger');
    }
  }
  
  /**
   * 显示预览模式
   */
  showPreview() {
    this.dropZone.classList.add('d-none');
    this.previewTable.classList.remove('d-none');
  }
  
  /**
   * 显示拖拽模式
   */
  showDropZone() {
    this.dropZone.classList.remove('d-none');
    this.previewTable.classList.add('d-none');
    window.selectedFiles = [];
    window.previewData = [];
  }
  
  /**
   * 生成预览
   */
  async generatePreview(files) {
    // 显示加载状态
    this.showLoadingState(files);
    
    try {
      // 获取表单字段
      const fields = this.getFormFields();
      
      // 获取文件元数据
      const metadata = await window.electronAPI.getFileMetadata({ filePaths: files, fields });
      window.previewData = metadata;
      
      // 渲染预览表格
      this.renderPreviewTable(metadata);
    } catch (error) {
      console.error('生成预览失败:', error);
      this.showErrorState(files, error.message);
    }
  }
  
  /**
   * 获取表单字段
   */
  getFormFields() {
    return {
      product: document.getElementById('product').value.trim() || '产品名',
      template: document.getElementById('template').value.trim() || '模板名',
      video: document.getElementById('video').value.trim(),
      author: document.getElementById('author').value.trim() || '制作人',
      duration: document.getElementById('duration').value.trim() || '1',
      language: document.getElementById('language').value.trim() || ''
    };
  }
  
  /**
   * 显示加载状态
   */
  showLoadingState(files) {
    let html = '';
    files.forEach((filePath) => {
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
   */
  showErrorState(files, errorMessage) {
    let html = '';
    files.forEach((filePath) => {
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
   */
  renderPreviewTable(metadata) {
    let html = '';
    
    metadata.forEach((item) => {
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
   * 刷新预览
   */
  async refreshPreview() {
    if (window.selectedFiles.length === 0) return;
    await this.generatePreview(window.selectedFiles);
  }
}

/**
 * 撤回功能管理器
 */
class UndoManager {
  constructor() {
    this.undoButton = document.getElementById('undo-rename');
    this.setupEventListeners();
    this.updateUndoButtonState();
  }
  
  setupEventListeners() {
    // 撤回按钮点击事件
    this.undoButton.addEventListener('click', () => {
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
        const modal = bootstrap.Modal.getInstance(document.getElementById('undoProgressModal'));
        if (modal) {
          modal.hide();
        }
      } catch (error) {
        console.error('关闭撤回进度对话框失败:', error);
      }
    });
  }
  
  async updateUndoButtonState() {
    try {
      const status = await window.electronAPI.getUndoStatus();
      this.undoButton.disabled = !status.canUndo;
      this.undoButton.title = status.canUndo ? status.message : '没有可撤回的操作';
    } catch (error) {
      console.error('获取撤回状态失败:', error);
      this.undoButton.disabled = true;
    }
  }
  
  async showUndoConfirmDialog() {
    try {
      // 诊断日志：检查Bootstrap可用性
      console.log('=== 撤回弹窗诊断开始 ===');
      console.log('Bootstrap可用:', typeof bootstrap !== 'undefined');
      console.log('Bootstrap.Modal可用:', typeof bootstrap !== 'undefined' && !!bootstrap.Modal);
      
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
      
      // 诊断日志：检查弹窗元素
      const modalElement = document.getElementById('undoConfirmModal');
      console.log('弹窗元素存在:', !!modalElement);
      console.log('弹窗元素类名:', modalElement ? modalElement.className : 'N/A');
      
      // 检查Bootstrap CSS是否加载
      const computedStyle = window.getComputedStyle(modalElement);
      console.log('弹窗display样式:', computedStyle.display);
      console.log('弹窗position样式:', computedStyle.position);
      
      // 显示确认对话框
      const modal = new bootstrap.Modal(modalElement);
      console.log('Modal实例创建成功:', !!modal);
      
      modal.show();
      console.log('Modal.show()调用完成');
      
      // 检查弹窗显示后的状态
      setTimeout(() => {
        const afterStyle = window.getComputedStyle(modalElement);
        console.log('显示后display样式:', afterStyle.display);
        console.log('显示后z-index样式:', afterStyle.zIndex);
        console.log('=== 撤回弹窗诊断结束 ===');
      }, 100);
      
    } catch (error) {
      console.error('显示撤回确认对话框失败:', error);
      console.error('错误堆栈:', error.stack);
      showAlert('获取撤回信息失败：' + error.message, 'danger');
    }
  }
  
  async performUndo() {
    try {
      // 隐藏确认对话框
      const confirmModal = bootstrap.Modal.getInstance(document.getElementById('undoConfirmModal'));
      if (confirmModal) {
        confirmModal.hide();
      }
      
      // 诊断日志：检查撤回进度弹窗
      console.log('=== 撤回进度弹窗诊断开始 ===');
      const progressModalElement = document.getElementById('undoProgressModal');
      console.log('进度弹窗元素存在:', !!progressModalElement);
      console.log('进度弹窗元素类名:', progressModalElement ? progressModalElement.className : 'N/A');
      
      // 检查进度弹窗的样式
      const progressComputedStyle = window.getComputedStyle(progressModalElement);
      console.log('进度弹窗display样式:', progressComputedStyle.display);
      console.log('进度弹窗position样式:', progressComputedStyle.position);
      
      // 显示进度对话框
      const progressModal = new bootstrap.Modal(progressModalElement);
      console.log('进度Modal实例创建成功:', !!progressModal);
      
      progressModal.show();
      console.log('进度Modal.show()调用完成');
      
      // 检查进度弹窗显示后的状态
      setTimeout(() => {
        const afterProgressStyle = window.getComputedStyle(progressModalElement);
        console.log('进度弹窗显示后display样式:', afterProgressStyle.display);
        console.log('进度弹窗显示后z-index样式:', afterProgressStyle.zIndex);
        console.log('=== 撤回进度弹窗诊断结束 ===');
      }, 100);
    
      const result = await window.electronAPI.undoLastRename();
      
      // 更新进度显示
      document.getElementById('undo-progress-text').textContent = '撤回完成';
      document.getElementById('undo-status').innerHTML = this.generateUndoResultHtml(result);
      document.getElementById('close-undo-progress').style.display = 'block';
      
      // 更新撤回按钮状态
      await this.updateUndoButtonState();
      
    } catch (error) {
      console.error('撤回操作失败:', error);
      console.error('错误堆栈:', error.stack);
      document.getElementById('undo-status').innerHTML = `
        <div class="text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>撤回操作失败：${error.message}
        </div>
      `;
      document.getElementById('close-undo-progress').style.display = 'block';
    }
  }
  
  generateUndoResultHtml(result) {
    if (!result.success) {
      return `
        <div class="text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>撤回操作失败：${result.error}
        </div>
      `;
    }
    
    return `
      <div class="text-success mb-2">
        <i class="bi bi-check-circle me-2"></i>撤回操作完成
      </div>
      <div class="small text-muted">
        成功撤回 ${result.successCount} 个文件，失败 ${result.errorCount} 个文件
      </div>
    `;
  }
}

/**
 * 进度管理器类
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
  
  init() {
    try {
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
  
  show(totalFiles) {
    try {
      this.isCancelled = false;
      this.reset();
      this.remainingCount.textContent = totalFiles;
      this.progressText.textContent = `0 / ${totalFiles}`;
      
      if (this.modal) {
        this.modal.show();
      }
      
      document.getElementById('cancel-operation').disabled = false;
      document.getElementById('close-progress').style.display = 'none';
    } catch (error) {
      console.error('显示进度对话框失败:', error);
    }
  }
  
  updateProgress(current, total, fileName) {
    if (this.isCancelled) return;
    
    const percentage = Math.round((current / total) * 100);
    this.progressBar.style.width = `${percentage}%`;
    this.progressBar.setAttribute('aria-valuenow', percentage);
    this.progressText.textContent = `${current} / ${total}`;
    this.currentFile.textContent = fileName;
    this.remainingCount.textContent = total - current;
  }
  
  updateCounts(success, error) {
    this.successCount.textContent = success;
    this.errorCount.textContent = error;
  }
  
  addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logClass = type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-muted';
    const logEntry = document.createElement('div');
    logEntry.className = `small ${logClass}`;
    logEntry.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
    this.progressLog.appendChild(logEntry);
    this.progressLog.scrollTop = this.progressLog.scrollHeight;
  }
  
  complete() {
    this.currentFile.textContent = '处理完成';
    this.progressBar.classList.remove('progress-bar-animated');
    
    document.getElementById('cancel-operation').disabled = true;
    document.getElementById('close-progress').style.display = 'inline-block';
    
    this.addLog('所有文件处理完成', 'success');
  }
  
  cancel() {
    this.isCancelled = true;
    this.currentFile.textContent = '操作已取消';
    this.addLog('用户取消了操作', 'error');
    this.complete();
  }
  
  close() {
    try {
      if (this.modal) {
        this.modal.hide();
      }
    } catch (error) {
      console.error('关闭进度对话框失败:', error);
    }
  }
  
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
 * 添加表单字段变更监听器
 */
function setupFormFieldListeners() {
  let debounceTimer;
  const debounceDelay = 500;
  
  function debouncedRefresh() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (window.fileManager) {
        window.fileManager.refreshPreview();
      }
    }, debounceDelay);
  }
  
  const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  fieldNames.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    field.addEventListener('input', debouncedRefresh);
    field.addEventListener('change', debouncedRefresh);
  });
}

/**
 * 添加字段验证事件监听器
 */
function setupFieldValidation() {
  const allFieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];
  allFieldNames.forEach(fieldName => {
    const field = document.getElementById(fieldName);
    
    field.addEventListener('input', (e) => {
      if (typeof FieldValidator !== 'undefined') {
        FieldValidator.validateField(fieldName, e.target.value);
      }
    });
    
    field.addEventListener('blur', (e) => {
      if (typeof FieldValidator !== 'undefined') {
        FieldValidator.validateField(fieldName, e.target.value);
      }
    });
  });
}

// 导出函数供其他模块使用
window.updateFileListDisplay = function(files) {
  if (window.fileManager) {
    window.fileManager.handleFiles(files);
  }
};

// 创建全局实例变量
window.fileManager = null;
window.progressManager = null;
window.undoManager = null;
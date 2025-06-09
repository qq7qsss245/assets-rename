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
    this.dragOverlay = document.getElementById('drag-overlay');
    this.addMoreButton = document.getElementById('add-more-files');
    this.selectedRowIndex = -1; // 当前选中的行索引
    this.init();
  }
  
  init() {
    this.setupDragAndDrop();
    this.setupClickSelect();
    this.setupPreviewDragAndDrop();
    this.setupAddMoreButton();
    this.setupKeyboardEvents();
    this.setupRowSelection();
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
   * @param {Array} files - 文件路径数组
   * @param {boolean} isAppending - 是否为追加模式（默认false为替换模式）
   */
  async handleFiles(files, isAppending = false) {
    try {
      // 验证文件
      const { validFiles, invalidFiles } = await window.electronAPI.validateVideoFiles(files);
      
      if (validFiles.length > 0) {
        let newFilesCount = validFiles.length;
        
        // 更新全局状态
        if (isAppending && window.selectedFiles.length > 0) {
          // 追加模式：合并到现有文件列表，去重
          const existingFiles = new Set(window.selectedFiles);
          const newFiles = validFiles.filter(file => !existingFiles.has(file));
          
          if (newFiles.length === 0) {
            showAlert('所选文件已存在于列表中', 'info');
            return;
          }
          
          window.selectedFiles = [...window.selectedFiles, ...newFiles];
          newFilesCount = newFiles.length;
        } else {
          // 替换模式：直接替换
          window.selectedFiles = validFiles;
        }
        
        // 切换到预览模式
        this.showPreview();
        
        // 生成预览
        await this.generatePreview(window.selectedFiles);
        
        // 自动填入视频名
        if (typeof autoFillVideoName === 'function') {
          autoFillVideoName(window.selectedFiles);
        }
        
        // 显示成功消息
        const actionText = isAppending ? '添加' : '选择';
        const totalFiles = window.selectedFiles.length;
        
        if (invalidFiles.length > 0) {
          const invalidNames = invalidFiles.map(path => path.split(/[/\\]/).pop());
          showAlert(
            `成功${actionText} ${newFilesCount} 个视频文件${isAppending ? `（总计 ${totalFiles} 个）` : ''}。忽略了 ${invalidFiles.length} 个不支持的文件：${invalidNames.join(', ')}`,
            'warning'
          );
        } else {
          showAlert(
            `成功${actionText} ${newFilesCount} 个视频文件${isAppending ? `（总计 ${totalFiles} 个）` : ''}`,
            'success'
          );
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
    this.clearRowSelection();
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
    // === 焦点状态保护机制开始 ===
    console.log('[焦点保护] 开始保存焦点状态');
    
    // 保存当前活动元素和焦点状态
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
    
    // 保存输入框的详细状态
    let focusRestoreInfo = null;
    if (isInputFocused) {
      focusRestoreInfo = {
        element: activeElement,
        id: activeElement.id,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
        value: activeElement.value
      };
      console.log('[焦点保护] 检测到输入框焦点，保存状态:', {
        id: focusRestoreInfo.id,
        selectionStart: focusRestoreInfo.selectionStart,
        selectionEnd: focusRestoreInfo.selectionEnd
      });
    }
    // === 焦点状态保护机制结束 ===
    
    let html = '';
    
    metadata.forEach((item, index) => {
      const previewClass = item.success ? 'preview-status-success' : 'preview-status-error';
      
      html += `
        <tr data-file-index="${index}" tabindex="0" class="table-row-clickable">
          <td class="preview-filename" title="${item.originalPath || item.originalName}">
            ${item.originalName}
          </td>
          <td class="preview-filename ${previewClass}" title="${item.previewName}">
            ${item.previewName}
          </td>
          <td class="text-center">
            <button type="button" class="delete-file-btn" data-file-index="${index}" title="删除此文件">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    
    this.previewTableBody.innerHTML = html;
    
    // 绑定删除按钮事件
    this.bindDeleteButtons();
    
    // === 焦点恢复机制开始 ===
    // 优化自动焦点转移逻辑：只有在没有输入框焦点时才自动选中表格行
    if (metadata.length > 0) {
      if (isInputFocused && focusRestoreInfo) {
        // 恢复输入框焦点
        console.log('[焦点保护] 尝试恢复输入框焦点');
        setTimeout(() => {
          try {
            // 重新获取元素（因为DOM可能已更新）
            const elementToFocus = document.getElementById(focusRestoreInfo.id) || focusRestoreInfo.element;
            
            if (elementToFocus && elementToFocus.focus) {
              elementToFocus.focus();
              
              // 恢复光标位置
              if (typeof elementToFocus.setSelectionRange === 'function' &&
                  focusRestoreInfo.selectionStart !== null &&
                  focusRestoreInfo.selectionEnd !== null) {
                elementToFocus.setSelectionRange(focusRestoreInfo.selectionStart, focusRestoreInfo.selectionEnd);
              }
              
              console.log('[焦点保护] 成功恢复输入框焦点和光标位置');
            } else {
              console.warn('[焦点保护] 无法找到要恢复焦点的元素:', focusRestoreInfo.id);
            }
          } catch (error) {
            console.error('[焦点保护] 恢复焦点失败:', error);
          }
        }, 10);
      } else {
        // 没有输入框焦点时才自动选中表格行
        console.log('[焦点保护] 没有输入框焦点，自动选中第一行');
        setTimeout(() => {
          this.selectRow(0);
        }, 10);
      }
    }
    // === 焦点恢复机制结束 ===
  }
  
  /**
   * 刷新预览
   */
  async refreshPreview() {
    if (window.selectedFiles.length === 0) return;
    await this.generatePreview(window.selectedFiles);
  }
  
  /**
   * 设置预览界面的拖拽功能
   */
  setupPreviewDragAndDrop() {
    // 阻止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.previewTable.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // 拖拽进入预览区域
    this.previewTable.addEventListener('dragenter', (e) => {
      if (e.dataTransfer.files.length > 0) {
        this.showDragOverlay();
      }
    }, false);
    
    // 拖拽在预览区域上方
    this.previewTable.addEventListener('dragover', (e) => {
      if (e.dataTransfer.files.length > 0) {
        this.showDragOverlay();
      }
    }, false);
    
    // 拖拽离开预览区域
    this.previewTable.addEventListener('dragleave', (e) => {
      // 检查是否真的离开了预览区域（而不是进入子元素）
      if (!this.previewTable.contains(e.relatedTarget)) {
        this.hideDragOverlay();
      }
    }, false);
    
    // 处理文件拖拽到预览区域
    this.previewTable.addEventListener('drop', async (e) => {
      this.hideDragOverlay();
      
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
        // 追加模式处理文件
        this.handleFiles(filePaths, true);
      } else {
        showAlert('无法获取拖拽文件的路径，请使用点击选择文件功能', 'danger');
      }
    }, false);
  }
  
  /**
   * 设置添加更多文件按钮
   */
  setupAddMoreButton() {
    if (this.addMoreButton) {
      this.addMoreButton.addEventListener('click', async () => {
        try {
          const files = await window.electronAPI.selectFiles();
          if (files && files.length > 0) {
            // 追加模式处理文件
            this.handleFiles(files, true);
          }
        } catch (error) {
          console.error('选择文件失败:', error);
          showAlert('选择文件失败', 'danger');
        }
      });
    }
  }
  
  /**
   * 设置键盘事件监听
   */
  setupKeyboardEvents() {
    // 监听全局键盘事件
    document.addEventListener('keydown', (e) => {
      // 只在预览界面显示时处理键盘事件
      if (this.previewTable.classList.contains('d-none')) {
        return;
      }
      
      // 检查是否在输入框中，如果是则不处理
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // 处理键盘事件
      switch (e.key) {
        case 'Backspace':
        case 'Delete':
          if (this.selectedRowIndex >= 0) {
            e.preventDefault();
            this.deleteSelectedFile();
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          this.selectPreviousRow();
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          this.selectNextRow();
          break;
      }
    });
  }
  
  /**
   * 设置行选中功能
   */
  setupRowSelection() {
    // 使用事件委托监听表格行点击
    this.previewTableBody.addEventListener('click', (e) => {
      // 如果点击的是删除按钮，不处理行选中
      if (e.target.closest('.delete-file-btn')) {
        return;
      }
      
      const row = e.target.closest('tr');
      if (row && row.hasAttribute('data-file-index')) {
        const fileIndex = parseInt(row.getAttribute('data-file-index'));
        this.selectRow(fileIndex);
      }
    });
  }
  
  /**
   * 选中指定行
   * @param {number} fileIndex - 文件索引
   */
  selectRow(fileIndex) {
    // 移除之前选中行的样式
    this.clearRowSelection();
    
    // 设置新的选中行
    this.selectedRowIndex = fileIndex;
    
    // 添加选中样式
    const row = this.previewTableBody.querySelector(`tr[data-file-index="${fileIndex}"]`);
    if (row) {
      row.classList.add('table-row-selected');
      
      // 检查当前是否有输入框获得焦点
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );
      
      // 只有在没有输入框焦点时才设置表格行焦点
      if (!isInputFocused) {
        row.focus();
        console.log('[焦点保护] 设置表格行焦点，索引:', fileIndex);
      } else {
        console.log('[焦点保护] 检测到输入框焦点，跳过表格行焦点设置');
      }
      
      // 确保选中的行在视口内可见
      row.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }
  
  /**
   * 清除行选中状态
   */
  clearRowSelection() {
    // 移除所有行的选中样式
    const selectedRows = this.previewTableBody.querySelectorAll('.table-row-selected');
    selectedRows.forEach(row => {
      row.classList.remove('table-row-selected');
    });
    this.selectedRowIndex = -1;
  }
  
  /**
   * 删除选中的文件
   */
  async deleteSelectedFile() {
    if (this.selectedRowIndex < 0 || this.selectedRowIndex >= window.selectedFiles.length) {
      return;
    }
    
    try {
      const deletedIndex = this.selectedRowIndex;
      
      // 从数组中移除文件
      window.selectedFiles.splice(this.selectedRowIndex, 1);
      
      // 检查是否还有文件
      if (window.selectedFiles.length === 0) {
        // 没有文件了，返回拖拽界面
        this.showDropZone();
      } else {
        // 重新生成预览
        await this.generatePreview(window.selectedFiles);
        
        // 智能选中下一条记录
        let newSelectedIndex = deletedIndex;
        if (newSelectedIndex >= window.selectedFiles.length) {
          // 如果删除的是最后一条，选中新的最后一条
          newSelectedIndex = window.selectedFiles.length - 1;
        }
        
        if (newSelectedIndex >= 0 && newSelectedIndex < window.selectedFiles.length) {
          setTimeout(() => {
            this.selectRow(newSelectedIndex);
          }, 10);
        }
      }
    } catch (error) {
      console.error('删除文件失败:', error);
      showAlert('删除文件失败', 'danger');
    }
  }
  
  /**
   * 选中上一行
   */
  selectPreviousRow() {
    if (window.selectedFiles.length === 0) return;
    
    if (this.selectedRowIndex <= 0) {
      // 如果当前是第一行或没有选中，选中最后一行
      this.selectRow(window.selectedFiles.length - 1);
    } else {
      // 选中上一行
      this.selectRow(this.selectedRowIndex - 1);
    }
  }
  
  /**
   * 选中下一行
   */
  selectNextRow() {
    if (window.selectedFiles.length === 0) return;
    
    if (this.selectedRowIndex < 0 || this.selectedRowIndex >= window.selectedFiles.length - 1) {
      // 如果当前是最后一行或没有选中，选中第一行
      this.selectRow(0);
    } else {
      // 选中下一行
      this.selectRow(this.selectedRowIndex + 1);
    }
  }
  
  /**
   * 显示拖拽遮罩
   */
  showDragOverlay() {
    if (this.dragOverlay) {
      this.dragOverlay.classList.remove('d-none');
    }
  }
  
  /**
   * 隐藏拖拽遮罩
   */
  hideDragOverlay() {
    if (this.dragOverlay) {
      this.dragOverlay.classList.add('d-none');
    }
  }
  
  /**
   * 绑定删除按钮事件
   */
  bindDeleteButtons() {
    const deleteButtons = this.previewTableBody.querySelectorAll('.delete-file-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileIndex = parseInt(button.getAttribute('data-file-index'));
        this.deleteFile(fileIndex);
      });
    });
  }
  
  /**
   * 删除文件
   * @param {number} fileIndex - 文件索引
   */
  async deleteFile(fileIndex) {
    if (fileIndex < 0 || fileIndex >= window.selectedFiles.length) {
      console.error('无效的文件索引:', fileIndex);
      return;
    }
    
    const fileName = window.selectedFiles[fileIndex].split(/[/\\]/).pop();
    
    // 确认删除
    if (!confirm(`确定要删除文件 "${fileName}" 吗？`)) {
      return;
    }
    
    try {
      // 从数组中移除文件
      window.selectedFiles.splice(fileIndex, 1);
      
      // 检查是否还有文件
      if (window.selectedFiles.length === 0) {
        // 没有文件了，返回拖拽界面
        this.showDropZone();
        showAlert('已删除所有文件', 'info');
      } else {
        // 重新生成预览
        await this.generatePreview(window.selectedFiles);
        showAlert(`已删除文件 "${fileName}"`, 'success');
        
        // 自动选中第一条记录
        if (window.selectedFiles.length > 0) {
          setTimeout(() => {
            this.selectRow(0);
          }, 10);
        }
      }
    } catch (error) {
      console.error('删除文件失败:', error);
      showAlert('删除文件失败', 'danger');
    }
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
  const debounceDelay = 150; // 150毫秒防抖延迟，减少频繁刷新，改善用户体验
  
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
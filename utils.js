/**
 * 工具函数模块
 * 包含通用功能和辅助函数
 */

// 支持的视频文件扩展名
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm'];

/**
 * 智能文件名提取函数
 * @param {string} filename - 文件名
 * @returns {string} 提取的视频名
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
 * 自动填入视频名（仅当视频名字段为空时）
 * @param {Array} files - 文件路径数组
 */
function autoFillVideoName(files) {
  const videoField = document.getElementById('video');
  console.log('=== autoFillVideoName 调试信息 ===');
  console.log('当前视频字段值:', `"${videoField.value}"`);
  console.log('trim后是否为空:', videoField.value.trim() === '');
  console.log('文件数量:', files ? files.length : 0);
  
  if (videoField.value.trim() === '' && files && files.length > 0) {
    // 取第一个文件的文件名进行提取
    const firstFileName = files[0].split(/[/\\]/).pop();
    console.log('第一个文件名:', firstFileName);
    const extractedName = extractVideoName(firstFileName);
    console.log('提取的视频名:', extractedName);
    if (extractedName) {
      videoField.value = extractedName;
      
      // 🔧 修复：手动触发事件以更新验证状态和预览
      console.log('触发input和change事件以更新验证状态...');
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      videoField.dispatchEvent(inputEvent);
      videoField.dispatchEvent(changeEvent);
      
      console.log('自动填入视频名成功:', extractedName);
      console.log('验证状态和预览已更新');
    } else {
      console.log('提取的视频名为空，未填入');
    }
  } else {
    console.log('不满足自动填入条件');
  }
}

/**
 * 显示Toast通知
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, danger, warning, info)
 */
function showAlert(message, type) {
  // 创建Toast容器（如果不存在）
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // 创建Toast元素
  const toastId = 'toast-' + Date.now();
  const toastDiv = document.createElement('div');
  toastDiv.id = toastId;
  toastDiv.className = 'toast align-items-center border-0';
  toastDiv.role = 'alert';
  toastDiv.setAttribute('aria-live', 'assertive');
  toastDiv.setAttribute('aria-atomic', 'true');
  
  // 根据类型设置样式
  let bgClass = '';
  let iconClass = '';
  switch (type) {
    case 'success':
      bgClass = 'text-bg-success';
      iconClass = 'bi-check-circle-fill';
      break;
    case 'danger':
      bgClass = 'text-bg-danger';
      iconClass = 'bi-exclamation-triangle-fill';
      break;
    case 'warning':
      bgClass = 'text-bg-warning';
      iconClass = 'bi-exclamation-triangle-fill';
      break;
    case 'info':
      bgClass = 'text-bg-info';
      iconClass = 'bi-info-circle-fill';
      break;
    default:
      bgClass = 'text-bg-primary';
      iconClass = 'bi-info-circle-fill';
  }
  
  toastDiv.classList.add(bgClass);
  
  toastDiv.innerHTML = `
    <div class="toast-body d-flex align-items-center">
      <i class="bi ${iconClass} me-2"></i>
      ${message}
    </div>
    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
  `;
  
  // 添加到容器
  toastContainer.appendChild(toastDiv);
  
  // 初始化并显示Toast
  try {
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      const toast = new bootstrap.Toast(toastDiv, {
        autohide: true,
        delay: 3000
      });
      
      toast.show();
      
      // Toast隐藏后移除元素
      toastDiv.addEventListener('hidden.bs.toast', () => {
        toastDiv.remove();
      });
    } else {
      console.error('Bootstrap Toast未加载');
      // 降级处理：直接显示消息
      alert(message);
      toastDiv.remove();
    }
  } catch (error) {
    console.error('显示Toast失败:', error);
    // 降级处理：直接显示消息
    alert(message);
    toastDiv.remove();
  }
}

/**
 * 等待Bootstrap加载完成的函数
 * @returns {Promise} Promise对象
 */
function waitForBootstrap() {
  return new Promise((resolve) => {
    if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown && bootstrap.Modal && bootstrap.Toast) {
      resolve();
    } else {
      setTimeout(() => {
        waitForBootstrap().then(resolve);
      }, 100);
    }
  });
}

/**
 * 字段验证器类
 */
class FieldValidator {
  /**
   * 验证单个字段
   * @param {string} fieldName - 字段名
   * @param {string} value - 字段值
   * @returns {Object} 验证结果 {isValid, message}
   */
  static validateField(fieldName, value) {
    const field = document.getElementById(fieldName);
    let isValid = true;
    let message = '';
    
    switch (fieldName) {
      case 'product':
      case 'template':
      case 'video':
      case 'author':
        if (!value || value.trim().length === 0) {
          isValid = false;
          message = '此字段不能为空';
        } else if (value.trim().length > 50) {
          isValid = false;
          message = '字段长度不能超过50个字符';
        } else if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(value.trim())) {
          isValid = false;
          message = '只能包含字母、数字、中文、下划线和连字符';
        }
        break;
      case 'duration':
        const num = parseFloat(value);
        if (!value || isNaN(num) || num <= 0) {
          isValid = false;
          message = '必须是大于0的数字';
        } else if (num > 1000) {
          isValid = false;
          message = '制作时长不能超过1000小时';
        }
        break;
      case 'language':
        // 语言字段为可选，如果填写则验证格式
        if (value && value.trim().length > 0) {
          const trimmedValue = value.trim();
          if (trimmedValue.length > 10) {
            isValid = false;
            message = '语言代码长度不能超过10个字符';
          } else if (!/^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
            isValid = false;
            message = '语言代码只能包含字母、数字、下划线和连字符';
          }
        }
        break;
    }
    
    // 更新字段样式
    field.classList.remove('field-valid', 'field-invalid', 'field-warning');
    if (isValid) {
      field.classList.add('field-valid');
    } else {
      field.classList.add('field-invalid');
    }
    
    // 更新工具提示
    field.title = message || '';
    
    return { isValid, message };
  }
  
  /**
   * 验证所有字段
   * @returns {Object} 验证结果 {allValid, errors}
   */
  static validateAllFields() {
    const requiredFields = ['product', 'template', 'video', 'author', 'duration'];
    const optionalFields = ['language'];
    let allValid = true;
    const errors = [];
    
    // 验证必填字段
    requiredFields.forEach(fieldName => {
      const value = document.getElementById(fieldName).value;
      const result = FieldValidator.validateField(fieldName, value);
      if (!result.isValid) {
        allValid = false;
        errors.push(`${fieldName}: ${result.message}`);
      }
    });
    
    // 验证可选字段（只有在有值时才验证）
    optionalFields.forEach(fieldName => {
      const value = document.getElementById(fieldName).value;
      if (value && value.trim().length > 0) {
        const result = FieldValidator.validateField(fieldName, value);
        if (!result.isValid) {
          allValid = false;
          errors.push(`${fieldName}: ${result.message}`);
        }
      }
    });
    
    return { allValid, errors };
  }
}

/**
 * 显示确认对话框
 * @param {Array} filesToRename - 要重命名的文件列表
 * @returns {Promise<boolean>} 用户确认结果
 */
function showConfirmDialog(filesToRename) {
  return new Promise((resolve) => {
    try {
      if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        console.error('Bootstrap Modal未加载');
        resolve(false);
        return;
      }
      
      const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
      const confirmSummary = document.getElementById('confirm-summary');
      const confirmCheckbox = document.getElementById('confirm-checkbox');
      const confirmBtn = document.getElementById('confirm-rename');
    
    // 生成摘要
    let summaryHtml = `
      <div class="mb-3">
        <strong>即将重命名 ${filesToRename.length} 个文件：</strong>
      </div>
      <div class="list-group" style="max-height: 200px; overflow-y: auto;">
    `;
    
    filesToRename.forEach(item => {
      summaryHtml += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between">
            <span class="text-muted small">${item.originalName}</span>
            <i class="bi bi-arrow-right mx-2"></i>
            <span class="small">${item.previewName}</span>
          </div>
        </div>
      `;
    });
    
    summaryHtml += '</div>';
    confirmSummary.innerHTML = summaryHtml;
    
    // 重置状态
    confirmCheckbox.checked = false;
    confirmBtn.disabled = true;
    
    // 确认复选框事件
    confirmCheckbox.onchange = () => {
      confirmBtn.disabled = !confirmCheckbox.checked;
    };
    
      // 确认按钮事件
      confirmBtn.onclick = () => {
        modal.hide();
        resolve(true);
      };
      
      // 模态框关闭事件
      document.getElementById('confirmModal').addEventListener('hidden.bs.modal', () => {
        resolve(false);
      }, { once: true });
      
      modal.show();
    } catch (error) {
      console.error('显示确认对话框失败:', error);
      resolve(false);
    }
  });
}
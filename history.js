/**
 * 历史记录管理模块
 * 负责管理用户输入字段的历史记录功能
 */

// 历史记录存储键名
const STORAGE_KEY = 'renameToolHistory';

// 支持历史记录的字段名列表
const fieldNames = ['product', 'template', 'video', 'author', 'duration', 'language'];

/**
 * 获取历史记录
 * @returns {Object} 历史记录对象
 */
function getHistory() {
  const defaultHistory = {
    product: [],
    template: [],
    video: [],
    author: [],
    duration: [],
    language: []
  };
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // 确保所有字段都存在，向后兼容旧版本数据
      const history = { ...defaultHistory };
      for (const fieldName of fieldNames) {
        if (parsed[fieldName] && Array.isArray(parsed[fieldName])) {
          history[fieldName] = parsed[fieldName];
        }
      }
      return history;
    } catch (e) {
      console.error('Failed to parse history data:', e);
    }
  }
  // 返回默认结构
  return defaultHistory;
}

/**
 * 保存历史记录
 * @param {Object} history - 历史记录对象
 */
function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history data:', e);
  }
}

/**
 * 添加到历史记录
 * @param {string} fieldName - 字段名
 * @param {string} value - 字段值
 */
function addToHistory(fieldName, value) {
  console.log(`=== 添加到历史记录 ===`);
  console.log(`字段名: ${fieldName}, 值: "${value}"`);
  
  if (!value || !value.trim()) {
    console.log(`值为空，跳过添加`);
    return;
  }
  
  // 验证字段名是否有效
  if (!fieldNames.includes(fieldName)) {
    console.warn('Invalid field name for history:', fieldName);
    return;
  }
  
  console.log(`Adding to history - Field: ${fieldName}, Value: ${value}`);
  
  const history = getHistory();
  const trimmedValue = value.trim();
  
  // 确保字段存在且为数组
  if (!history[fieldName] || !Array.isArray(history[fieldName])) {
    console.log(`Initializing history array for field: ${fieldName}`);
    history[fieldName] = [];
  }
  
  // 如果已存在，先移除再添加到开头
  const index = history[fieldName].indexOf(trimmedValue);
  if (index > -1) {
    console.log(`值已存在于位置 ${index}，先移除`);
    history[fieldName].splice(index, 1);
  }
  
  // 添加到开头
  history[fieldName].unshift(trimmedValue);
  console.log(`值已添加到开头`);
  
  // 限制历史记录数量（最多20条）
  if (history[fieldName].length > 20) {
    history[fieldName] = history[fieldName].slice(0, 20);
    console.log(`历史记录超过20条，已截取`);
  }
  
  console.log(`History updated for ${fieldName}:`, history[fieldName]);
  
  saveHistory(history);
  console.log(`历史记录已保存到localStorage`);
  
  updateDropdown(fieldName);
  console.log(`下拉菜单已更新`);
  console.log(`=== 历史记录添加完成 ===`);
}

/**
 * 从历史记录中删除
 * @param {string} fieldName - 字段名
 * @param {string} value - 要删除的值
 */
function removeFromHistory(fieldName, value) {
  // 验证字段名是否有效
  if (!fieldNames.includes(fieldName)) {
    console.warn('Invalid field name for history:', fieldName);
    return;
  }
  
  const history = getHistory();
  
  // 确保字段存在且为数组
  if (!history[fieldName] || !Array.isArray(history[fieldName])) {
    return;
  }
  
  const index = history[fieldName].indexOf(value);
  if (index > -1) {
    history[fieldName].splice(index, 1);
    saveHistory(history);
    updateDropdown(fieldName);
  }
}

/**
 * 更新下拉菜单
 * @param {string} fieldName - 字段名
 */
function updateDropdown(fieldName) {
  console.log(`=== 更新下拉菜单: ${fieldName} ===`);
  
  // 验证字段名是否有效
  if (!fieldNames.includes(fieldName)) {
    console.warn('Invalid field name for dropdown:', fieldName);
    return;
  }
  
  const history = getHistory();
  const dropdown = document.getElementById(`${fieldName}-dropdown`);
  
  console.log(`下拉菜单元素:`, dropdown);
  console.log(`历史记录数据:`, history[fieldName]);
  
  // 检查下拉菜单元素是否存在
  if (!dropdown) {
    console.warn('Dropdown element not found:', `${fieldName}-dropdown`);
    return;
  }
  
  const items = history[fieldName] || [];
  console.log(`历史记录项数量: ${items.length}`);
  
  dropdown.innerHTML = '';
  
  if (items.length === 0) {
    dropdown.innerHTML = '<li><span class="dropdown-item text-muted">暂无历史记录</span></li>';
    console.log(`${fieldName} 无历史记录，显示默认提示`);
    return;
  }
  
  items.forEach((item, index) => {
    console.log(`创建历史记录项 ${index + 1}/${items.length}: "${item}"`);
    
    const li = document.createElement('li');
    
    // 创建历史记录项容器
    const itemContainer = document.createElement('div');
    itemContainer.className = 'dropdown-item d-flex justify-content-between align-items-center';
    
    // 创建文本元素
    const textSpan = document.createElement('span');
    textSpan.className = 'history-item-text';
    textSpan.style.cssText = 'cursor: pointer; flex-grow: 1; user-select: none;';
    textSpan.textContent = item;
    textSpan.setAttribute('data-field', fieldName);
    textSpan.setAttribute('data-value', item);
    
    // 创建删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-sm btn-outline-danger ms-2';
    deleteButton.title = '删除';
    deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
    
    // 组装元素
    itemContainer.appendChild(textSpan);
    itemContainer.appendChild(deleteButton);
    li.appendChild(itemContainer);
    
    console.log(`历史记录文本元素:`, textSpan);
    
    // 使用事件委托方式绑定点击事件，提高可靠性
    textSpan.addEventListener('click', function(event) {
      // 阻止事件冒泡，防止触发下拉菜单的其他事件
      event.preventDefault();
      event.stopPropagation();
      
      console.log(`=== 历史记录项被点击 ===`);
      console.log(`字段名: ${fieldName}`);
      console.log(`选择的值: ${item}`);
      console.log(`事件目标:`, event.target);
      
      // 使用多种方式尝试获取输入框元素，提高容错性
      let inputElement = null;
      
      // 方法1: 直接通过ID获取
      inputElement = document.getElementById(fieldName);
      
      // 方法2: 如果方法1失败，通过querySelector获取
      if (!inputElement) {
        inputElement = document.querySelector(`input[id="${fieldName}"]`);
      }
      
      // 方法3: 如果还是失败，通过name属性获取
      if (!inputElement) {
        inputElement = document.querySelector(`input[name="${fieldName}"]`);
      }
      
      console.log(`输入框元素:`, inputElement);
      console.log(`输入框当前值: "${inputElement ? inputElement.value : 'null'}"`);
      console.log(`输入框是否禁用: ${inputElement ? inputElement.disabled : 'null'}`);
      console.log(`输入框是否只读: ${inputElement ? inputElement.readOnly : 'null'}`);
      
      if (inputElement) {
        const oldValue = inputElement.value;
        
        // 确保输入框获得焦点，然后设置值
        try {
          inputElement.focus();
          inputElement.value = item;
          
          // 验证值是否设置成功
          if (inputElement.value === item) {
            console.log(`值设置成功 - 旧值: "${oldValue}" -> 新值: "${inputElement.value}"`);
          } else {
            console.warn(`值设置可能失败 - 期望: "${item}", 实际: "${inputElement.value}"`);
            // 重试设置
            inputElement.value = item;
          }
          
          // 触发多种事件，确保兼容性
          const events = ['input', 'change', 'blur'];
          events.forEach(eventType => {
            try {
              const event = new Event(eventType, {
                bubbles: true,
                cancelable: true,
                composed: true
              });
              inputElement.dispatchEvent(event);
              console.log(`已触发${eventType}事件`);
            } catch (e) {
              console.warn(`触发${eventType}事件失败:`, e);
            }
          });
          
        } catch (error) {
          console.error(`设置输入框值时出错:`, error);
        }
      } else {
        console.error(`找不到输入框元素: ${fieldName}`);
        console.error(`页面中所有input元素:`, document.querySelectorAll('input'));
      }
      
      // 延迟关闭下拉菜单，确保值设置完成
      setTimeout(() => {
        try {
          const dropdownToggle = document.querySelector(`[data-bs-toggle="dropdown"][data-field="${fieldName}"]`);
          console.log(`下拉菜单切换按钮:`, dropdownToggle);
          
          if (dropdownToggle) {
            // 方法1: 使用Bootstrap实例
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
              const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownToggle);
              console.log(`Bootstrap下拉菜单实例:`, dropdownInstance);
              
              if (dropdownInstance) {
                dropdownInstance.hide();
                console.log(`下拉菜单已通过实例关闭`);
              } else {
                // 方法2: 创建新实例并关闭
                try {
                  const newInstance = new bootstrap.Dropdown(dropdownToggle);
                  newInstance.hide();
                  console.log(`下拉菜单已通过新实例关闭`);
                } catch (e) {
                  console.warn(`创建新实例失败:`, e);
                }
              }
            }
            
            // 方法3: 手动移除show类（备用方案）
            const dropdownMenu = dropdownToggle.nextElementSibling;
            if (dropdownMenu && dropdownMenu.classList.contains('show')) {
              dropdownMenu.classList.remove('show');
              dropdownToggle.setAttribute('aria-expanded', 'false');
              console.log(`下拉菜单已手动关闭`);
            }
          } else {
            console.warn(`下拉菜单切换按钮未找到`);
          }
        } catch (error) {
          console.warn('关闭下拉菜单失败:', error);
        }
      }, 100); // 延迟100ms确保值设置完成
      
      console.log(`=== 历史记录项点击处理完成 ===`);
    });
    
    // 为删除按钮绑定事件
    deleteButton.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      removeFromHistory(fieldName, item);
    });
    
    dropdown.appendChild(li);
  });
}

/**
 * 初始化所有下拉菜单并填充默认值
 */
function initializeDropdowns() {
  console.log(`=== 初始化所有下拉菜单 ===`);
  
  // 检查DOM是否准备就绪
  if (document.readyState === 'loading') {
    console.log(`DOM尚未加载完成，延迟初始化`);
    document.addEventListener('DOMContentLoaded', initializeDropdowns);
    return;
  }
  
  const history = getHistory();
  console.log(`历史记录数据:`, history);
  
  let initializationErrors = [];
  
  fieldNames.forEach(fieldName => {
    console.log(`初始化字段: ${fieldName}`);
    
    try {
      // 检查下拉菜单元素是否存在
      const dropdownElement = document.getElementById(`${fieldName}-dropdown`);
      if (!dropdownElement) {
        const error = `下拉菜单元素不存在: ${fieldName}-dropdown`;
        console.error(error);
        initializationErrors.push(error);
        return;
      }
      
      // 检查输入框元素是否存在
      const inputElement = document.getElementById(fieldName);
      if (!inputElement) {
        const error = `输入框元素不存在: ${fieldName}`;
        console.error(error);
        initializationErrors.push(error);
        return;
      }
      
      // 更新下拉菜单
      updateDropdown(fieldName);
      
      // 如果有历史记录，填充最近使用的值（第一个）
      if (history[fieldName] && history[fieldName].length > 0) {
        const lastUsedValue = history[fieldName][0];
        console.log(`为 ${fieldName} 填充最近使用的值: "${lastUsedValue}"`);
        console.log(`输入框元素:`, inputElement);
        
        // 只在输入框为空时自动填充
        if (!inputElement.value || inputElement.value.trim() === '') {
          inputElement.value = lastUsedValue;
          console.log(`${fieldName} 值已设置为: "${inputElement.value}"`);
          
          // 触发change事件，通知其他组件
          try {
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {
            console.warn(`触发change事件失败:`, e);
          }
        } else {
          console.log(`${fieldName} 输入框已有值，跳过自动填充`);
        }
      } else {
        console.log(`${fieldName} 无历史记录，跳过自动填充`);
      }
      
    } catch (error) {
      const errorMsg = `初始化字段 ${fieldName} 时出错: ${error.message}`;
      console.error(errorMsg);
      initializationErrors.push(errorMsg);
    }
  });
  
  if (initializationErrors.length > 0) {
    console.warn(`初始化过程中发现 ${initializationErrors.length} 个错误:`, initializationErrors);
  }
  
  console.log(`=== 下拉菜单初始化完成 ===`);
}

/**
 * 安全的初始化函数，确保在适当的时机调用
 */
function safeInitializeDropdowns() {
  console.log(`=== 安全初始化历史记录功能 ===`);
  
  // 如果DOM已经加载完成，直接初始化
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log(`DOM已准备就绪，立即初始化`);
    initializeDropdowns();
  } else {
    console.log(`等待DOM加载完成...`);
    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', function() {
      console.log(`DOMContentLoaded事件触发，开始初始化`);
      // 额外延迟确保Bootstrap等库也加载完成
      setTimeout(initializeDropdowns, 100);
    });
  }
}

/**
 * 重新初始化特定字段的历史记录功能
 * @param {string} fieldName - 字段名
 */
function reinitializeField(fieldName) {
  console.log(`=== 重新初始化字段: ${fieldName} ===`);
  
  if (!fieldNames.includes(fieldName)) {
    console.warn('Invalid field name for reinitialization:', fieldName);
    return;
  }
  
  try {
    updateDropdown(fieldName);
    console.log(`字段 ${fieldName} 重新初始化完成`);
  } catch (error) {
    console.error(`重新初始化字段 ${fieldName} 失败:`, error);
  }
}
/**
 * 调试和诊断函数
 */
function debugHistoryFunction() {
  console.log(`=== 历史记录功能调试信息 ===`);
  
  // 检查DOM元素
  console.log(`支持的字段:`, fieldNames);
  
  fieldNames.forEach(fieldName => {
    const inputElement = document.getElementById(fieldName);
    const dropdownElement = document.getElementById(`${fieldName}-dropdown`);
    const toggleElement = document.querySelector(`[data-bs-toggle="dropdown"][data-field="${fieldName}"]`);
    
    console.log(`字段 ${fieldName}:`);
    console.log(`  - 输入框存在: ${!!inputElement}`);
    console.log(`  - 下拉菜单存在: ${!!dropdownElement}`);
    console.log(`  - 切换按钮存在: ${!!toggleElement}`);
    
    if (inputElement) {
      console.log(`  - 输入框值: "${inputElement.value}"`);
      console.log(`  - 输入框类型: ${inputElement.type}`);
    }
    
    if (dropdownElement) {
      console.log(`  - 下拉菜单项数量: ${dropdownElement.children.length}`);
    }
  });
  
  // 检查历史记录数据
  const history = getHistory();
  console.log(`历史记录数据:`, history);
  
  // 检查Bootstrap
  console.log(`Bootstrap可用: ${typeof bootstrap !== 'undefined'}`);
  if (typeof bootstrap !== 'undefined') {
    console.log(`Bootstrap.Dropdown可用: ${!!bootstrap.Dropdown}`);
  }
  
  console.log(`=== 调试信息结束 ===`);
}

/**
 * 强制刷新所有历史记录下拉菜单
 */
function refreshAllDropdowns() {
  console.log(`=== 强制刷新所有下拉菜单 ===`);
  
  fieldNames.forEach(fieldName => {
    try {
      updateDropdown(fieldName);
      console.log(`${fieldName} 下拉菜单已刷新`);
    } catch (error) {
      console.error(`刷新 ${fieldName} 下拉菜单失败:`, error);
    }
  });
  
  console.log(`=== 下拉菜单刷新完成 ===`);
}

/**
 * 测试历史记录选择功能
 * @param {string} fieldName - 字段名
 * @param {string} testValue - 测试值
 */
function testHistorySelection(fieldName, testValue) {
  console.log(`=== 测试历史记录选择功能 ===`);
  console.log(`字段: ${fieldName}, 测试值: ${testValue}`);
  
  // 先添加到历史记录
  addToHistory(fieldName, testValue);
  
  // 清空输入框
  const inputElement = document.getElementById(fieldName);
  if (inputElement) {
    inputElement.value = '';
    console.log(`输入框已清空`);
    
    // 模拟点击历史记录项
    setTimeout(() => {
      const historyItems = document.querySelectorAll(`#${fieldName}-dropdown .history-item-text`);
      if (historyItems.length > 0) {
        console.log(`找到 ${historyItems.length} 个历史记录项，点击第一个`);
        historyItems[0].click();
      } else {
        console.error(`未找到历史记录项`);
      }
    }, 500);
  } else {
    console.error(`找不到输入框: ${fieldName}`);
  }
}

// 导出调试函数到全局作用域，方便在控制台调用
if (typeof window !== 'undefined') {
  window.debugHistoryFunction = debugHistoryFunction;
  window.refreshAllDropdowns = refreshAllDropdowns;
  window.testHistorySelection = testHistorySelection;
  window.safeInitializeDropdowns = safeInitializeDropdowns;
  window.reinitializeField = reinitializeField;
}
/**
 * 历史记录管理模块 - 原生JavaScript实现
 * 不依赖Bootstrap，使用自定义下拉菜单
 */

// 历史记录存储键名
const HISTORY_STORAGE_KEY = 'renameToolHistory';

// 支持历史记录的字段列表
const HISTORY_FIELDS = ['product', 'template', 'video', 'author', 'duration', 'language'];

// 最大历史记录数量
const MAX_HISTORY_ITEMS = 10;

/**
 * 获取历史记录数据
 * @returns {Object} 历史记录对象
 */
function getHistoryData() {
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // 确保所有字段都存在
            const result = {};
            HISTORY_FIELDS.forEach(field => {
                result[field] = Array.isArray(data[field]) ? data[field] : [];
            });
            return result;
        }
    } catch (error) {
        console.warn('读取历史记录失败:', error);
    }
    
    // 返回默认空数据
    const defaultData = {};
    HISTORY_FIELDS.forEach(field => {
        defaultData[field] = [];
    });
    return defaultData;
}

/**
 * 保存历史记录数据
 * @param {Object} data 历史记录数据
 */
function saveHistoryData(data) {
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn('保存历史记录失败:', error);
    }
}

/**
 * 添加值到历史记录
 * @param {string} fieldName 字段名
 * @param {string} value 值
 */
function addToHistory(fieldName, value) {
    if (!HISTORY_FIELDS.includes(fieldName) || !value || !value.trim()) {
        return;
    }
    
    const trimmedValue = value.trim();
    const historyData = getHistoryData();
    
    // 移除已存在的相同值
    const index = historyData[fieldName].indexOf(trimmedValue);
    if (index > -1) {
        historyData[fieldName].splice(index, 1);
    }
    
    // 添加到开头
    historyData[fieldName].unshift(trimmedValue);
    
    // 限制数量
    if (historyData[fieldName].length > MAX_HISTORY_ITEMS) {
        historyData[fieldName] = historyData[fieldName].slice(0, MAX_HISTORY_ITEMS);
    }
    
    saveHistoryData(historyData);
    updateDropdownMenu(fieldName);
}

/**
 * 从历史记录中删除值
 * @param {string} fieldName 字段名
 * @param {string} value 值
 */
function removeFromHistory(fieldName, value) {
    if (!HISTORY_FIELDS.includes(fieldName)) {
        return;
    }
    
    const historyData = getHistoryData();
    const index = historyData[fieldName].indexOf(value);
    if (index > -1) {
        historyData[fieldName].splice(index, 1);
        saveHistoryData(historyData);
        updateDropdownMenu(fieldName);
    }
}

/**
 * 创建自定义下拉菜单
 * @param {string} fieldName 字段名
 */
function createCustomDropdown(fieldName) {
    const inputGroup = document.querySelector(`#${fieldName}`).parentElement;
    
    // 检查是否已存在下拉菜单
    let dropdown = inputGroup.querySelector('.custom-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown';
        dropdown.id = `${fieldName}-custom-dropdown`;
        inputGroup.style.position = 'relative';
        inputGroup.appendChild(dropdown);
    }
    
    return dropdown;
}

/**
 * 更新下拉菜单内容
 * @param {string} fieldName 字段名
 */
function updateDropdownMenu(fieldName) {
    const dropdown = createCustomDropdown(fieldName);
    const historyData = getHistoryData();
    const items = historyData[fieldName] || [];
    
    // 清空现有内容
    dropdown.innerHTML = '';
    
    if (items.length === 0) {
        const noHistoryDiv = document.createElement('div');
        noHistoryDiv.className = 'no-history';
        noHistoryDiv.textContent = '暂无历史记录';
        dropdown.appendChild(noHistoryDiv);
        return;
    }
    
    // 添加历史记录项
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dropdown-item';
        
        // 文本部分
        const textSpan = document.createElement('span');
        textSpan.className = 'history-text';
        textSpan.textContent = item;
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = '删除此项';
        
        // 点击文本选择历史记录
        textSpan.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectHistoryItem(fieldName, item);
        });
        
        // 点击删除按钮
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeFromHistory(fieldName, item);
        });
        
        itemDiv.appendChild(textSpan);
        itemDiv.appendChild(deleteBtn);
        dropdown.appendChild(itemDiv);
    });
}

/**
 * 显示下拉菜单
 * @param {string} fieldName 字段名
 */
function showDropdown(fieldName) {
    // 先隐藏所有其他下拉菜单
    hideAllDropdowns();
    
    const dropdown = document.getElementById(`${fieldName}-custom-dropdown`);
    if (dropdown) {
        updateDropdownMenu(fieldName);
        dropdown.classList.add('show');
    }
}

/**
 * 隐藏下拉菜单
 * @param {string} fieldName 字段名
 */
function hideDropdown(fieldName) {
    const dropdown = document.getElementById(`${fieldName}-custom-dropdown`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

/**
 * 隐藏所有下拉菜单
 */
function hideAllDropdowns() {
    HISTORY_FIELDS.forEach(field => {
        hideDropdown(field);
    });
}

/**
 * 选择历史记录项
 * @param {string} fieldName 字段名
 * @param {string} value 值
 */
function selectHistoryItem(fieldName, value) {
    const input = document.getElementById(fieldName);
    if (input) {
        input.value = value;
        input.focus();
        
        // 触发change事件
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 关闭下拉菜单
        hideDropdown(fieldName);
    }
}

/**
 * 初始化历史记录功能
 */
function initializeHistory() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeHistory);
        return;
    }
    
    console.log('开始初始化历史记录功能...');
    
    // 为每个字段初始化功能
    HISTORY_FIELDS.forEach(fieldName => {
        const input = document.getElementById(fieldName);
        const button = document.querySelector(`[data-field="${fieldName}"]`);
        
        console.log(`初始化字段 ${fieldName}:`, {
            input: !!input,
            button: !!button
        });
        
        if (input && button) {
            // 创建自定义下拉菜单
            createCustomDropdown(fieldName);
            updateDropdownMenu(fieldName);
            
            // 监听按钮点击事件
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dropdown = document.getElementById(`${fieldName}-custom-dropdown`);
                if (dropdown && dropdown.classList.contains('show')) {
                    hideDropdown(fieldName);
                } else {
                    showDropdown(fieldName);
                }
            });
            
            // 监听输入框的blur事件，自动保存历史记录
            input.addEventListener('blur', () => {
                const value = input.value.trim();
                if (value) {
                    console.log(`保存历史记录: ${fieldName} = ${value}`);
                    addToHistory(fieldName, value);
                }
            });
        }
    });
    
    // 点击外部区域关闭所有下拉菜单
    document.addEventListener('click', (e) => {
        // 检查点击的元素是否在下拉菜单或按钮内
        const isDropdownClick = e.target.closest('.custom-dropdown');
        const isButtonClick = e.target.closest('[data-field]');
        
        if (!isDropdownClick && !isButtonClick) {
            hideAllDropdowns();
        }
    });
    
    console.log('历史记录功能初始化完成');
}

// 自动初始化
initializeHistory();

// 导出函数供外部使用
window.historyManager = {
    addToHistory,
    removeFromHistory,
    getHistoryData,
    updateDropdownMenu,
    initializeHistory,
    showDropdown,
    hideDropdown,
    hideAllDropdowns
};
/**
 * 主应用调试脚本
 * 用于诊断实际应用中重命名按钮失效的问题
 */

// 调试工具类
class MainAppDebugger {
    constructor() {
        this.issues = [];
        this.logs = [];
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logs.push({ message: logEntry, type });
        
        const color = type === 'error' ? 'color: red' : 
                     type === 'warning' ? 'color: orange' : 
                     type === 'success' ? 'color: green' : 'color: blue';
        console.log(`%c${logEntry}`, color);
    }

    addIssue(issue) {
        this.issues.push(issue);
        this.log(`❌ 发现问题: ${issue}`, 'error');
    }

    // 检查DOM元素
    checkDOMElements() {
        this.log('=== 检查DOM元素 ===', 'info');
        
        // 检查重命名按钮
        const renameButton = document.getElementById('rename-files');
        if (!renameButton) {
            this.addIssue('重命名按钮元素不存在 (ID: rename-files)');
            return false;
        } else {
            this.log('✅ 重命名按钮元素存在', 'success');
            this.log(`按钮状态: disabled=${renameButton.disabled}, visible=${renameButton.offsetParent !== null}`, 'info');
        }

        // 检查表单字段
        const requiredFields = ['product', 'template', 'video', 'author', 'duration'];
        requiredFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (!field) {
                this.addIssue(`表单字段不存在: ${fieldName}`);
            } else {
                this.log(`✅ 表单字段存在: ${fieldName} (值: "${field.value}")`, 'success');
            }
        });

        return true;
    }

    // 检查全局变量
    checkGlobalVariables() {
        this.log('=== 检查全局变量 ===', 'info');
        
        // 检查selectedFiles
        if (typeof window.selectedFiles === 'undefined') {
            this.addIssue('window.selectedFiles 未定义');
        } else {
            this.log(`✅ window.selectedFiles 存在: ${Array.isArray(window.selectedFiles) ? window.selectedFiles.length + ' 个文件' : '类型错误'}`, 'success');
        }

        // 检查fileManager
        if (typeof window.fileManager === 'undefined') {
            this.addIssue('window.fileManager 未定义');
        } else {
            this.log(`✅ window.fileManager 存在`, 'success');
        }

        // 检查FieldValidator
        if (typeof FieldValidator === 'undefined') {
            this.addIssue('FieldValidator 未定义');
        } else {
            this.log(`✅ FieldValidator 存在`, 'success');
        }

        // 检查electronAPI
        if (typeof window.electronAPI === 'undefined') {
            this.addIssue('window.electronAPI 未定义 (这在浏览器环境中是正常的)');
        } else {
            this.log(`✅ window.electronAPI 存在`, 'success');
        }
    }

    // 检查事件监听器
    checkEventListeners() {
        this.log('=== 检查事件监听器 ===', 'info');
        
        const renameButton = document.getElementById('rename-files');
        if (!renameButton) {
            this.addIssue('无法检查事件监听器：按钮不存在');
            return;
        }

        // 尝试检查事件监听器（仅在支持的浏览器中）
        if (typeof getEventListeners === 'function') {
            try {
                const listeners = getEventListeners(renameButton);
                if (listeners && listeners.click && listeners.click.length > 0) {
                    this.log(`✅ 检测到 ${listeners.click.length} 个click事件监听器`, 'success');
                } else {
                    this.addIssue('没有检测到click事件监听器');
                }
            } catch (error) {
                this.log(`⚠️ 事件监听器检查失败: ${error.message}`, 'warning');
            }
        } else {
            this.log('⚠️ getEventListeners 不可用，无法检查事件监听器', 'warning');
        }
    }

    // 检查函数定义
    checkFunctionDefinitions() {
        this.log('=== 检查函数定义 ===', 'info');
        
        const requiredFunctions = [
            'handleRenameFiles',
            'addToHistory',
            'showAlert',
            'updateFileListDisplay'
        ];

        requiredFunctions.forEach(funcName => {
            if (typeof window[funcName] === 'function') {
                this.log(`✅ 函数存在: ${funcName}`, 'success');
            } else {
                this.addIssue(`函数不存在: ${funcName}`);
            }
        });
    }

    // 模拟点击测试
    simulateButtonClick() {
        this.log('=== 模拟按钮点击测试 ===', 'info');
        
        const renameButton = document.getElementById('rename-files');
        if (!renameButton) {
            this.addIssue('无法模拟点击：按钮不存在');
            return;
        }

        try {
            // 记录点击前的状态
            this.log('点击前状态检查...', 'info');
            this.log(`selectedFiles: ${window.selectedFiles ? window.selectedFiles.length : 'undefined'}`, 'info');
            
            // 模拟点击
            this.log('模拟点击重命名按钮...', 'info');
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            renameButton.dispatchEvent(clickEvent);
            this.log('✅ 点击事件已触发', 'success');
            
        } catch (error) {
            this.addIssue(`模拟点击失败: ${error.message}`);
        }
    }

    // 检查Bootstrap
    checkBootstrap() {
        this.log('=== 检查Bootstrap ===', 'info');
        
        if (typeof bootstrap === 'undefined') {
            this.addIssue('Bootstrap 未加载');
        } else {
            this.log('✅ Bootstrap 已加载', 'success');
            
            if (bootstrap.Modal) {
                this.log('✅ Bootstrap.Modal 可用', 'success');
            } else {
                this.addIssue('Bootstrap.Modal 不可用');
            }
        }
    }

    // 运行完整诊断
    async runFullDiagnosis() {
        this.log('🔍 开始完整诊断...', 'info');
        
        // 等待DOM完全加载
        if (document.readyState !== 'complete') {
            this.log('等待DOM加载完成...', 'info');
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
        }

        // 执行各项检查
        this.checkDOMElements();
        this.checkGlobalVariables();
        this.checkEventListeners();
        this.checkFunctionDefinitions();
        this.checkBootstrap();
        
        // 生成报告
        this.generateReport();
        
        // 如果没有严重问题，进行模拟测试
        if (this.issues.length === 0 || this.issues.every(issue => issue.includes('electronAPI'))) {
            this.log('没有发现严重问题，进行模拟测试...', 'info');
            setTimeout(() => this.simulateButtonClick(), 1000);
        }
    }

    // 生成诊断报告
    generateReport() {
        const duration = Date.now() - this.startTime;
        
        this.log('=== 诊断报告 ===', 'info');
        this.log(`诊断耗时: ${duration}ms`, 'info');
        this.log(`发现问题数量: ${this.issues.length}`, this.issues.length > 0 ? 'warning' : 'success');
        
        if (this.issues.length > 0) {
            this.log('问题列表:', 'warning');
            this.issues.forEach((issue, index) => {
                this.log(`${index + 1}. ${issue}`, 'warning');
            });
        } else {
            this.log('✅ 没有发现明显问题', 'success');
        }

        // 在页面上显示报告（如果可能）
        this.displayReportOnPage();
    }

    // 在页面上显示报告
    displayReportOnPage() {
        try {
            // 创建报告容器
            let reportContainer = document.getElementById('debug-report');
            if (!reportContainer) {
                reportContainer = document.createElement('div');
                reportContainer.id = 'debug-report';
                reportContainer.style.cssText = `
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    width: 400px;
                    max-height: 80vh;
                    background: white;
                    border: 2px solid #dc3545;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    overflow: hidden;
                    font-family: monospace;
                    font-size: 12px;
                `;
                document.body.appendChild(reportContainer);
            }

            const headerColor = this.issues.length > 0 ? '#dc3545' : '#28a745';
            const headerText = this.issues.length > 0 ? '🐛 发现问题' : '✅ 诊断通过';
            
            reportContainer.innerHTML = `
                <div style="background: ${headerColor}; color: white; padding: 10px; font-weight: bold;">
                    ${headerText} (${this.issues.length} 个问题)
                    <button onclick="this.parentElement.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>
                </div>
                <div style="padding: 10px; max-height: 60vh; overflow-y: auto;">
                    ${this.issues.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <strong>问题列表:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                ${this.issues.map(issue => `<li style="color: #dc3545;">${issue}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <div>
                        <strong>详细日志:</strong>
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; margin-top: 5px; max-height: 200px; overflow-y: auto;">
                            ${this.logs.map(log => {
                                const color = log.type === 'error' ? '#dc3545' : 
                                            log.type === 'warning' ? '#ffc107' : 
                                            log.type === 'success' ? '#28a745' : '#6c757d';
                                return `<div style="color: ${color}; margin-bottom: 2px;">${log.message}</div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            this.log(`显示页面报告失败: ${error.message}`, 'error');
        }
    }
}

// 创建全局调试器实例
window.mainAppDebugger = new MainAppDebugger();

// 自动运行诊断
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.mainAppDebugger.runFullDiagnosis(), 1000);
    });
} else {
    setTimeout(() => window.mainAppDebugger.runFullDiagnosis(), 1000);
}

// 导出调试函数供手动调用
window.debugRenameButton = () => window.mainAppDebugger.runFullDiagnosis();
window.testRenameClick = () => window.mainAppDebugger.simulateButtonClick();

console.log('🔧 主应用调试器已加载。使用 debugRenameButton() 手动运行诊断，或 testRenameClick() 测试按钮点击。');
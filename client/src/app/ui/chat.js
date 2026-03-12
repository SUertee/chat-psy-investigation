// Chat and tutor UI helpers.
function initializeTutorChat() {
    // 1. 清空 Tutor 专用的历史记录
    // 注意：我们需要在 experimentData 里新开一个字段存 Tutor 的对话，避免和后面的练习混淆
    experimentData.tutorChatHistory = []; 
    
    const messagesDiv = document.getElementById('tutorMessages');
    messagesDiv.innerHTML = '';

    // 2. 添加开场白
    const welcomeMsg = "你好！我是你的 AI 学习助手。刚才的培训视频看完了吗？关于「自杀危机评估」的知识点（如风险因素、C-SSRS量表、沟通话术等），你有什么疑问吗？请至少向我提一个问题。";
    addTutorMessage('ai', welcomeMsg);
    
    // 记录开场白
    experimentData.tutorChatHistory.push({ role: 'system', content: AI_PROMPTS.TUTOR }); // 先存 System Prompt
    experimentData.tutorChatHistory.push({ role: 'assistant', content: welcomeMsg });
}

// 倒计时逻辑
function startTutorTimer() {
    tutorTimeLeft = 5 * 60; // 重置为 5 分钟
    const timerDisplay = document.getElementById('tutorTimer');
    
    updateTutorTimerDisplay();

    tutorCountdownInterval = setInterval(() => {
        tutorTimeLeft--;
        updateTutorTimerDisplay();

        if (tutorTimeLeft <= 0) {
            clearInterval(tutorCountdownInterval);
            // 时间到，强制可以点击
            enableFinishTutorButton(); 
            timerDisplay.innerHTML = "时间到";
            timerDisplay.style.color = "#ffeb3b";
        }
    }, 1000);
}

function updateTutorTimerDisplay() {
    const m = Math.floor(tutorTimeLeft / 60).toString().padStart(2, '0');
    const s = (tutorTimeLeft % 60).toString().padStart(2, '0');
    const display = document.getElementById('tutorTimer');
    if (display) display.textContent = `${m}:${s}`;
}

// 处理 Tutor 输入
function handleTutorKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendTutorMessage();
    }
}

// 发送 Tutor 消息
async function sendTutorMessage() {
    const input = document.getElementById('tutorInput');
    const msg = input.value.trim();
    if (!msg) return;

    // 显示用户消息
    addTutorMessage('user', msg);
    experimentData.tutorChatHistory.push({ role: 'user', content: msg });
    input.value = '';

    // *** 关键逻辑：只要用户发送了消息，就允许进入下一步 ***
    enableFinishTutorButton();

    // 调用 API (复用之前的逻辑，但参数稍有不同)
    await callTutorAPI();
}

// 启用结束按钮
function enableFinishTutorButton() {
    const btn = document.getElementById('finishTutorBtn');
    const tip = document.getElementById('questionRequirement');
    if (btn) {
        btn.disabled = false;
        btn.classList.add('active');
    }
    if (tip) {
        tip.style.display = 'none'; // 隐藏提示文字
    }
}

// 添加 Tutor 气泡
function addTutorMessage(sender, text) {
    const div = document.getElementById('tutorMessages');
    const row = document.createElement('div');
    row.className = `message-row ${sender}`;
    row.innerHTML = `
        <div class="avatar">${sender === 'ai' ? '🤖' : '👤'}</div>
        <div class="bubble">${text}</div>
    `;
    div.appendChild(row);
    div.scrollTop = div.scrollHeight;
}

// 结束 Tutor 环节
function finishTutorSession() {
    jsPsych.finishTrial();
}

// 调用 API (针对 Tutor 的专用函数)
// experiment.js - 修复版 callTutorAPI

// experiment.js - 修复版 callTutorAPI (增强调试 + 兼容性修复)
function createChatInterface() {
    // 注入微信PC版风格的 CSS
    const styles = `
    <style>
        .chat-layout {
            display: flex;
            gap: 16px;
            align-items: stretch;
            justify-content: center;
            max-width: min(1520px, 96vw);
            margin: 0 auto;
            padding: 0 8px;
        }

        /* 1. 聊天主窗口：居中、阴影、圆角 */
        .chat-window {
            width: min(980px, 92vw);
            height: min(740px, 84vh);
            max-height: 90vh;
            background-color: #f5f5f5;
            margin: 0 auto;
            border-radius: 4px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            text-align: left;
            font-family: "Microsoft YaHei", sans-serif;
            overflow: hidden; /* 防止圆角溢出 */
            min-width: 0;
        }

        .chat-profile-panel {
            width: 320px;
            height: min(740px, 84vh);
            max-height: 90vh;
            overflow: auto;
            background: linear-gradient(180deg, #fffaf1 0%, #fff 100%);
            border: 1px solid #f3d4b6;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
            padding: 16px;
            font-family: "Microsoft YaHei", sans-serif;
            color: #533f2f;
            line-height: 1.7;
        }
        .chat-profile-panel h4 {
            margin: 0 0 10px 0;
            color: #b0531f;
            font-size: 16px;
        }
        .chat-profile-panel .profile-block {
            background: #fff;
            border: 1px solid #f6dec9;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 10px;
            font-size: 13px;
        }

        @media (max-width: 1380px) {
            .chat-layout {
                flex-direction: column;
                align-items: center;
            }
            .chat-window {
                width: min(980px, 92vw);
                height: min(740px, 78vh);
            }
            .chat-profile-panel {
                width: min(980px, 92vw);
                height: auto;
                max-height: 28vh;
            }
        }

        .chat-header {
            height: 50px;
            background-color: #f5f5f5;
            border-bottom: 1px solid #e7e7e7;
            display: flex;
            align-items: center;
            justify-content: space-between; /* 确保标题和右侧控件两端对齐 */
            padding: 0 20px;
            font-size: 16px;
            font-weight: 600;
            color: #333;
            flex-shrink: 0;
        }

        /* 新增：内嵌倒计时样式，参考 AI Tutor 的设计 */
        .header-timer-badge {
            background: #ededed;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 13px;
            font-weight: normal;
            color: #e67e22; /* 橙色提醒 */
            display: flex;
            align-items: center;
            gap: 5px;
            margin-right: 15px;
        }

        .header-right-area {
            display: flex;
            align-items: center;
        }

        /* 3. 消息列表区域 */
        .chat-messages {
            flex: 1; /* 自动撑满剩余高度 */
            padding: 20px 30px;
            overflow-y: auto;
            background-color: #f5f5f5;
            display: flex;
            flex-direction: column;
            gap: 15px; /* 消息间距 */
        }
        
        /* 滚动条美化 */
        .chat-messages::-webkit-scrollbar { width: 6px; }
        .chat-messages::-webkit-scrollbar-thumb { background-color: #cdcdcd; border-radius: 3px; }

        /* 4. 消息气泡行 */
        .message-row {
            display: flex;
            align-items: flex-start;
            max-width: 100%;
        }

        /* 头像 */
        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
            margin-top: 2px;
        }

        /* 气泡内容 */
        .bubble {
            max-width: 65%;
            padding: 9px 13px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.6;
            position: relative;
            word-wrap: break-word;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        /* ---> AI (来访者) 样式 */
        .message-row.ai { justify-content: flex-start; }
        .message-row.ai .avatar { margin-right: 10px; background-color: #fff; border: 1px solid #eee; color: #333; }
        .message-row.ai .bubble { background-color: #ffffff; color: #000; border: 1px solid #ededed; }
        /* AI气泡小三角 */
        .message-row.ai .bubble::before {
            content: ""; position: absolute; left: -6px; top: 12px;
            width: 0; height: 0;
            border-top: 6px solid transparent; border-bottom: 6px solid transparent;
            border-right: 6px solid #fff;
        }

        /* ---> User (咨询师) 样式 */
        .message-row.user { justify-content: flex-end; }
        .message-row.user .avatar { margin-left: 10px; background-color: #1aad19; color: #fff; order: 2; }
        .message-row.user .bubble { background-color: #95ec69; color: #000; order: 1; }
        /* User气泡小三角 */
        .message-row.user .bubble::before {
            content: ""; position: absolute; right: -6px; top: 12px;
            width: 0; height: 0;
            border-top: 6px solid transparent; border-bottom: 6px solid transparent;
            border-left: 6px solid #95ec69;
        }

        /* 5. 底部输入区域 */
        .chat-input-area {
            height: 160px;
            background-color: #fff;
            border-top: 1px solid #ececec;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        /* 工具栏图标 (装饰用) */
        .chat-toolbar {
            height: 36px;
            padding: 0 15px;
            display: flex;
            align-items: center;
            gap: 15px;
            color: #666;
            font-size: 18px;
        }
        .tool-icon { cursor: pointer; opacity: 0.7; transition: 0.2s; }
        .tool-icon:hover { opacity: 1; }

        /* 输入框 */
        .chat-textarea {
            flex: 1;
            border: none;
            resize: none;
            outline: none;
            padding: 5px 20px;
            font-size: 15px;
            line-height: 1.5;
            font-family: inherit;
        }

        /* 发送按钮行 */
        .chat-action-bar {
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 0 20px 10px 0;
        }
        
        .chat-send-btn {
            background-color: #e9e9e9;
            color: #000;
            border: 1px solid #e5e5e5;
            padding: 6px 25px;
            font-size: 14px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .chat-send-btn:hover {
            background-color: #129611;
            color: #fff;
            border-color: #129611;
        }
        
        .enter-tip { font-size: 12px; color: #999; margin-right: 15px; }

    </style>
    `;

    // 返回 HTML 结构
    return styles + `
        <div class="chat-layout">
        <div class="chat-window">
            <div class="chat-header">
                <span>模拟咨询练习</span>

                <div class="header-right-area">
                    <div class="header-timer-badge">
                        <span>⏳ 剩余时间:</span>
                        <span id="headerTimeDisplay">10:00</span> 
                    </div>
                </div>
                <div class="window-controls">
                    <div class="control-dot" style="background:#ff5f57"></div>
                    <div class="control-dot" style="background:#ffbd2e"></div>
                    <div class="control-dot" style="background:#28c940"></div>
                </div>
            </div>

            <div class="chat-messages" id="chatMessages">
                </div>

            <div class="chat-input-area">
                <div class="chat-toolbar">
                    <span class="tool-icon">😊</span>
                    <span class="tool-icon">✂️</span>
                    <span class="tool-icon">📁</span>
                    <span class="tool-icon">💬</span>
                </div>
                
                <textarea class="chat-textarea" id="chatInput" 
                    placeholder="请输入您的回应..." 
                    onkeypress="handleChatKeyPress(event)"></textarea>
                
                <div class="chat-action-bar">
                    <span class="enter-tip">按 Enter 发送</span>
                    <button class="chat-send-btn" id="chatSendButton" onclick="sendChatMessage()">发送(S)</button>
                </div>
            </div>
        </div>
        </div>
    `;
}

function initializeChat(promptKey) {
    // 记录当前 AI 练习所用的 prompt，用于后续正确映射复盘档案类型(P1/P2/P3)
    experimentData.currentPracticePromptKey = promptKey || '';

    // 1. [修复] 清空内存中的聊天历史数据！！！
    // 否则练习二会带上前一个练习的记录，导致 AI 角色混乱
    experimentData.chatHistory = []; 

    // 2. 清空旧的聊天记录显示 (DOM)
    const messagesDiv = document.getElementById('chatMessages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }
    
    // 3. 获取对应的 System Prompt
    aiClientPrompt = AI_PROMPTS[promptKey];
    
    // 4. 提取 Prompt 中的 opening_line 作为开场白
    // 正则提取 <opening_line>...</opening_line> 内容
    const match = aiClientPrompt.match(/<opening_line>(.*?)<\/opening_line>/);
    const openingLine = match ? match[1] : "你好… 我觉得好难受，能跟你聊聊吗……";

    // 5. 添加 AI 开场白到界面
    addChatMessage('ai', openingLine);

    // 6. [重要] 将开场白也加入到历史记录中，这样 AI 才知道自己说过这句话
    experimentData.chatHistory.push({
        timestamp: getCurrentTimestamp(),
        sender: 'ai',
        content: openingLine
    });
}

// experiment.js - 请完全替换原有的 handleChatKeyPress 函数

function handleChatKeyPress(event) {
    // 监听回车键 (Enter)，且没有按下 Shift 键
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 阻止默认的换行行为
        sendChatMessage();      // 发送消息
    }
}

function sendChatMessage() {
    if (experimentData.chatMode === 'paired') {
        sendPairedChatMessageFromInput().catch(error => {
            console.error('[PAIRED_CHAT] 发送消息失败:', error);
            alert(`发送失败：${error.message}`);
        });
        return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // 添加用户消息
    addChatMessage('user', message);
    experimentData.chatHistory.push({
        timestamp: getCurrentTimestamp(),
        sender: 'user',
        content: message
    });
    
    // 清空输入框
    input.value = '';
    
    // 调用AI API
    callAIAPI(message);
}

// experiment.js - 请完全替换原有的 addChatMessage 函数

function addChatMessage(sender, content, options = {}) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;

    // 创建行容器
    const rowDiv = document.createElement('div');
    const visualSender = sender === 'system' ? 'ai' : sender;
    rowDiv.className = `message-row ${visualSender}`;
    
    // 根据发送者决定头像文字
    const avatarText = options.avatarLabel || getChatAvatarLabel(sender);
    
    // 构建内部 HTML (头像 + 气泡)
    rowDiv.innerHTML = `
        <div class="avatar">${avatarText}</div>
        <div class="bubble">${content}</div>
    `;
    
    // 添加并滚动到底部
    messagesDiv.appendChild(rowDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getChatAvatarLabel(sender) {
    if (sender === 'system') {
        return '⚙️';
    }
    const isPaired = experimentData && experimentData.chatMode === 'paired';
    if (!isPaired) {
        return sender === 'ai' ? '访' : '我';
    }

    const isCounselor = !!(experimentData.controlPairing && experimentData.controlPairing.isCounselor);
    if (sender === 'ai') {
        return isCounselor ? '访' : '咨';
    }
    return '我';
}

// experiment.js - 修复版 callAIAPI

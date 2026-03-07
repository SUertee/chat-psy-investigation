// AI service calls and feedback rendering.
function getAiProxyUrl() {
    return `${EXPERIMENT_CONFIG.BACKEND_BASE_URL}/ai/chat`;
}

async function callTutorAPI() {
    // 定义 loading 元素的 ID
    const loadingId = 'tutor-loading';
    
    // 显示 loading 占位符
    addTutorMessage('ai', `<span id="${loadingId}" style="color: #888; font-style: italic;">🤖 正在思考中...</span>`);
    console.log(">>> 开始调用 AI Tutor API..."); // [Debug]

    try {
        const apiUrl = getAiProxyUrl();

        // --- 1. 数据清洗 ---
        const messages = [];
        if (experimentData.tutorChatHistory) {
            experimentData.tutorChatHistory.forEach(msg => {
                if (msg.content && String(msg.content) !== 'undefined' && String(msg.content) !== 'null') {
                    messages.push({
                        role: msg.role,
                        content: String(msg.content)
                    });
                }
            });
        }

        console.log(">>> 发送的消息列表:", messages); // [Debug] 检查发送给AI的历史记录是否正常

        // --- 2. 发送请求 ---
        // 注意：将 max_completion_tokens 改回 max_tokens，兼容性更好
        const requestBody = {
            model: API_CONFIG.AI_MODEL,
            messages: messages, 
            temperature: 0.7,
            max_tokens: 1000, // <--- 关键修改：从 max_completion_tokens 改为 max_tokens
            stream: false
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        // --- 3. 错误处理 ---
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // 防止解析错误body失败
            console.error(">>> API 响应错误:", response.status, errorData); // [Debug]
            
            // 移除 loading
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                const row = loadingEl.closest('.message-row');
                if (row) row.remove();
            }

            // 显示给用户的错误信息
            let userErrorMsg = "（Tutor 遇到了一点连接问题，请重试）";
            if (response.status === 401) userErrorMsg = "（API Key 无效或过期，请联系管理员）";
            if (response.status === 429) userErrorMsg = "（请求太频繁，请稍等再试）";
            if (response.status === 400) userErrorMsg = "（请求格式错误，可能是历史记录过长）";

            addTutorMessage('ai', userErrorMsg);
            experimentData.tutorChatHistory.push({ role: 'assistant', content: userErrorMsg });
            return;
        }

        const data = await response.json();
        console.log(">>> API 返回数据:", data); // [Debug]
        
        // 移除 loading 占位符
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            const row = loadingEl.closest('.message-row');
            if (row) row.remove();
        }

        // --- 4. 响应处理 ---
        let aiText = "";
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            aiText = data.choices[0].message.content;
        } else {
            console.warn(">>> API 返回结构异常:", data);
            aiText = "（Tutor 正在思考，但没有输出内容...）";
        }

        // 显示真实回复
        addTutorMessage('ai', aiText);
        experimentData.tutorChatHistory.push({ role: 'assistant', content: aiText });

    } catch (error) {
        console.error(">>> Tutor API 网络/代码错误:", error); // [Debug]
        
        // 移除 loading
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            const row = loadingEl.closest('.message-row');
            if (row) row.remove();
        }

        // 显示友好的错误提示
        addTutorMessage('ai', `网络出小差了 (${error.message})，请重试。`);
    }
}
async function callAIAPI(userMessage) {
    const loadingId = 'ai-loading-' + Date.now();
    
    // 注入一段临时的 CSS 动画，让点点点动起来
    const dotStyle = `
        <style>
            @keyframes dot-blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
            .typing-dots span { animation: dot-blink 1.4s infinite both; font-weight: bold; }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        </style>
    `;

    try {
        const apiUrl = getAiProxyUrl();
        
        // 1. 后台悄悄开始请求
        const fetchPromise = fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: API_CONFIG.AI_MODEL,
                messages: [{ role: 'system', content: aiClientPrompt }, ...experimentData.chatHistory.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: String(msg.content)
                }))],
                temperature: API_CONFIG.AI_TEMPERATURE,
                max_tokens: API_CONFIG.AI_MAX_TOKENS,
                stream: false
            })
        });

        // 2. 随机反应潜伏期 (1-2秒)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        
        // 3. 显示带有“动态省略号”的状态
        addChatMessage('ai', dotStyle + `
            <span id="${loadingId}" style="color: #888; font-style: italic;">
                对方正在输入中<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
            </span>
        `);

        const response = await fetchPromise;
        if (!response.ok) {
            let detail = `状态码 ${response.status}`;
            try {
                const errorPayload = await response.json();
                detail = errorPayload?.detail || errorPayload?.error?.message || JSON.stringify(errorPayload);
            } catch (e) {
                // keep fallback detail
            }
            throw new Error(detail);
        }
        const data = await response.json();
        const aiResponse = data?.choices?.[0]?.message?.content || '（系统未返回有效内容）';

        // 4. 动态计算输入时间 (3-6秒)
        let typingTime = 2000 + (aiResponse.length / 10) * 1000; 
        typingTime = Math.max(3000, Math.min(6000, typingTime));
        await new Promise(resolve => setTimeout(resolve, typingTime));

        // 5. 移除状态并显示回复
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.closest('.message-row')?.remove();

        addChatMessage('ai', aiResponse);
        experimentData.chatHistory.push({
            timestamp: getCurrentTimestamp(),
            sender: 'ai',
            content: aiResponse
        });
        
    } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.closest('.message-row')?.remove();
        addChatMessage('ai', `（系统提示：AI暂时不可用：${error.message}）`);
    }
}
async function generateSupervisorFeedback() {
    // 1. 设置加载中的界面 (美化版)
    const loadingHTML = `
        <div style="text-align: center; padding: 50px 20px;">
            <div class="spinner" style="
                width: 50px; height: 50px; border: 5px solid #f3f3f3; 
                border-top: 5px solid #3498db; border-radius: 50%; 
                animation: spin 1s linear infinite; margin: 0 auto 20px;">
            </div>
            <h3 style="color: #2c3e50;">AI督导正在分析您的咨询记录...</h3>
            <p style="color: #7f8c8d;">正在从四个维度评估您的危机干预技能，请稍候。</p>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
    `;
    document.getElementById('supervisorContent').innerHTML = loadingHTML;

    try {
        // 准备督导prompt
        const supervisorPrompt = AI_PROMPTS.SUPERVISOR;
        const chatHistoryText = experimentData.chatHistory
            .map(msg => `${msg.timestamp} - ${msg.sender}: ${msg.content}`)
            .join('\n');
        
        const apiUrl = getAiProxyUrl();
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: API_CONFIG.AI_MODEL,
                messages: [
                    { role: 'system', content: supervisorPrompt },
                    { role: 'user', content: `咨询对话记录：\n${chatHistoryText}\n\n请基于以上对话记录，对我的危机评估技能进行专业反馈。` }
                ],
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            })
        });
        
        if (!response.ok) {
            let errorDetails = `Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetails += `, Message: ${errorData.error ? errorData.error.message : JSON.stringify(errorData)}`;
            } catch (e) {
                errorDetails += ", Response body is not JSON.";
            }
            throw new Error(`AI督导API调用失败: ${errorDetails}`);
        }
        
        const data = await response.json();
        const feedbackRaw = data.choices[0].message.content;
        
        // 保存反馈
        experimentData.supervisorFeedback = feedbackRaw;
        
        // === 核心修改：美化渲染逻辑 ===
        const formattedFeedback = formatFeedbackContent(feedbackRaw);

        // 渲染最终界面
        document.getElementById('supervisorContent').innerHTML = `
            <style>
                /* 反馈卡片样式 */
                .feedback-card {
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    padding: 40px;
                    text-align: left;
                    font-family: 'Microsoft YaHei', sans-serif;
                    line-height: 1.8;
                    color: #444;
                }
                
                /* 维度标题样式 */
                .dim-title {
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #2980b9;
                    background-color: #f0f7fb;
                    padding: 10px 15px;
                    border-left: 5px solid #2980b9;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    border-radius: 0 4px 4px 0;
                }
                
                /* 标签样式：表现描述 */
                .tag-desc {
                    font-weight: bold;
                    color: #555;
                    margin-right: 5px;
                }
                
                /* 标签样式：做得好的 */
                .tag-good {
                    display: inline-block;
                    background-color: #e8f8f0;
                    color: #27ae60;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-top: 10px;
                    margin-right: 5px;
                    border: 1px solid #ccebd6;
                }
                
                /* 标签样式：需要提升 */
                .tag-bad {
                    display: inline-block;
                    background-color: #fdf2e9;
                    color: #e67e22;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-top: 10px;
                    margin-right: 5px;
                    border: 1px solid #fae5d3;
                }

                /* 总结部分 */
                .feedback-summary {
                    margin-top: 40px;
                    padding: 20px;
                    background-color: #fff8e1;
                    border: 1px dashed #ffc107;
                    border-radius: 8px;
                }
            </style>

            <div class="feedback-card">
                <div style="text-align:center; margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:20px;">
                    <h2 style="color:#2c3e50; margin:0;">📑 模拟咨询督导报告</h2>
                    <p style="color:#999; font-size:0.9em; margin-top:10px;">基于本次练习生成的个性化分析</p>
                </div>

                ${formattedFeedback}
                
                <div style="text-align: center; margin-top: 40px;">
                    <button class="jspsych-btn" onclick="finishSupervisorFeedback()" 
                        style="padding: 12px 40px; background-color: #2c3e50; color: white; border: none; font-size: 16px; border-radius: 4px; cursor: pointer;">
                        阅读完毕，继续
                    </button>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('AI督导反馈生成错误:', error);
        document.getElementById('supervisorContent').innerHTML = `
            <div style="background:#fff; padding:40px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.1); color: #e74c3c;">
                <h3>⚠️ 生成报告时遇到问题</h3>
                <p>${error.message}</p>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="jspsych-btn" onclick="finishSupervisorFeedback()">跳过此步骤</button>
                </div>
            </div>
        `;
    }
}

// 辅助函数：将纯文本美化为 HTML
function formatFeedbackContent(text) {
    if (!text) return '';

    // 1. 处理 Markdown 粗体 (**text**) 为 HTML <b>
    let html = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // 2. 高亮 "维度X："
    // 识别 "维度1：" 或 "维度一" 等开头
    html = html.replace(/(维度\s*\d+[：:]?.*?|维度[一二三四][：:]?.*?)(?=\n|<br>|$)/g, '<div class="dim-title">$1</div>');

    // 3. 高亮 "表现描述"
    html = html.replace(/(表现描述[：:])/g, '<br><span class="tag-desc">📝 $1</span>');

    // 4. 高亮 "做得好的地方"
    html = html.replace(/(做得好的地方[：:])/g, '<br><span class="tag-good">✅ $1</span>');

    // 5. 高亮 "需要提升的地方" 或 "可以提升的地方"
    html = html.replace(/(需要提升的地方[：:]|可以提升的地方[：:]|需要改进的地方[：:])/g, '<br><span class="tag-bad">💡 $1</span>');

    // 6. 处理 "总结："
    html = html.replace(/(总结[：:]|整体评价[：:])/g, '<div class="feedback-summary"><strong>🎓 $1</strong>');
    // 如果有总结div，需要在最后闭合它（这里简单处理，假设总结在最后）
    if (html.includes('<div class="feedback-summary">')) {
        html += '</div>';
    }

    // 7. 将换行符转换为 <br>，但避免在 div 标签附近重复换行
    html = html.replace(/\n/g, '<br>');
    
    return html;
}
async function showSupervisorFeedbackUI(data, type, options = {}) {
    const mode = options.mode || 'supervisor';
    const mainTitle = mode === 'peer' ? '📋 危机评估复盘报告' : '📋 危机评估督导复盘报告';
    const secondTitle = mode === 'peer' ? '第二部分：来访者扮演人同辈反馈' : '第二部分：AI 督导专业反馈';
    // 1. 根据你的实验顺序 (小B -> 小吴 -> 小C) 匹配档案
    let activeProfile;
    
    // 第一次练习：小B (低风险)
    const profileB = {
        title: "第一次练习：个案复盘 (低风险个案)",
        level: "<span style='color:#27ae60;'>🟢 低风险</span>",
        identity: "17 岁，高二女生，曾品学兼优",
        situation: "寒假在家，期末考试成绩大幅滑坡，排名退步严重。",
        stress: `<ul><li><strong>学业：</strong>注意力难集中，长期失眠，学业吃力。</li><li><strong>家庭：</strong>父母期望极高，因成绩下降而严厉指责。</li><li><strong>心理：</strong>强烈怀疑自己的能力，感到绝望。</li><li><strong>生理：</strong>强烈的头疼和胃疼。</li></ul>`,
        crisisDetail: `<div style="background:#f0fff4; padding:18px; border-radius:10px; border:1px solid #9ae6b4; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🟢 自杀想法中等（6/10）：</strong>觉得很失败，希望睡着了不用再醒来。</p><p style="margin: 0 0 10px 0;"><strong>📍 没有明确的自杀计划：</strong>只是希望痛苦能够停止，没想过真的结束生命。</p><p style="margin: 0 0 10px 0;"><strong>🎯 无明确意图。</strong></p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为：</strong>未采取任何具体自杀准备或实施行为。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>持续学业压力，缺乏父母支持，身体不适。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>祖父母的关爱；有好友谈心；通过写日记和听音乐平复心情。</p></div>`
    };

    // 第二次练习：小吴 (高风险)
    const profileWU = {
        title: "第二次练习：个案复盘 (高风险个案)",
        level: "<span style='color:#e74c3c;'>🔴 高风险</span>",
        identity: "27 岁，男性，大学毕业后自主创业者",
        situation: "创业失败负债",
        stress: `<ul><li><strong>经济：</strong>身无分文，负债 15 万，融资失败，时常有催债人上门。</li><li><strong>家庭：</strong>家人指责并断绝关系，出租屋即将到期。</li><li><strong>心理：</strong>深度挫败感、社会性死亡、极度自我厌恶。</li><li><strong>生理：</strong>严重失眠，两周内体重骤降 5 斤。</li></ul>`,
        crisisDetail: `<div style="background:#fff5f5; padding:18px; border-radius:10px; border:1px solid #feb2b2; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🔴 自杀想法极强（9/10）：</strong>认为解脱是唯一出路，情绪崩溃时出现幻听。</p><p style="margin: 0 0 10px 0;"><strong>📍 具体自杀计划：</strong>非常明确——网购安眠药，选定本周五在出租屋实施。</p><p style="margin: 0 0 10px 0;"><strong>🎯 实施意图极高（8/10）：</strong>认为人生已无转机，已做好最终决定。</p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为充分：</strong>已买药确认剂量；给室友发告别信息；整理个人物品。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>重大经济挫折；支持系统断裂；近期负性事件集中爆发。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>对女朋友的愧疚；生理怕疼本能；名牌大学毕业，如果去找工作其实能能找到，可以把钱慢慢还上</p></div>`
    };

    // 第三次练习 (后测)：小C (中高风险)
    const profileC = {
        title: "最后一次练习 (后测)：个案复盘",
        level: "<span style='color:#f39c12;'>🟠 中风险</span>",
        identity: "17岁，高二女生，长期遭受校园霸凌",
        situation: "在校被起侮辱性外号并被撞倒，父母不理解，目前躲在房间极度难受。",
        stress: `<ul><li><strong>校园霸凌：</strong>长期被孤立、造谣，被取侮辱性外号。</li><li><strong>家庭：</strong>父母归结为“爱惹事”，缺乏支持。</li><li><strong>心理：</strong>曾确诊抑郁症并休学，存在自伤行为。</li></ul>`,
        crisisDetail: `<div style="background:#fffaf0; padding:18px; border-radius:10px; border:1px solid #fbd38d; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🟠 自杀想法较强烈（8/10）：</strong>认为生活是折磨，自杀是唯一出路。</p><p style="margin: 0 0 10px 0;"><strong>📍 有模糊自杀计划：</strong>想吞食大量药物，但无具体实施时间或地点计划。</p><p style="margin: 0 0 10px 0;"><strong>🎯 自杀意图极低（1/10）：</strong>虽然痛苦，但目前没有明确的实施意图。</p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为：</strong>曾攒药被母亲发现藏起，目前无自杀准备行为。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>非自杀性自伤（NSSI）；抑郁症病史；持续霸凌。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>坚持服药复诊；放心不下小猫；答应过父母不自杀。</p></div>`
    };

    // 2. 根据调用时传入的 type 自动切换
    if (type === 'P3') activeProfile = profileC;      // 最后一次练习是小C
    else if (type === 'P2') activeProfile = profileWU; // 第二次练习是小吴
    else activeProfile = profileB;                     // 第一次练习是小B

    // --- 剩下的 HTML 渲染代码保持一致 ---
    const overlayHTML = `
    <div id="supFeedbackOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(240, 242, 245, 0.98); z-index:10001; overflow-y:auto; padding:40px 20px; font-family:'Microsoft YaHei', sans-serif;">
        <div style="max-width:850px; margin:0 auto; background:white; border-radius:15px; box-shadow:0 10px 50px rgba(0,0,0,0.1); overflow:hidden; animation: fadeIn 0.5s ease;">
            
            <div style="background:linear-gradient(135deg, #1a73e8 0%, #1557b0 100%); color:white; padding:35px; text-align:center;">
                <h1 style="margin:0; font-size:24px; letter-spacing:1px;">${mainTitle}</h1>
                <p style="margin:10px 0 0; opacity:0.8;">${activeProfile.title}</p>
            </div>

            <div style="padding:40px;">
                <div style="margin-bottom:45px;">
                    <h3 style="color:#1a73e8; border-left:5px solid #1a73e8; padding-left:15px; margin-bottom:25px;">第一部分：来访者真实档案 (上帝视角)</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; margin-bottom:25px;">
                        <div style="background:#f8faff; padding:20px; border-radius:10px; border-top:4px solid #1a73e8;">
                            <p><strong>🎯 真实危机等级：</strong> ${activeProfile.level}</p>
                            <p><strong>👤 身份设定：</strong> ${activeProfile.identity}</p>
                            <p><strong>📍 当前处境：</strong> ${activeProfile.situation}</p>
                        </div>
                        <div style="background:#fffcf5; padding:20px; border-radius:10px; border-top:4px solid #fbbc04;">
                            <p><strong>🔥 核心压力来源分析：</strong></p>
                            ${activeProfile.stress}
                        </div>
                    </div>
                    <p style="font-weight:bold; color:#5f6368; margin-bottom:12px;">🔍 详细风险评估标准:</p>
                    ${activeProfile.crisisDetail}
                </div>

                <div style="height:1px; background:#eee; margin:40px 0;"></div>

                <div>
                    <h3 style="color:#1a73e8; border-left:5px solid #1a73e8; padding-left:15px; margin-bottom:25px;">${secondTitle}</h3>
                    
                    <div id="supFeedbackLoading" style="text-align:center; padding:50px;">
                        <div style="display:inline-block; width:40px; height:40px; border:4px solid #f3f3f3; border-top:4px solid #1a73e8; border-radius:50%; animation:spin 1s linear infinite;"></div>
                        <p style="color:#666; margin-top:20px;">督导正在深度阅读并分析您的对话记录...</p>
                    </div>

                    <div id="supFeedbackResult" style="display:none; line-height:1.8; color:#333; background:#f9f9f9; padding:25px; border-radius:10px; border:1px solid #f1f3f4; font-size:15px;">
                        </div>
                </div>

                <div style="text-align:center; margin-top:60px; display:none;" id="supFeedbackBtnContainer">
                    <button id="closeFeedbackBtn" style="padding:15px 100px; background:#27ae60; color:white; border:none; border-radius:40px; font-size:17px; font-weight:bold; cursor:pointer; box-shadow:0 10px 20px rgba(39,174,96,0.3); transition:0.3s;">
                        我已完成复盘，继续实验 →
                    </button>
                </div>
            </div>
        </div>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            #closeFeedbackBtn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(39,174,96,0.4); }
        </style>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);

    // 核心修复：手动绑定点击事件，确保按钮可点
    document.getElementById('closeFeedbackBtn').onclick = function() {
        document.getElementById('supFeedbackOverlay').remove();
        proceedToNextStage();
    };

    try {
        const feedback = await callPracticeFeedbackAPI(data, mode);
        document.getElementById('supFeedbackLoading').style.display = 'none';
        
        // --- 核心修复：消除奇怪符号并美化 Markdown 排版 ---
        const resultDiv = document.getElementById('supFeedbackResult');
        resultDiv.innerHTML = feedback
            .replace(/### (.*)/g, '<h4 style="color:#1a73e8; border-bottom:1px solid #e8f0fe; padding-bottom:5px; margin-top:25px;">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#2c3e50; background:#f0f7ff; padding:0 4px; border-radius:3px;">$1</strong>')
            .replace(/维度(\d+)：/g, '<div style="display:inline-block; padding:2px 10px; background:#1a73e8; color:white; border-radius:4px; font-size:13px; margin-top:10px;">维度 $1</div>');
        
        resultDiv.style.display = 'block';
        document.getElementById('supFeedbackBtnContainer').style.display = 'block';
    } catch (e) {
        document.getElementById('supFeedbackLoading').innerHTML = "<p style='color:red;'>抱歉，报告生成遇到一点小问题，请点击下方按钮继续。</p>";
        document.getElementById('supFeedbackBtnContainer').style.display = 'block';
    }
}


async function callPracticeFeedbackAPI(data, mode = 'supervisor') {
    // 【核心改进】明确标注角色，防止 AI 督导张冠李戴
    const chatLog = data.chatHistory.map(m => {
        const roleName = m.sender === 'user' ? '新手咨询师' : '虚拟来访者';
        return `${roleName}: ${m.content}`;
    }).join('\n');

    const roleIntro = mode === 'peer'
        ? '你是一名认真参与实验的“来访者扮演同辈”，请基于对话体验给出结构化反馈。'
        : '你是一名资深的心理咨询督导，现在需要对一名“新手咨询师”的模拟练习表现进行专业点评。';

    const prompt = `${roleIntro}
    
    【练习背景】：咨询师正在与一名有自杀倾向的“虚拟来访者”进行初步接触和风险评估。
    【咨询师评估等级】：${data.level === 'high' ? '高风险' : data.level === 'medium' ? '中风险' : '低风险'}
    【咨询师给出的理由】：${data.reason}
    
    【对话历史记录】：
    ${chatLog}
    
    请根据哥伦比亚自杀严重程度评估标准（C-SSRS）和心理咨询原则进行点评：
    1. 评估准确性：咨询师定级为“${data.level}”是否准确？（请注意：如果对话轮数极少，请指出咨询师在信息不足时过早定级的风险）。
    2. 维度评估（请按“做得好的地方”和“提升建议”两个子模块撰写）：
       - 维度1：建立关系（共情是否到位、是否有效降低了阻抗）
       - 维度2：风险因素探索（是否捕捉到关键危机信号）
       - 维度3：保护性因素探索（是否讨论了支持系统或牵挂）
       - 维度4：C-SSRS 规范性（是否询问了意念、计划、意图和行为）
    3. 综合总结：指出 1-2 个最核心的改进点。
    
    要求：语气专业、严谨且具有指导意义。`;

    const response = await fetch(getAiProxyUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: API_CONFIG.AI_MODEL,
            messages: [
                {role: "system", content: mode === 'peer' ? "你是一名严谨且真诚的同辈反馈者。" : "你是一名严谨的心理咨询督导专家。"}, 
                {role: "user", content: prompt}
            ],
            temperature: 0.7
        })
    });
    if (!response.ok) {
        let detail = `状态码 ${response.status}`;
        try {
            const errorPayload = await response.json();
            detail = errorPayload?.detail || errorPayload?.error?.message || JSON.stringify(errorPayload);
        } catch (e) {
            // keep fallback detail
        }
        throw new Error(`AI反馈接口失败：${detail}`);
    }
    const resData = await response.json();
    const content = resData?.choices?.[0]?.message?.content || '（AI 未返回可解析内容）';
    return content.replace(/\n/g, '<br>');
}

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
                    color: #222;
                    background-color: #f5f5f5;
                    padding: 10px 15px;
                    border-left: 5px solid #444;
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
                    background-color: #f7f7f7;
                    color: #222;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-top: 10px;
                    margin-right: 5px;
                    border: 1px solid #ddd;
                }
                
                /* 标签样式：需要提升 */
                .tag-bad {
                    display: inline-block;
                    background-color: #f7f7f7;
                    color: #222;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-top: 10px;
                    margin-right: 5px;
                    border: 1px solid #ddd;
                }

                /* 总结部分 */
                .feedback-summary {
                    margin-top: 40px;
                    padding: 20px;
                    background-color: #f7f7f7;
                    border: 1px dashed #ccc;
                    border-radius: 8px;
                }
            </style>

            <div class="feedback-card">
                <div style="text-align:center; margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:20px;">
                    <h2 style="color:#222; margin:0;">模拟咨询督导报告</h2>
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

    // 4. 高亮 "做得好的地方"，并统一补全主语“咨询师”
    html = html.replace(/((?:咨询师)?做得好的地方[：:])/g, (match) => {
        const normalized = match.startsWith('咨询师') ? match : `咨询师${match}`;
        return `<br><span class="tag-good">✅ ${normalized}</span>`;
    });

    // 5. 高亮 "需要提升的地方" 或 "可以提升的地方"，并统一补全主语“咨询师”
    html = html.replace(/((?:咨询师)?需要提升的地方[：:]|(?:咨询师)?可以提升的地方[：:]|(?:咨询师)?需要改进的地方[：:])/g, (match) => {
        const normalized = match.startsWith('咨询师') ? match : `咨询师${match}`;
        return `<br><span class="tag-bad">💡 ${normalized}</span>`;
    });

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
function renderPeerFeedbackHTML(feedback) {
    if (!feedback) {
        return '';
    }
    return `
        <div style="display:grid; gap:12px;">
            <div style="background:#fff; border:1px solid #e9edf3; border-radius:8px; padding:14px;">
                <strong>维度1：建立关系</strong>
                <p style="margin:8px 0 0 0;"><strong>咨询师做得好的地方：</strong>${feedback.relationship_good || ''}</p>
                <p style="margin:6px 0 0 0;"><strong>咨询师需要提升的地方：</strong>${feedback.relationship_improve || ''}</p>
            </div>
            <div style="background:#fff; border:1px solid #e9edf3; border-radius:8px; padding:14px;">
                <strong>维度2：风险评估</strong>
                <p style="margin:8px 0 0 0;"><strong>咨询师做得好的地方：</strong>${feedback.risk_good || ''}</p>
                <p style="margin:6px 0 0 0;"><strong>咨询师需要提升的地方：</strong>${feedback.risk_improve || ''}</p>
            </div>
            <div style="background:#fff; border:1px solid #e9edf3; border-radius:8px; padding:14px;">
                <strong>维度3：保护因素探索</strong>
                <p style="margin:8px 0 0 0;"><strong>咨询师做得好的地方：</strong>${feedback.protective_good || ''}</p>
                <p style="margin:6px 0 0 0;"><strong>咨询师需要提升的地方：</strong>${feedback.protective_improve || ''}</p>
            </div>
            <div style="background:#fff; border:1px solid #e9edf3; border-radius:8px; padding:14px;">
                <strong>维度4：综合建议</strong>
                <p style="margin:8px 0 0 0;">${feedback.overall_suggestion || ''}</p>
            </div>
        </div>
    `;
}

async function showSupervisorFeedbackUI(data, type, options = {}) {
    if (document.getElementById('supFeedbackOverlay')) {
        return;
    }
    const mode = options.mode || 'supervisor';
    const mainTitle = mode === 'peer' ? '危机评估复盘报告' : '危机评估督导复盘报告';
    const secondTitle = mode === 'peer' ? '第二部分：来访者扮演人同辈反馈' : '第二部分：AI 督导专业反馈';
    // 1. 根据你的实验顺序 (小B -> 小吴 -> 小C) 匹配档案
    let activeProfile;
    
    // 第一次练习：小B (低风险)
    const profileB = {
        title: "第一次练习：个案复盘 (低风险个案)",
        level: "低风险",
        identity: "17 岁，高二女生，曾品学兼优",
        situation: "寒假在家，期末考试成绩大幅滑坡，排名退步严重。",
        stress: `<ul><li><strong>学业：</strong>注意力难集中，长期失眠，学业吃力。</li><li><strong>家庭：</strong>父母期望极高，因成绩下降而严厉指责。</li><li><strong>心理：</strong>强烈怀疑自己的能力，感到绝望。</li><li><strong>生理：</strong>强烈的头疼和胃疼。</li></ul>`,
        crisisDetail: `<div style="background:#f0fff4; padding:18px; border-radius:10px; border:1px solid #9ae6b4; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🟢 自杀想法中等（6/10）：</strong>觉得很失败，希望睡着了不用再醒来。</p><p style="margin: 0 0 10px 0;"><strong>📍 没有明确的自杀计划：</strong>只是希望痛苦能够停止，没想过真的结束生命。</p><p style="margin: 0 0 10px 0;"><strong>🎯 无明确意图。</strong></p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为：</strong>未采取任何具体自杀准备或实施行为。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>持续学业压力，缺乏父母支持，身体不适。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>祖父母的关爱；有好友谈心；通过写日记和听音乐平复心情。</p></div>`
    };

    // 第二次练习：小吴 (高风险)
    const profileWU = {
        title: "第二次练习：个案复盘 (高风险个案)",
        level: "高风险",
        identity: "27 岁，男性，大学毕业后自主创业者",
        situation: "创业失败负债",
        stress: `<ul><li><strong>经济：</strong>身无分文，负债 15 万，融资失败，时常有催债人上门。</li><li><strong>家庭：</strong>家人指责并断绝关系，出租屋即将到期。</li><li><strong>心理：</strong>深度挫败感、社会性死亡、极度自我厌恶。</li><li><strong>生理：</strong>严重失眠，两周内体重骤降 5 斤。</li></ul>`,
        crisisDetail: `<div style="background:#fff5f5; padding:18px; border-radius:10px; border:1px solid #feb2b2; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🔴 自杀想法极强（9/10）：</strong>认为解脱是唯一出路，情绪崩溃时出现幻听。</p><p style="margin: 0 0 10px 0;"><strong>📍 具体自杀计划：</strong>非常明确——网购安眠药，选定本周五在出租屋实施。</p><p style="margin: 0 0 10px 0;"><strong>🎯 实施意图极高（8/10）：</strong>认为人生已无转机，已做好最终决定。</p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为充分：</strong>已买药确认剂量；给室友发告别信息；整理个人物品。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>重大经济挫折；支持系统断裂；近期负性事件集中爆发。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>对女朋友的愧疚；生理怕疼本能；名牌大学毕业，如果去找工作其实能能找到，可以把钱慢慢还上</p></div>`
    };

    // 第三次练习 (后测)：小C (中高风险)
    const profileC = {
        title: "最后一次练习 (后测)：个案复盘",
        level: "中风险",
        identity: "17岁，高二女生，长期遭受校园霸凌",
        situation: "因为抑郁症休学后刚刚复学，就在校被起侮辱性外号并被撞倒，父母不理解，目前躲在家里的房间极度难受。",
        stress: `<ul><li><strong>校园霸凌：</strong>长期被孤立、造谣，被取侮辱性外号。</li><li><strong>家庭：</strong>父母归结为“爱惹事”，缺乏支持。</li><li><strong>心理：</strong>曾确诊抑郁症并休学，存在自伤行为。</li></ul>`,
        crisisDetail: `<div style="background:#fffaf0; padding:18px; border-radius:10px; border:1px solid #fbd38d; line-height:1.7; color:#2d3748; font-size:14px;"><p style="margin: 0 0 10px 0;"><strong>🟠 自杀想法较强烈（8/10）：</strong>认为目前的生活是折磨，自己找不到出路。</p><p style="margin: 0 0 10px 0;"><strong>📍 有明确自杀计划：</strong>想等家里没人的时候通过割腕自杀。</p><p style="margin: 0 0 10px 0;"><strong>🎯 自杀实施意图较低（3/10）：</strong>还没有完全下定决心自杀，对于未来仍有微弱期待，没有任何要立刻行动的想法。</p><p style="margin: 0 0 10px 0;"><strong>📦 准备行为：</strong>近期无任何收集、准备自杀工具的行为。</p><p style="margin: 0 0 10px 0;"><strong>⚠️ 风险因素：</strong>非自杀性自伤史；抑郁症病史；持续遭受霸凌。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>父母带着她定期服药复诊；放心不下家里的小猫；高中只剩一年了，毕业后就可以离开这些霸凌自己的人。</p></div>`
    };

    // 2. 根据调用时传入的 type 自动切换
    if (type === 'P3') activeProfile = profileC;      // 最后一次练习是小C
    else if (type === 'P2') activeProfile = profileWU; // 第二次练习是小吴
    else activeProfile = profileB;                     // 第一次练习是小B

    // --- 剩下的 HTML 渲染代码保持一致 ---
    const overlayHTML = `
    <div id="supFeedbackOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(240, 242, 245, 0.98); z-index:10001; overflow-y:auto; padding:40px 20px; font-family:'Microsoft YaHei', sans-serif;">
        <div style="max-width:850px; margin:0 auto; background:white; border-radius:15px; box-shadow:0 10px 50px rgba(0,0,0,0.1); overflow:hidden; animation: fadeIn 0.5s ease;">
            
            <div style="background:linear-gradient(135deg, #2f80ed 0%, #56ccf2 100%); color:white; padding:35px; text-align:center;">
                <h1 style="margin:0; font-size:24px; letter-spacing:1px;">${mainTitle}</h1>
                <p style="margin:10px 0 0; opacity:0.8;">${activeProfile.title}</p>
            </div>

            <div style="padding:40px;">
                <div style="margin-bottom:45px;">
                    <h3 style="color:#222; border-left:5px solid #2f80ed; padding-left:15px; margin-bottom:25px;">第一部分：来访者真实档案 (上帝视角)</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; margin-bottom:25px;">
                        <div style="background:#f4f9ff; padding:20px; border-radius:10px; border-top:4px solid #2f80ed;">
                            <p><strong>🎯 真实危机等级：</strong> ${activeProfile.level}</p>
                            <p><strong>👤 身份设定：</strong> ${activeProfile.identity}</p>
                            <p><strong>📍 当前处境：</strong> ${activeProfile.situation}</p>
                        </div>
                        <div style="background:#fffaf2; padding:20px; border-radius:10px; border-top:4px solid #f2a154;">
                            <p><strong>🔥 核心压力来源分析：</strong></p>
                            ${activeProfile.stress}
                        </div>
                    </div>
                    <p style="font-weight:bold; color:#5f6368; margin-bottom:12px;">🔍 详细风险评估标准:</p>
                    ${activeProfile.crisisDetail}
                </div>

                <div style="height:1px; background:#eee; margin:40px 0;"></div>

                <div>
                    <h3 style="color:#222; border-left:5px solid #2f80ed; padding-left:15px; margin-bottom:25px;">${secondTitle}</h3>
                    ${mode === 'peer' ? `
                    <div style="margin:-10px 0 18px 0; color:#5f6368; font-size:14px; display:flex; justify-content:space-between; gap:12px;">
                        <span id="peerFeedbackStatusText">请等待来访者提交反馈（最多 05:00）。</span>
                        <span id="peerFeedbackTimer">等待剩余 05:00</span>
                    </div>` : `
                    <div style="margin:-10px 0 18px 0; color:#5f6368; font-size:14px; display:flex; justify-content:space-between; gap:12px;">
                        <span id="peerFeedbackStatusText">AI督导正在生成反馈，请稍候。</span>
                        <span id="peerFeedbackTimer">阅读剩余 05:00</span>
                    </div>`}
                    <div id="supFeedbackLoading" style="text-align:center; padding:50px;">
                        <div style="display:inline-block; width:40px; height:40px; border:4px solid #f3f3f3; border-top:4px solid #555; border-radius:50%; animation:spin 1s linear infinite;"></div>
                        <p style="color:#666; margin-top:20px;">${mode === 'peer' ? '等待来访者扮演人提交反馈...' : '督导正在深度阅读并分析您的对话记录...'}</p>
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

    const cleanupAndProceed = function() {
        if (window.peerFeedbackPollingInterval) {
            clearInterval(window.peerFeedbackPollingInterval);
            window.peerFeedbackPollingInterval = null;
        }
        if (window.peerFeedbackCountdownTimer) {
            clearInterval(window.peerFeedbackCountdownTimer);
            window.peerFeedbackCountdownTimer = null;
        }
        if (window.supervisorReadCountdownTimer) {
            clearInterval(window.supervisorReadCountdownTimer);
            window.supervisorReadCountdownTimer = null;
        }
        const overlay = document.getElementById('supFeedbackOverlay');
        if (overlay) overlay.remove();
        proceedToNextStage();
    };
    document.getElementById('closeFeedbackBtn').onclick = cleanupAndProceed;

    if (mode === 'peer') {
        const resultDiv = document.getElementById('supFeedbackResult');
        const loadingDiv = document.getElementById('supFeedbackLoading');
        const btnContainer = document.getElementById('supFeedbackBtnContainer');
        const timerEl = document.getElementById('peerFeedbackTimer');
        const statusEl = document.getElementById('peerFeedbackStatusText');
        let lastSubmittedAt = '';
        let hasFeedbackShown = false;
        let reviewCompleteTriggered = false;
        let waitSeconds = 5 * 60;
        let readSeconds = 5 * 60;
        let waitTimedOut = false;

        const roundNo = data.roundNo || (experimentData.controlPairing && experimentData.controlPairing.activeRoundNo) || 1;
        const markReviewAndProceed = async () => {
            if (reviewCompleteTriggered) {
                return;
            }
            reviewCompleteTriggered = true;
            if (window.peerFeedbackCountdownTimer) {
                clearInterval(window.peerFeedbackCountdownTimer);
                window.peerFeedbackCountdownTimer = null;
            }
            if (window.peerFeedbackPollingInterval) {
                clearInterval(window.peerFeedbackPollingInterval);
                window.peerFeedbackPollingInterval = null;
            }
            try {
                await markPairedReviewComplete(roundNo);
            } catch (error) {
                console.warn('[PEER_FEEDBACK] 标记阅读完成失败:', error);
            }
            cleanupAndProceed();
        };
        document.getElementById('closeFeedbackBtn').onclick = markReviewAndProceed;

        const pollPeerFeedback = async () => {
            try {
                const payload = await fetchPairedClientFeedback(roundNo);
                if (!payload || !payload.submitted) {
                    return;
                }
                if (payload.submitted_at === lastSubmittedAt && resultDiv.style.display === 'block') {
                    return;
                }
                lastSubmittedAt = payload.submitted_at || '';
                loadingDiv.style.display = 'none';
                resultDiv.innerHTML = renderPeerFeedbackHTML(payload.feedback);
                resultDiv.style.display = 'block';
                btnContainer.style.display = 'block';
                if (!hasFeedbackShown) {
                    hasFeedbackShown = true;
                    readSeconds = 5 * 60;
                    if (timerEl) {
                        timerEl.textContent = '共同阅读剩余 05:00';
                    }
                }
                if (statusEl) {
                    statusEl.textContent = '来访者已提交反馈，请认真阅读。';
                }
            } catch (error) {
                loadingDiv.innerHTML = `<p style="color:#e74c3c;">拉取同辈反馈失败：${error.message}</p>`;
            }
        };

        if (timerEl) {
            timerEl.textContent = '等待来访者提交反馈...';
        }
        window.peerFeedbackCountdownTimer = setInterval(() => {
            if (hasFeedbackShown) {
                readSeconds -= 1;
                if (timerEl) {
                    const min = String(Math.floor(Math.max(readSeconds, 0) / 60)).padStart(2, '0');
                    const sec = String(Math.max(readSeconds, 0) % 60).padStart(2, '0');
                    timerEl.textContent = `共同阅读剩余 ${min}:${sec}`;
                }
                if (readSeconds <= 0) {
                    clearInterval(window.peerFeedbackCountdownTimer);
                    window.peerFeedbackCountdownTimer = null;
                    markReviewAndProceed();
                }
                return;
            }

            if (waitTimedOut) {
                return;
            }
            waitSeconds -= 1;
            if (waitSeconds <= 0) {
                waitTimedOut = true;
                if (timerEl) {
                    timerEl.textContent = '等待已超时';
                }
                if (statusEl) {
                    statusEl.textContent = '来访者尚未提交反馈，已到达等待上限，可先继续下一步。';
                }
                btnContainer.style.display = 'block';
            }
        }, 1000);

        await pollPeerFeedback();
        window.peerFeedbackPollingInterval = setInterval(pollPeerFeedback, 2000);
        return;
    }

    try {
        const feedback = await callPracticeFeedbackAPI(data, mode);
        document.getElementById('supFeedbackLoading').style.display = 'none';
        const resultDiv = document.getElementById('supFeedbackResult');
        const statusEl = document.getElementById('peerFeedbackStatusText');
        const timerEl = document.getElementById('peerFeedbackTimer');
        resultDiv.innerHTML = feedback
            .replace(/### (.*)/g, '<h4 style="color:#222; border-bottom:1px solid #ddd; padding-bottom:5px; margin-top:25px;">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#222; background:#f5f5f5; padding:0 4px; border-radius:3px;">$1</strong>')
            .replace(/维度(\d+)：/g, '<div style="display:inline-block; padding:2px 10px; background:#444; color:white; border-radius:4px; font-size:13px; margin-top:10px;">维度 $1</div>');
        resultDiv.style.display = 'block';
        document.getElementById('supFeedbackBtnContainer').style.display = 'block';
        if (statusEl) {
            statusEl.textContent = 'AI督导已提交反馈，请认真阅读。';
        }
        let readSeconds = 5 * 60;
        if (timerEl) {
            timerEl.textContent = '阅读剩余 05:00';
        }
        if (window.supervisorReadCountdownTimer) {
            clearInterval(window.supervisorReadCountdownTimer);
        }
        window.supervisorReadCountdownTimer = setInterval(() => {
            readSeconds -= 1;
            if (timerEl) {
                const min = String(Math.floor(Math.max(readSeconds, 0) / 60)).padStart(2, '0');
                const sec = String(Math.max(readSeconds, 0) % 60).padStart(2, '0');
                timerEl.textContent = `阅读剩余 ${min}:${sec}`;
            }
            if (readSeconds <= 0) {
                clearInterval(window.supervisorReadCountdownTimer);
                window.supervisorReadCountdownTimer = null;
                cleanupAndProceed();
            }
        }, 1000);
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

    const roleIntro = '你是一名资深的心理咨询督导，现在需要对一名“新手咨询师”的模拟练习表现进行专业点评。';

    const prompt = `${roleIntro}
    
    【练习背景】：咨询师正在与一名有自杀倾向的“虚拟来访者”进行初步接触和风险评估。
    【咨询师评估等级】：${data.level === 'high' ? '高风险' : data.level === 'medium' ? '中风险' : '低风险'}
    【咨询师给出的理由】：${data.reason}
    
    【对话历史记录】：
    ${chatLog}
    
    请根据哥伦比亚自杀严重程度评估标准（C-SSRS）和心理咨询原则进行点评：
    1. 维度评估：
       - 维度1：建立关系（共情是否到位、是否有效降低了阻抗）
       - 维度2：风险因素探索（是否捕捉到关键危机信号）
       - 维度3：保护性因素探索（是否讨论了支持系统或牵挂）
       - 维度4：综合建议（仅给出 1-2 条优先改进建议，不要拆分“做得好的地方/需要提升的地方”）
    2. 输出格式要求：
       - 维度1-3：每个维度仅包含“做得好的地方”“需要提升的地方”两项。
       - 维度4：只保留一个“综合建议”段落。
    
    要求：语气专业、严谨且具有指导意义。`;

    const response = await fetch(getAiProxyUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: API_CONFIG.AI_MODEL,
            messages: [
                {role: "system", content: "你是一名严谨的心理咨询督导专家。"},
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

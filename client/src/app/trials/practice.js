// Video, tutor, practice, and scripted simulation trials.
function createVideoPromptTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: '<h2>接下来进入课程学习阶段</h2><p>请认真观看下面的培训视频。</p>',
        choices: ['开始观看'],
        on_load: function() {
            updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.video);
            experimentData.timestamps.video_prompt = getCurrentTimestamp();
        }
    };
}

// experiment.js

function createVideoTrial() {
    // 默认隐藏继续按钮
    const continueButtonHTML = `
        <div style="text-align: center; margin-top: 20px;">
            <button class="jspsych-btn" id="finishVideoButton" onclick="finishVideo()" disabled>
                我已观看完视频
            </button>
            ${DEBUG_MODE ? 
                `<button class="jspsych-btn" id="skipVideoButton" onclick="finishVideo()" style="background-color: #f44336; margin-left: 10px;">
                    [DEBUG] 跳过视频
                </button>` : ''}
        </div>
    `;

    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="video-container">
                <video width="640" height="360" id="trainingVideo" autoplay
                        oncontextmenu="return false;" 
                        disablepictureinpicture>
                    <source src="${EXPERIMENT_CONFIG.TRAINING_VIDEO_PATH}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
            </div>
            ${continueButtonHTML}
        `,
        choices: [],
        on_load: function() {
            experimentData.timestamps.video_start = getCurrentTimestamp();
            
            const video = document.getElementById('trainingVideo');
            const finishButton = document.getElementById('finishVideoButton');
            if (DEBUG_MODE) {
                if (finishButton) finishButton.disabled = false;
            }
            const skipButton = document.getElementById('skipVideoButton');
            if (skipButton) {
                skipButton.disabled = false;
            }            
            // 确保跳过按钮在加载后立即可用 (DEBUG)
            skipButton.disabled = false;
            
            // 播放视频并禁用用户操作
            video.onloadeddata = function() {
                // 尝试播放（浏览器可能限制，但我们会继续设置监听器）
                video.play().catch(e => { console.warn("Autoplay blocked, user intervention may be required."); });
                
                // 禁用进度条拖动，这需要通过JS实现
                video.addEventListener('seeking', function() {
                    // 如果用户尝试拖动到未播放过的时间点，则强制回到当前已播放时间
                    if (video.currentTime > video.currentPlayTime + 5) { // 允许小范围跳转
                        video.currentTime = video.currentPlayTime;
                    }
                    video.currentPlayTime = video.currentTime;
                });
                video.currentPlayTime = 0; // 初始化已播放时间
            };

            // 监听视频播放结束事件
            video.onended = function() {
                finishButton.disabled = false; // 视频播放完毕后，启用正式继续按钮
                finishButton.textContent = '视频播放完毕，继续实验';
                // 播放结束，可以禁用 DEBUG 按钮
                skipButton.style.display = 'none'; 
            };
            
            // 确保视频从头开始
            video.currentTime = 0;
        }
    };
}

// experiment.js - 新增 AI Tutor 相关函数

function createAITutorTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            // 复用我们之前做好的漂亮聊天界面结构，但配色稍作调整以区分
            const styles = `
            <style>
                .tutor-window {
                    width: 850px; height: 700px; max-width: 95vw; max-height: 90vh;
                    background-color: #f0f7ff; /* 浅蓝色背景区分 */
                    margin: 0 auto; border-radius: 8px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                    display: flex; flex-direction: column; text-align: left;
                    font-family: "Microsoft YaHei", sans-serif; overflow: hidden;
                }
                .tutor-header {
                    height: 60px; background-color: #3498db; color: white;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 25px; font-size: 18px; font-weight: 600;
                }
                .timer-badge {
                    background: rgba(255,255,255,0.2); padding: 5px 12px;
                    border-radius: 20px; font-size: 14px; display: flex; align-items: center; gap: 5px;
                }
                /* 复用之前的聊天气泡样式，稍作调整 */
                .chat-messages { flex: 1; padding: 20px 30px; overflow-y: auto; background-color: #f9fbfd; display: flex; flex-direction: column; gap: 15px; }
                .message-row { display: flex; align-items: flex-start; max-width: 100%; }
                .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; margin-top: 2px; }
                .bubble { max-width: 70%; padding: 12px 16px; border-radius: 8px; font-size: 15px; line-height: 1.6; position: relative; word-wrap: break-word; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                
                /* Tutor 样式 */
                .message-row.ai .avatar { margin-right: 12px; background-color: #3498db; color: #fff; }
                .message-row.ai .bubble { background-color: #fff; color: #333; border: 1px solid #e1e4e8; border-top-left-radius: 0; }
                
                /* 学员样式 */
                .message-row.user { justify-content: flex-end; }
                .message-row.user .avatar { margin-left: 12px; background-color: #9b59b6; color: #fff; order: 2; }
                .message-row.user .bubble { background-color: #e8daef; color: #4a235a; border: 1px solid #d7bde2; order: 1; border-top-right-radius: 0; }

                .input-area { height: 80px; background: #fff; border-top: 1px solid #ddd; display: flex; padding: 15px; gap: 10px; align-items: center; }
                .tutor-input { flex: 1; height: 100%; border: 1px solid #ddd; border-radius: 4px; padding: 10px; resize: none; outline: none; font-family: inherit; }
                .tutor-input:focus { border-color: #3498db; }
                .send-btn { height: 100%; padding: 0 25px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
                .send-btn:hover { background: #2980b9; }

                .finish-bar {
                    background: #fff; border-top: 1px solid #eee; padding: 10px 20px;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .tip-text { color: #e74c3c; font-size: 0.9em; font-weight: bold; }
                .next-btn { 
                    padding: 8px 20px; background: #27ae60; color: white; border: none; 
                    border-radius: 4px; cursor: not-allowed; opacity: 0.6; transition: 0.2s; 
                }
                .next-btn.active { cursor: pointer; opacity: 1; }
                .next-btn.active:hover { background: #219150; }
            </style>

            <div class="tutor-window">
                <div class="tutor-header">
                    <span>🤖 AI 学习助手</span>
                    <div class="timer-badge">
                        <span>⏳</span> <span id="tutorTimer">05:00</span>
                    </div>
                </div>
                
                <div class="chat-messages" id="tutorMessages">
                    </div>

                <div class="input-area">
                    <textarea class="tutor-input" id="tutorInput" placeholder="请输入关于刚才培训内容的疑问（例如：如何判断高风险？）..." onkeypress="handleTutorKeyPress(event)"></textarea>
                    <button class="send-btn" onclick="sendTutorMessage()">提问</button>
                </div>

                <div class="finish-bar">
                    <span class="tip-text" id="questionRequirement">⚠️ 请至少提出 1 个问题才能继续</span>
                    <button class="next-btn" id="finishTutorBtn" onclick="finishTutorSession()" disabled>
                        我没有疑问了，进入练习 →
                    </button>
                </div>
            </div>
            `;
            return styles;
        },
        choices: [],
        on_load: function() {
            // 初始化
            experimentData.timestamps.tutor_start = getCurrentTimestamp();
            initializeTutorChat();
            startTutorTimer();
        },
        on_finish: function() {
            clearInterval(tutorCountdownInterval);
            experimentData.timestamps.tutor_end = getCurrentTimestamp();
            updateCustomProgress(20);
        }
    };
}

// 初始化 Tutor 聊天
function finishVideo() {
    experimentData.timestamps.video_end = getCurrentTimestamp();
    jsPsych.finishTrial();
}

// ===== 练习/观摩阶段 =====

function createPracticePromptTrial(sessionNum) {
    // 这里的数组索引需要注意：sessionNum 为 1 是练习一，为 3 是练习三
    const titles = { 1: "练习一", 3: "练习二" }; // 你可以自定义显示名称
    
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const title = titles[sessionNum] || "模拟练习";
            let actionText = experimentData.group === 'control' ? "选择" : "输入";

            // 修改这里：让练习一(1)和练习三(3)都显示这段指导语
            let goalDescription = "";
            if (sessionNum === 1 || sessionNum === 3) {
                goalDescription = `
                    <div style="margin-top: 20px; padding: 15px; background-color: #fff9db; border-radius: 6px; border: 1px solid #f1c40f; font-size: 0.95em; color: #444; line-height: 1.6;">
                        <strong style="color: #d35400; font-size: 1.1em;">🎯 本次练习目标：建立关系 + 风险评估</strong><br>
                        <ul style="margin-top: 10px; padding-left: 20px;">
                            <li>请注意：本阶段<strong>不涉及危机干预</strong>。</li>
                            <li><strong>结束方式：</strong>当您掌握足够信息进行风险评估后，请点击右上角的 <span style="color: #e91e63; font-weight: bold;">粉红色“结束练习”按钮</span>。</li>
                            <li><strong style="color: #c0392b;">⚠️ 关键提示：</strong>点击该按钮后将<strong>无法返回</strong>对话。</li>
                            <li><strong>限时提醒：</strong>对话限时 10 分钟，若未手动结束，系统将自动跳转。</li>
                        </ul>
                    </div>
                `;
            }

            return `
                <div style="max-width: 700px; margin: 0 auto; font-family: 'Microsoft YaHei', sans-serif;">
                    <h2 style="color: #333; margin-bottom: 30px;">${title}</h2>
                    <div style="background-color: #fff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); text-align: left; border: 1px solid #ebebeb; line-height: 1.8; color: #444;">
                        <p>🧑‍💼 <strong>角色设定：</strong>你是一名进行线上文字支持的朋辈咨询师。</p>
                        <p>📩 你收到了一条新信息，请仔细<strong>${actionText}</strong>你的回应。</p>
                        ${goalDescription}
                    </div>
                </div>`;
        },
        choices: ['开始'],
        button_html: '<button class="jspsych-btn" style="padding: 10px 35px; background-color: #07c160; color: white; border: none; border-radius: 4px;">%choice%</button>',
        on_load: function() {
            experimentData.timestamps[`practice_${sessionNum}_start`] = getCurrentTimestamp();
            
            // 进度条逻辑同步更新
            if (sessionNum === 3) {
                // 因为跳过了练习二，所以进入练习三（实际的第二个任务）时进度跳到 50%
                updateCustomProgress(50); 
            }
        }
    };
}

// ===== 练习/观摩阶段 (已修改：对照组运行脚本) =====
// experiment.js (在 createPracticeTrial(group) 附近)

// 修复后的 createPracticeTrial 函数
function createPracticeTrial() {
    
    // 创建两个不同的 Trial，在 timeline 中使用 conditional_function 来选择执行
    const experimentalTrial = {
        type: jsPsychHtmlButtonResponse, // 仅用于承载聊天界面的容器
        stimulus: function() {
            return createChatInterface();
        },
        choices: [],
        on_load: function() {
            initializeChat();
            experimentData.timestamps.practice_start = getCurrentTimestamp();
            startCountdown();
            showFinishButton();
        },
        on_finish: function() {
            experimentData.timestamps.practice_end = getCurrentTimestamp();
            hideCountdown();
            hideFinishButton();
        }
    };
    
    const controlTrial = {
        timeline: createScriptedSimulationTimeline(),
        on_load: function() {
            experimentData.timestamps.practice_start = getCurrentTimestamp();
            // 脚本式模拟中不需要倒计时和“完成”按钮
        },
        on_finish: function() {
            experimentData.timestamps.practice_end = getCurrentTimestamp();
        }
    };

    // 返回一个 Trial，该 Trial 根据全局分组决定是否运行
    return {
        // 使用一个 trial 来承载条件分支
        timeline: [experimentalTrial, controlTrial],
        // jsPsych 的 conditionality 是基于当前 trial 是否执行，
        // 我们通过将两个 trial 包装在一个 block 中，并使用 conditional_function 来控制流程。
        // 但最简单的方式是直接在 timeline 中使用 conditional_function。
    };
}


// 由于 jsPsych 的 timeline 是按顺序执行的，我们将使用 conditional_function 来实现逻辑分支。

function createPracticeTimeline(promptKey, startNodeId) {
    // --- 1. 实验组分支：自由 AI 对话 ---
    const experimentalTrial = {
        timeline: [{
            type: jsPsychHtmlButtonResponse,
            stimulus: createChatInterface,
            choices: [],
            on_load: function() {
                experimentData.chatMode = 'ai';
                initializeChat(promptKey); // 使用 AI 角色
                experimentData.timestamps[promptKey + '_start'] = getCurrentTimestamp();
                startCountdown();   // 启动倒计时
                showFinishButton(); // 显示玫粉色按钮
            },
            on_finish: function() {
                hideCountdownAndButton();
                if (window.countdownTimer) {
                    clearInterval(window.countdownTimer);
                    window.countdownTimer = null;
                }
                hideCountdown();
                hideFinishButton();
                if (experimentData.chatHistory.length > 0) {
                    experimentData.allPracticeChats[promptKey] = JSON.parse(JSON.stringify(experimentData.chatHistory));
                }
            }
        }],
        conditional_function: function() { return experimentData.group === 'experimental'; }
    };

    // --- 2. 对照组分支：真人配对聊天室（复用相同 UI） ---
    const controlTrial = {
        timeline: [{
            type: jsPsychHtmlButtonResponse,
            stimulus: createChatInterface,
            choices: [],
            on_load: function() {
                experimentData.timestamps[promptKey + '_start'] = getCurrentTimestamp();

                initializePairedChat(promptKey)
                    .then(() => {
                        startCountdown();
                        showFinishButton();
                    })
                    .catch(error => {
                        console.error('[PAIRED_CHAT] 初始化失败:', error);
                        alert(`对照组配对失败：${error.message}`);
                        jsPsych.finishTrial();
                    });
            },
            on_finish: function() {
                if (experimentData.chatHistory.length > 0) {
                    experimentData.allPracticeChats[promptKey] = JSON.parse(JSON.stringify(experimentData.chatHistory));
                }
                hideCountdown();
                hideFinishButton();
            }
        }],
        conditional_function: function() {
            return experimentData.group === 'control';
        }
    };
    return [experimentalTrial, controlTrial];
}
// ===== 聊天界面（实验组） =====

function createPDFViewer() {
    return `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3>观摩学习材料</h3>
            <p>请仔细阅读以下PDF内容，您可以使用鼠标滚轮上下滚动查看。</p>
        </div>
        <iframe src="${EXPERIMENT_CONFIG.PDF_PATH}" class="pdf-viewer" id="pdfViewer"></iframe>
    `;
}

// ===== 倒计时功能 =====
// experiment.js

// 1. 启动倒计时（同时开启粉色按钮）
function startCountdown() {
    // 关键：先辞退之前所有的报时员，防止时间跑快
    if (window.countdownTimer) {
        clearInterval(window.countdownTimer);
        window.countdownTimer = null;
    }

    // 重置时间
    countdownTimeLeft = EXPERIMENT_CONFIG.COUNTDOWN_TIME;
    
    // 显示粉色按钮
    const finishBtn = document.getElementById('finishButton');
    if (finishBtn) {
        const canShowFinish = !(experimentData.chatMode === 'paired' && experimentData.controlPairing && !experimentData.controlPairing.isCounselor);
        finishBtn.style.display = canShowFinish ? 'block' : 'none';
    }

    // 启动新的报时员
    updateCountdownDisplay();
    window.countdownTimer = setInterval(() => {
        countdownTimeLeft -= 1000;
        
        // 如果找不到显示数字的地方了，就说明换页了，自动停止
        const display = document.getElementById('headerTimeDisplay');
        if (!display) {
            clearInterval(window.countdownTimer);
            return;
        }

        updateCountdownDisplay();
        
        if (countdownTimeLeft <= 0) {
            clearInterval(window.countdownTimer);
            finishStage(); 
        }
    }, 1000);
}

// 2. 彻底隐藏倒计时和粉色按钮
function hideCountdownAndButton() {
    // 辞退报时员
    if (window.countdownTimer) {
        clearInterval(window.countdownTimer);
        window.countdownTimer = null;
    }
    
    // 让倒计时气泡变透明
    const headerBadge = document.querySelector('.header-timer-badge');
    if (headerBadge) headerBadge.style.display = 'none';

    // 让粉色按钮变透明
    const finishBtn = document.getElementById('finishButton');
    if (finishBtn) finishBtn.style.display = 'none';
}
function updateCountdownDisplay() {
    const minutes = Math.floor(countdownTimeLeft / 60000);
    const seconds = Math.floor((countdownTimeLeft % 60000) / 1000);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const headerDisplay = document.getElementById('headerTimeDisplay');
    if (headerDisplay) { // 增加安全检查
        headerDisplay.textContent = timeString;
        if (minutes < 1) {
            headerDisplay.style.color = '#e74c3c';
            headerDisplay.style.fontWeight = 'bold';
        }
    }

    const oldDisplay = document.getElementById('timeLeft');
    if (oldDisplay) { // 增加安全检查
        oldDisplay.textContent = timeString;
    }
}

function hideCountdown() {
    // 1. 停止计时器
    if (countdownTimer) clearInterval(countdownTimer);
    
    // 2. 尝试寻找旧版倒计时容器
    const oldCountdown = document.getElementById('countdown');
    if (oldCountdown) {
        oldCountdown.style.display = 'none';
    }

    // 3. 尝试寻找新版标题栏倒计时容器
    const headerDisplay = document.getElementById('headerTimeDisplay');
    if (headerDisplay) {
        // 找到它父级那个带背景的“气泡”并隐藏
        const badge = headerDisplay.closest('.header-timer-badge');
        if (badge) {
            badge.style.display = 'none';
        } else {
            headerDisplay.style.display = 'none';
        }
    }
}

function showFinishButton() {
    const btn = document.getElementById('finishButton');
    if (experimentData.chatMode === 'paired' && experimentData.controlPairing && !experimentData.controlPairing.isCounselor) {
        if (btn) btn.style.display = 'none';
        return;
    }
    if (btn) {
        btn.style.display = 'block';
    } else {
        // 如果找不到按钮，尝试在 500ms 后重新查找一次
        setTimeout(() => {
            const retryBtn = document.getElementById('finishButton');
            if (retryBtn) retryBtn.style.display = 'block';
        }, 500);
    }
}

function hideFinishButton() {
    const btn = document.getElementById('finishButton');
    if (btn) btn.style.display = 'none';
}

function finishStage() {
    console.log("正在结束当前阶段...");

    if (experimentData.chatMode === 'paired') {
        if (experimentData.controlPairing && experimentData.controlPairing.isCounselor) {
            const confirmed = window.confirm('确认结束本轮咨询吗？结束后来访者将同步进入反馈填写。');
            if (!confirmed) {
                return;
            }
            showCounselorRecordModal();
            return;
        }
        alert('当前由咨询师结束本轮，请等待对方提交。');
        return;
    }

    if (document.getElementById('chatMessages')) {
        showCrisisAssessmentModal(); // 调用新写的弹窗函数
    } else {
        // 非练习阶段直接结束
        proceedToNextStage();
    }
}

// 提取原有的结束逻辑为独立函数
function proceedToNextStage() {
    if (typeof stopPairedChatPolling === 'function') {
        stopPairedChatPolling();
    }
    if (window.countdownTimer) {
        clearInterval(window.countdownTimer);
        window.countdownTimer = null;
    }
    hideCountdown();
    hideFinishButton();
    jsPsych.finishTrial();
}

// ===== 后测问卷 =====
function createPosttestQuestionnaire() {
    return createQuestionnaireTrial('posttest', QUESTIONNAIRES.posttest);
}

// ===== 二次练习提示 =====
function createSecondPracticePromptTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: '<h2>接下来再次进入练习阶段</h2><p>请继续与AI虚拟来访者进行对话练习。</p>',
        choices: ['开始'],
        on_load: function() {
            updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.practice2);
            experimentData.timestamps.second_practice_prompt = getCurrentTimestamp();
        }
    };
}

// ===== 第二次练习 =====
// experiment.js

function createSecondPracticeTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            return createChatInterface(); // 调用统一的聊天界面模板
        },
        choices: [],
        on_load: function() {
            // 1. 记录时间戳
            experimentData.timestamps.second_practice_start = getCurrentTimestamp();
            // 关键：第三轮统一走 AI 对话，不再沿用配对聊天状态
            experimentData.chatMode = 'ai';
            if (typeof stopPairedChatPolling === 'function') {
                stopPairedChatPolling();
            }
            
            // 2. 初始化 AI 角色 (对照组和实验组统一使用 SECOND_CLIENT)
            initializeChat('SECOND_CLIENT'); 
            
            // 3. 【核心修复】显式启动 UI 元素
            if (typeof startCountdown === 'function') {
                startCountdown(); // 启动 10 分钟倒计时
            }
            if (typeof showFinishButton === 'function') {
                showFinishButton(); // 显示玫粉色结束按钮
            }
        },
        on_finish: function() {
            // 4. 清理 UI 状态
            hideCountdownAndButton();
            if (window.countdownTimer) {
                clearInterval(window.countdownTimer);
                window.countdownTimer = null;
            }
            hideCountdown();
            hideFinishButton();
            
            // 5. 存储对话记录
            experimentData.allPracticeChats['practice_2_retry'] = JSON.parse(JSON.stringify(experimentData.chatHistory));
        }
    };
}



// ===== 危机等级评估 =====
function createScriptedSimulationTimeline(startNodeId) {
    // 作用域变量，用于在 choices 和 on_finish 之间传递当前节点的选项数据
    let lastNodeOptions = [];

    const scriptedTimeline = {
        timeline: [{
            type: jsPsychHtmlButtonResponse,
            on_start: function(trial) {
                // 1. 确保第一次进入时，将 ID 初始化为传入的 startNodeId (如 'LU_START')
                if (!currentSimulationNodeId) {
                    currentSimulationNodeId = startNodeId;
                }
                // 记录当前节点ID到数据中，便于调试
                trial.data = { node_id: currentSimulationNodeId };
            },
            stimulus: function () {
                // 获取当前节点配置
                const currentNode = SCRIPTED_SIMULATION_NODES[currentSimulationNodeId];
                
                // 错误处理
                if (!currentNode) {
                    return `<div style="color:red; padding:20px;">Error: Node [${currentSimulationNodeId}] not found in config.</div>`;
                }

                let html = `<h2>${currentNode.title || '模拟练习'}</h2>`;

                // --- 渲染逻辑分支 ---
                
                // 情况 A: 开始或结束节点 (通常只有文本，没有来访者反馈框)
                // 判断依据：ID包含 START 或 END，或者没有 ai_feedback 且有 text
                if ((currentNode.id && (currentNode.id.includes('START') || currentNode.id.includes('END'))) || currentNode.text) {
                     html += `<div style="margin: 20px 0; font-size: 1.1em; line-height: 1.6;">${currentNode.text || ''}</div>`;
                } 
                // 情况 B: 对话交互节点
                else {
                    // 获取显示的来访者内容：
                    // 优先显示 previousAiFeedback (上一轮选择导致的后果)，
                    // 如果为空，则显示当前节点的默认 ai_feedback
                    const feedbackText = previousAiFeedback || currentNode.ai_feedback || '(无内容)';

                    // 渲染来访者气泡
                    html += `
                        <div style="margin: 20px 0; padding: 20px; background-color: #f0f4f8; border-left: 5px solid #4682B4; border-radius: 4px; text-align: left;">
                            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 8px;">来访者：</div>
                            <div style="font-size: 1.1em; line-height: 1.5; color: #34495e;">${feedbackText}</div>
                        </div>
                    `;
                    
                    html += `<p style="margin-top: 25px; font-weight: bold; color: #555;">请选择您的回应：</p>`;
                }
                
                return html;
            },
            choices: function () {
                const currentNode = SCRIPTED_SIMULATION_NODES[currentSimulationNodeId];
                if (!currentNode) return ['退出 (配置错误)'];
                
                // 获取选项列表 (兼容 options 对象数组 和 choices 字符串数组)
                lastNodeOptions = currentNode.options || currentNode.choices || ['继续'];
                
                // jsPsych 需要字符串数组作为按钮标签
                return lastNodeOptions.map(opt => {
                    // 如果是对象则取 .text，如果是字符串直接返回
                    return typeof opt === 'object' ? opt.text : opt;
                });
            },
            // 自定义按钮样式：让长文本选项左对齐，更像对话列表
            button_html: `<button class="jspsych-btn" style="display:block; width:100%; margin-bottom:10px; text-align:left; padding:10px;">%choice%</button>`,
            on_finish: function (data) {
                const currentNode = SCRIPTED_SIMULATION_NODES[currentSimulationNodeId];
                
                // 获取用户选了第几个按钮
                const responseIndex = data.response;
                const selectedOption = lastNodeOptions[responseIndex];
                
                // --- 1. 数据记录 ---
                if (!experimentData.responses.scripted_simulation) {
                    experimentData.responses.scripted_simulation = [];
                }

                // 只有当这是一个有效的交互节点时才记录 (START节点可选记录，这里记录所有)
                experimentData.responses.scripted_simulation.push({
                    timestamp: getCurrentTimestamp(),
                    node_id: currentSimulationNodeId,
                    user_choice_index: responseIndex,
                    // 记录选项文本
                    user_choice_text: typeof selectedOption === 'object' ? selectedOption.text : selectedOption,
                    // 记录结果类型 (success/error等)
                    outcome_type: typeof selectedOption === 'object' ? selectedOption.type : 'navigation',
                    // 记录该选项导致的AI反馈
                    ai_response: typeof selectedOption === 'object' ? selectedOption.response : null
                });

                // --- 2. 状态更新 (为下一屏做准备) ---
                
                // 更新下一次显示的来访者反馈
                if (typeof selectedOption === 'object' && selectedOption.response) {
                    previousAiFeedback = selectedOption.response;
                } else {
                    // 如果没有特定response (比如简单的页面跳转)，清空 previousAiFeedback，
                    // 这样下一页就会显示它自己的 ai_feedback 默认值
                    previousAiFeedback = '';
                }

                // 计算下一个节点 ID
                let nextId = null;
                if (typeof selectedOption === 'object' && selectedOption.next) {
                    nextId = selectedOption.next;
                } else if (currentNode.next) {
                    // 如果选项里没写 next，但节点本身有 next (用于 START/END 这种简单节点)
                    nextId = currentNode.next;
                }

                // 更新全局指针
                currentSimulationNodeId = nextId;
            }
        }],
        // 循环控制函数
        loop_function: function () {
            // 只要 currentSimulationNodeId 不为空，且在配置表中存在，就继续循环
            if (currentSimulationNodeId && SCRIPTED_SIMULATION_NODES[currentSimulationNodeId]) {
                return true;
            }
            // 否则结束当前 timeline (例如 next 为 null 或 undefined 时)
            return false;
        }
    };

    return [scriptedTimeline];
}

function showCrisisAssessmentModal() {
    // 注入弹窗 CSS
    const modalStyle = `
    <div id="crisisModal" style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Microsoft YaHei', sans-serif;">
        <div style="
            background: white; padding: 30px; border-radius: 12px;
            width: 500px; max-width: 90%; box-shadow: 0 5px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2c3e50;">请完成危机等级评估</h3>
            <p style="color:#666; font-size:14px;">基于您与来访者的对话，请评估其危机等级：</p>
            
            <div style="display:flex; justify-content:space-around; margin: 20px 0; background:#f8f9fa; padding:15px; border-radius:8px;">
                <label style="cursor:pointer;"><input type="radio" name="modal_crisis_level" value="high"> 🔴 高风险</label>
                <label style="cursor:pointer;"><input type="radio" name="modal_crisis_level" value="medium"> 🟡 中风险</label>
                <label style="cursor:pointer;"><input type="radio" name="modal_crisis_level" value="low"> 🟢 低风险</label>
            </div>
            
            <p style="color:#666; font-size:14px;">请给出您的评级理由：</p>
            <textarea id="modal_crisis_reason" 
                placeholder="请输入评估理由...（建议从C-SSRS结构化评估、风险因素、保护性因素的角度进行分析）" 
                style="width:100%; height:120px; padding:10px; border:1px solid #ddd; border-radius:4px; resize:none; font-family:inherit;"></textarea>
            
            <div style="text-align: center; margin-top: 20px;">
                <button class="jspsych-btn" id="submitAssessmentBtn" 
                    style="padding: 10px 40px; background:#e91e63; color:white; border:none; border-radius:4px; cursor:pointer;"
                    onclick="handleModalAssessmentSubmit()">提交评估并继续</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalStyle);
}

function handleModalAssessmentSubmit() {
    const levelEl = document.querySelector('input[name="modal_crisis_level"]:checked');
    const reasonEl = document.getElementById('modal_crisis_reason');
    
    if (!levelEl || !reasonEl.value.trim()) {
        alert('请完成所有评估项目');
        return;
    }

    // 1. 保存当前练习的评估数据
    if (!experimentData.responses.practice_assessments) {
        experimentData.responses.practice_assessments = [];
    }
    const currentAssessment = {
        timestamp: getCurrentTimestamp(),
        level: levelEl.value,
        reason: reasonEl.value,
        chatHistory: JSON.parse(JSON.stringify(experimentData.chatHistory)) 
    };
    experimentData.responses.practice_assessments.push(currentAssessment);

    // 2. 移除评估弹窗
    document.getElementById('crisisModal').remove();

    // 3. 【核心修复】：根据已完成的评估次数来判断当前是哪一个 Profile
    // 第一次提交评估后数组长度为 1 -> 对应 P1 (小B)
    // 第二次提交评估后数组长度为 2 -> 对应 P2 (小吴)
    // 第三次提交评估后数组长度为 3 -> 对应 P3 (小C)
    let practiceCount = experimentData.responses.practice_assessments.length;
    let practiceType = 'P1'; 

    if (practiceCount === 2) {
        practiceType = 'P2'; // 第二次练习，对应小吴 (高风险)
    } else if (practiceCount === 3) {
        practiceType = 'P3'; // 第三次练习，对应小C (中高风险)
    }

    // 传递评估数据和修正后的练习类型
    showSupervisorFeedbackUI(currentAssessment, practiceType);
}

function showCounselorRecordModal() {
    const html = `
    <div id="counselorRecordModal" style="
        position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:10002;
        display:flex; align-items:center; justify-content:center; font-family:'Microsoft YaHei',sans-serif;">
        <div style="width:700px; max-width:92vw; background:#fff; border-radius:12px; padding:24px;">
            <h3 style="margin:0 0 12px 0; color:#2c3e50;">咨询记录</h3>
            <p style="margin:0 0 14px 0; color:#666;">请填写本轮评估结论与关键依据。</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                    <label>风险等级</label>
                    <select id="recordRiskLevel" style="width:100%; margin-top:6px; padding:8px;">
                        <option value="">请选择</option>
                        <option value="high">高风险</option>
                        <option value="medium">中风险</option>
                        <option value="low">低风险</option>
                    </select>
                </div>
                <div>
                    <label>是否有明确计划</label>
                    <select id="recordPlan" style="width:100%; margin-top:6px; padding:8px;">
                        <option value="">请选择</option>
                        <option value="yes">是</option>
                        <option value="no">否</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:12px;">
                <label>评估摘要</label>
                <textarea id="recordSummary" style="width:100%; height:110px; margin-top:6px; padding:8px;" placeholder="请填写主要风险因素、保护因素、后续建议..."></textarea>
            </div>
            <div style="text-align:right; margin-top:16px;">
                <button class="jspsych-btn" style="background:#e91e63; color:#fff; border:none;" onclick="submitCounselorRecord()">提交并结束本轮</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function submitCounselorRecord() {
    const riskLevel = document.getElementById('recordRiskLevel').value;
    const hasPlan = document.getElementById('recordPlan').value;
    const summary = document.getElementById('recordSummary').value.trim();
    if (!riskLevel || !hasPlan || !summary) {
        alert('请完整填写咨询记录。');
        return;
    }

    if (!experimentData.responses.counselor_records) {
        experimentData.responses.counselor_records = [];
    }

    const confirmed = window.confirm('确认提交咨询记录并结束本轮吗？提交后将无法继续本轮对话。');
    if (!confirmed) {
        return;
    }

    experimentData.responses.counselor_records.push({
        timestamp: getCurrentTimestamp(),
        room_id: experimentData.controlPairing.roomId,
        round_no: experimentData.controlPairing.activeRoundNo || 1,
        risk_level: riskLevel,
        has_plan: hasPlan,
        summary,
        chat_history: JSON.parse(JSON.stringify(experimentData.chatHistory))
    });

    let roundBeforeEnd = experimentData.controlPairing.activeRoundNo || 1;
    try {
        await endPairedRoundByCounselor();
    } catch (error) {
        alert(`结束失败：${error.message}`);
        return;
    }

    const modal = document.getElementById('counselorRecordModal');
    if (modal) modal.remove();

    const practiceType = roundBeforeEnd === 1 ? 'P1' : 'P2';
    const feedbackPayload = {
        level: riskLevel,
        reason: summary,
        chatHistory: JSON.parse(JSON.stringify(experimentData.chatHistory))
    };
    showSupervisorFeedbackUI(feedbackPayload, practiceType, { mode: 'peer' });
}

function showClientFeedbackModal() {
    if (document.getElementById('clientFeedbackModal')) return;
    stopPairedChatPolling();
    hideFinishButton();

    const recordsHtml = experimentData.chatHistory
        .map(item => {
            const senderLabel = item.sender === 'user' ? '我' : '咨询师';
            const bubbleColor = item.sender === 'user' ? '#95ec69' : '#fff';
            const align = item.sender === 'user' ? 'flex-end' : 'flex-start';
            return `<div style="display:flex; justify-content:${align}; margin-bottom:8px;">
                <div style="max-width:85%; background:${bubbleColor}; border:1px solid #eaeaea; border-radius:8px; padding:8px 10px;">
                    <div style="font-size:12px; color:#777; margin-bottom:4px;">${senderLabel}</div>
                    <div style="font-size:13px; line-height:1.6;">${item.content}</div>
                </div>
            </div>`;
        })
        .join('');

    const html = `
    <div id="clientFeedbackModal" style="position:fixed; inset:0; z-index:10003; background:#f4f6f8; padding:18px; overflow:auto; font-family:'Microsoft YaHei',sans-serif;">
        <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px; max-width:1200px; margin:0 auto;">
            <section style="background:#fff; border-radius:12px; padding:14px; border:1px solid #e8ecf0;">
                <h3 style="margin-top:0;">与咨询师聊天记录</h3>
                <div style="height:72vh; overflow:auto; padding-right:4px;">${recordsHtml}</div>
            </section>
            <section style="background:#fff; border-radius:12px; padding:14px; border:1px solid #e8ecf0;">
                <h3 style="margin-top:0;">来访者反馈表</h3>
                <label>你感到被理解的程度（1-5）</label>
                <input id="clientFbEmpathy" type="number" min="1" max="5" style="width:100%; padding:8px; margin:6px 0 12px 0;">
                <label>你是否愿意继续与该咨询师沟通</label>
                <select id="clientFbContinue" style="width:100%; padding:8px; margin:6px 0 12px 0;">
                    <option value="">请选择</option>
                    <option value="yes">愿意</option>
                    <option value="unsure">不确定</option>
                    <option value="no">不愿意</option>
                </select>
                <label>补充反馈</label>
                <textarea id="clientFbNotes" style="width:100%; height:180px; margin-top:6px; padding:8px;" placeholder="请描述你在本轮咨询中的主观体验"></textarea>
                <div style="text-align:right; margin-top:14px;">
                    <button class="jspsych-btn" style="background:#27ae60; color:white; border:none;" onclick="submitClientFeedback()">提交反馈</button>
                </div>
            </section>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function submitClientFeedback() {
    const empathy = document.getElementById('clientFbEmpathy').value;
    const cont = document.getElementById('clientFbContinue').value;
    const notes = document.getElementById('clientFbNotes').value.trim();
    if (!empathy || !cont || !notes) {
        alert('请完整填写反馈表。');
        return;
    }

    if (!experimentData.responses.client_feedbacks) {
        experimentData.responses.client_feedbacks = [];
    }
    experimentData.responses.client_feedbacks.push({
        timestamp: getCurrentTimestamp(),
        room_id: experimentData.controlPairing.roomId,
        round_no: experimentData.controlPairing.activeRoundNo || 1,
        empathy_score: Number(empathy),
        continue_intent: cont,
        notes,
        chat_history: JSON.parse(JSON.stringify(experimentData.chatHistory))
    });

    const modal = document.getElementById('clientFeedbackModal');
    if (modal) modal.remove();
    proceedToNextStage();
}

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
                <div style="position: relative; width: min(1100px, 94vw); margin: 0 auto; background: #000; border-radius: 12px; overflow: hidden;">
                    <video id="trainingVideo" style="display:block; width:100%; height:auto; max-height:72vh; background:#000; object-fit:contain;"
                            oncontextmenu="return false;" 
                            disablepictureinpicture>
                        <source src="${EXPERIMENT_CONFIG.TRAINING_VIDEO_PATH}" type="video/mp4">
                        您的浏览器不支持视频播放。
                    </video>
                    <button id="videoStartOverlay" type="button" style="
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        padding: 12px 22px;
                        border: none;
                        border-radius: 999px;
                        background: rgba(0, 0, 0, 0.68);
                        color: #fff;
                        font-size: 16px;
                        cursor: pointer;
                    ">点击开始播放</button>
                </div>
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
            if (skipButton) {
                skipButton.disabled = false;
            }

            const startOverlay = document.getElementById('videoStartOverlay');
            const startPlayback = () => {
                video.play().then(() => {
                    if (startOverlay) {
                        startOverlay.style.display = 'none';
                    }
                }).catch(e => {
                    console.warn("Video play blocked:", e);
                });
            };
            if (startOverlay) {
                startOverlay.onclick = startPlayback;
            }
            
            // 播放视频并禁用用户操作
            video.onloadeddata = function() {
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
                if (skipButton) {
                    skipButton.style.display = 'none';
                }
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

function createPracticePromptTrial(sessionNum, customTitle = '') {
    // 这里的数组索引需要注意：sessionNum 为 1 是练习一，为 3 是练习三
    const titles = { 1: "练习一", 3: "练习二", 4: "练习3" }; // 你可以自定义显示名称
    
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const title = customTitle || titles[sessionNum] || "模拟练习";
            // 修改这里：让练习一(1)和练习三(3)都显示这段指导语
            let goalDescription = "";
            if (sessionNum === 1 || sessionNum === 3 || sessionNum === 4) {
                goalDescription = `
                    <div style="margin-top: 20px; padding: 15px; background-color: #fff9db; border-radius: 6px; border: 1px solid #f1c40f; font-size: 0.95em; color: #444; line-height: 1.6;">
                        <strong style="color: #d35400; font-size: 1.1em;">🎯 本次练习目标：建立关系 + 风险评估</strong><br>
                        <ul style="margin-top: 10px; padding-left: 20px;">
                            <li>你将进入一段实时文字会话，请根据界面中的角色提示完成互动。</li>
                            <li>请使用自然、连贯的对话风格。</li>
                            <li><strong>限时提醒：</strong>对话限时 10 分钟；结束规则以会话内提示为准。</li>
                        </ul>
                    </div>
                `;
            }

            return `
                <div style="max-width: 700px; margin: 0 auto; font-family: 'Microsoft YaHei', sans-serif;">
                    <h2 style="color: #333; margin-bottom: 30px;">${title}</h2>
                    <div style="background-color: #fff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); text-align: left; border: 1px solid #ebebeb; line-height: 1.8; color: #444;">
                        <p>📩 你即将进入本轮练习，请先阅读以下提示。</p>
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
function getPracticeRoundNo(promptKey) {
    if (promptKey === 'PRACTICE_3') return 2;
    if (promptKey === 'SECOND_CLIENT') return 3;
    return 1;
}

function createConnectionBriefCard() {
    return `
        <div style="max-width: 760px; margin: 0 auto; font-family: 'Microsoft YaHei', sans-serif;">
            <h2 style="color: #333; margin-bottom: 24px;">会话准备中</h2>
            <div style="background-color: #fff; padding: 28px 24px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); text-align: left; border: 1px solid #ebebeb; line-height: 1.8; color: #444;">
                <div id="connectionLoadingBlock">
                    <p style="margin: 0;"><strong>正在连接……，请稍候...</strong></p>
                </div>
                <div id="connectionSuccessBlock" style="display:none; margin-top: 14px;"></div>
            </div>
            <div style="text-align: center; margin-top: 24px;">
                <button class="jspsych-btn" id="connectionContinueBtn" disabled style="padding: 10px 35px; background-color: #bdbdbd; color: #fff; border: none; border-radius: 4px; cursor: not-allowed;">
                    请稍候...
                </button>
            </div>
        </div>
    `;
}

function getCounselorInstructionHTML(roundNo, counterpartLine) {
    return `
        <p style="margin: 0;"><strong>连接成功！</strong></p>
        <p style="margin: 6px 0 0 0;">当前轮次：第 ${roundNo} 轮</p>
        <p style="margin: 2px 0 0 0;">会话背景：你当前进入的是「安心对话」线上匿名心理支持平台。</p>
        <p style="margin: 2px 0 0 0;">你的角色：咨询师</p>
        <p style="margin: 2px 0 0 0;">${counterpartLine}</p>
        <p style="margin: 2px 0 0 0;">本轮任务：扮演咨询师，和来访者进行角色扮演，练习建立关系 + 风险评估技能，并在对话结束后填写风险评估表</p>
        <ul style="margin-top: 10px; padding-left: 20px;">
            <li>请注意：本阶段不涉及危机干预。</li>
            <li><strong>结束方式：</strong>当您掌握足够信息进行风险评估后，请点击右侧的 <span style="color: #e91e63; font-weight: bold;">粉红色“我已完成风险评估，结束此阶段”按钮</span>。</li>
            <li><strong style="color: #c0392b;">⚠️ 关键提示：</strong>点击该按钮后将<strong>无法返回</strong>对话。</li>
            <li><strong>限时提醒：</strong>对话限时 10 分钟，若未手动结束，系统将自动跳转。</li>
        </ul>
    `;
}

function createExperimentalConnectionBriefTrial(promptKey) {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: createConnectionBriefCard,
        choices: [],
        on_load: async function() {
            const continueBtn = document.getElementById('connectionContinueBtn');
            const successBlock = document.getElementById('connectionSuccessBlock');
            const roundNo = getPracticeRoundNo(promptKey);

            continueBtn.onclick = function() {
                jsPsych.finishTrial();
            };

            await new Promise(resolve => setTimeout(resolve, 700));
            successBlock.innerHTML = getCounselorInstructionHTML(roundNo, '来访者：由AI扮演');
            successBlock.style.display = 'block';

            continueBtn.disabled = false;
            continueBtn.textContent = '开始会话';
            continueBtn.style.backgroundColor = '#07c160';
            continueBtn.style.cursor = 'pointer';
        }
    };
}

function createControlConnectionBriefTrial(promptKey) {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: createConnectionBriefCard,
        choices: [],
        on_load: async function() {
            const loadingBlock = document.getElementById('connectionLoadingBlock');
            const continueBtn = document.getElementById('connectionContinueBtn');
            const successBlock = document.getElementById('connectionSuccessBlock');
            const waitTimeoutMs = EXPERIMENT_CONFIG.MATCH_TIMEOUT_MS || 300000;
            let waitDeadlineMs = Date.now() + waitTimeoutMs;
            let waitTimer = null;

            const formatRemain = (remainMs) => {
                const totalSeconds = Math.max(0, Math.ceil(remainMs / 1000));
                const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
                const seconds = String(totalSeconds % 60).padStart(2, '0');
                return `${minutes}:${seconds}`;
            };

            const renderLoadingBlock = (text) => {
                loadingBlock.innerHTML = `
                    <p style="margin: 0;"><strong>${text}</strong></p>
                    <p style="margin: 8px 0 0 0; color: #d35400;">
                        当前等待倒计时：<strong id="connectionWaitTimer">${formatRemain(waitDeadlineMs - Date.now())}</strong>
                    </p>
                `;
            };

            const startWaitTimer = () => {
                if (waitTimer) {
                    clearInterval(waitTimer);
                    waitTimer = null;
                }
                const tick = () => {
                    const node = document.getElementById('connectionWaitTimer');
                    if (!node) return;
                    node.textContent = formatRemain(waitDeadlineMs - Date.now());
                };
                tick();
                waitTimer = setInterval(tick, 1000);
            };

            const stopWaitTimer = () => {
                if (waitTimer) {
                    clearInterval(waitTimer);
                    waitTimer = null;
                }
            };

            renderLoadingBlock('正在为您进行配对……，请稍候...');
            startWaitTimer();
            if (continueBtn) {
                continueBtn.style.display = 'none';
            }

            const beginSyncedEnterCountdown = (syncResult) => {
                const countdownNode = document.getElementById('syncedEnterCountdown');
                if (!countdownNode) {
                    jsPsych.finishTrial();
                    return;
                }

                const startAtMs = Date.parse(syncResult.start_at);
                const serverNowMs = Date.parse(syncResult.server_now);
                const clientNowMs = Date.now();
                const clockOffsetMs = serverNowMs - clientNowMs;
                let timer = null;

                const tick = () => {
                    const nowMs = Date.now() + clockOffsetMs;
                    const remainMs = Math.max(0, startAtMs - nowMs);
                    const remainSeconds = Math.ceil(remainMs / 1000);
                    countdownNode.textContent = `倒计时 ${remainSeconds} 秒，结束后将自动进入对话...`;
                    if (remainMs <= 0) {
                        if (timer) {
                            clearInterval(timer);
                        }
                        jsPsych.finishTrial();
                    }
                };

                tick();
                timer = setInterval(tick, 200);
            };

            const connectAndRender = async () => {
                successBlock.style.display = 'none';
                if (experimentData.controlPairing) {
                    experimentData.controlPairing.timeoutFallback = false;
                    experimentData.controlPairing.timeoutFallbackPromptKey = '';
                    experimentData.controlPairing.currentRouteMode = 'paired';
                }
                waitDeadlineMs = Date.now() + waitTimeoutMs;
                renderLoadingBlock('正在为您进行配对……，请稍候...');
                startWaitTimer();
                if (continueBtn) {
                    continueBtn.style.display = 'none';
                }

                try {
                    const pairing = await preparePairedChatSession(promptKey);
                    if (pairing && pairing.fallbackToExperimental) {
                        stopWaitTimer();
                        if (experimentData.controlPairing) {
                            experimentData.controlPairing.currentRouteMode = 'ai';
                        }
                        const waitedSeconds = Math.floor((pairing.waitedMs || 300000) / 1000);
                        successBlock.innerHTML = `
                            <p style="margin: 0;"><strong>连接等待超时，系统将继续下一阶段。</strong></p>
                            <p style="margin: 6px 0 0 0;">等待时长：约 ${waitedSeconds} 秒</p>
                            <p style="margin: 2px 0 0 0;">请点击下方按钮继续实验。</p>
                        `;
                        successBlock.style.display = 'block';
                        if (continueBtn) {
                            continueBtn.style.display = 'inline-block';
                            continueBtn.disabled = false;
                            continueBtn.textContent = '继续实验';
                            continueBtn.style.backgroundColor = '#07c160';
                            continueBtn.style.cursor = 'pointer';
                            continueBtn.onclick = function() {
                                jsPsych.finishTrial();
                            };
                        }
                        return;
                    }
                    const { roundNo, isCounselor } = pairing;
                    // 已配对成功后，不再展示“等待配对倒计时”
                    loadingBlock.innerHTML = '<p style="margin: 0; color:#666;"><strong>已配对成功，正在进行进入会话前的同步准备...</strong></p>';
                    if (isCounselor) {
                        successBlock.innerHTML = getCounselorInstructionHTML(roundNo, '来访者：由真人搭档扮演');
                    } else {
                        successBlock.innerHTML = `
                            <p style="margin: 0;"><strong>连接成功！</strong></p>
                            <p style="margin: 6px 0 0 0;">当前轮次：第 ${roundNo} 轮</p>
                            <p style="margin: 2px 0 0 0;">会话背景：你当前进入的是「安心对话」线上匿名心理支持平台。</p>
                            <p style="margin: 2px 0 0 0;">你的角色：来访者</p>
                            <p style="margin: 2px 0 0 0;">咨询师：由真人搭档扮演</p>
                            <p style="margin: 2px 0 0 0;">你的开场白“你好… 我觉得好难受，能跟你聊聊吗……”已由系统自动发送。</p>
                            <p style="margin: 2px 0 0 0;">本轮任务：按照屏幕右侧的来访者人设进行角色扮演，让咨询师练习刚刚学习的技能，并在练习结束后，根据提示填写反馈表。</p>
                            <ul style="margin-top: 10px; padding-left: 20px;">
                                <li><strong>限时提醒：</strong>对话限时 10 分钟，咨询师可能在完成风险评估后主动结束对话，或超时后系统自动结束对话，随后跳转到反馈填写页面。</li>
                            </ul>
                        `;
                    }

                    successBlock.style.display = 'block';

                    const syncTextNode = document.createElement('p');
                    syncTextNode.id = 'syncedEnterCountdown';
                    syncTextNode.style.margin = '8px 0 0 0';
                    syncTextNode.style.color = '#d35400';
                    syncTextNode.style.fontWeight = 'bold';
                    syncTextNode.textContent = '正在等待两位参与者就绪后同步进入会话...';
                    successBlock.appendChild(syncTextNode);

                    const maxAttempts = 120;
                    const pollInterval = 500;
                    let syncResult = null;
                    for (let attempt = 0; attempt < maxAttempts; attempt++) {
                        syncResult = await syncPairedChatStart(roundNo);
                        if (syncResult.status === 'ready' && syncResult.start_at && syncResult.server_now) {
                            break;
                        }
                        syncTextNode.textContent = '已配对成功，正在等待另一位参与者进入准备页...';
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                    }

                    if (!syncResult || syncResult.status !== 'ready' || !syncResult.start_at || !syncResult.server_now) {
                        try {
                            await leavePairedRoom('sync_timeout');
                        } catch (leaveError) {
                            console.warn('[PAIRED_CHAT] 同步超时后释放房间失败:', leaveError);
                        }
                        stopWaitTimer();
                        throw new Error('等待另一位参与者进入准备页超时，已重置匹配。请点击“重试连接”等待下一位参与者。');
                    }

                    stopWaitTimer();
                    beginSyncedEnterCountdown(syncResult);
                } catch (error) {
                    console.error('[PAIRED_CHAT] 配对预连接失败:', error);
                    successBlock.innerHTML = `<p style="margin: 0; color: #c0392b;"><strong>配对失败：</strong>${error.message}</p>`;
                    successBlock.style.display = 'block';
                    if (continueBtn) {
                        continueBtn.style.display = 'inline-block';
                        continueBtn.disabled = false;
                        continueBtn.textContent = '重试连接';
                        continueBtn.style.backgroundColor = '#e67e22';
                        continueBtn.style.cursor = 'pointer';
                        continueBtn.onclick = connectAndRender;
                    }
                }
            };

            connectAndRender();
        }
    };
}

function createPracticeTimeline(promptKey, startNodeId) {
    // --- 1. 实验组分支：自由 AI 对话 ---
    const experimentalTrial = {
        timeline: [
            createExperimentalConnectionBriefTrial(promptKey),
            {
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
                    experimentData.timestamps[promptKey + '_end'] = getCurrentTimestamp();
                    if (experimentData.chatHistory.length > 0) {
                        experimentData.allPracticeChats[promptKey] = JSON.parse(JSON.stringify(experimentData.chatHistory));
                    }
                }
            }
        ],
        conditional_function: function() { return experimentData.group === 'experimental'; }
    };

    // --- 2. 对照组分支：真人配对聊天室（复用相同 UI） ---
    const controlTrial = {
        timeline: [
            createControlConnectionBriefTrial(promptKey),
            {
                type: jsPsychHtmlButtonResponse,
                stimulus: createChatInterface,
                choices: [],
                conditional_function: function() {
                    return experimentData.group === 'control' || !!(
                        experimentData.controlPairing &&
                        experimentData.controlPairing.timeoutFallback &&
                        experimentData.controlPairing.timeoutFallbackPromptKey === promptKey
                    );
                },
                on_load: function() {
                    experimentData.timestamps[promptKey + '_start'] = getCurrentTimestamp();
                    const routeMode = (experimentData.controlPairing && experimentData.controlPairing.currentRouteMode) || 'paired';
                    if (routeMode === 'ai') {
                        if (typeof switchControlParticipantToExperimentalFlow === 'function') {
                            switchControlParticipantToExperimentalFlow('match_timeout');
                        }
                        experimentData.chatMode = 'ai';
                        experimentData.chatHistory = [];
                        initializeChat(promptKey);
                        startCountdown();
                        showFinishButton();
                        return;
                    }

                    initializePairedChat(promptKey, { prepared: true })
                        .then(() => {
                            startCountdown();
                            showFinishButton();
                        })
                        .catch(error => {
                            console.error('[PAIRED_CHAT] 初始化失败:', error);
                            alert(`连接失败：${error.message}`);
                            jsPsych.finishTrial();
                        });
                },
                on_finish: function() {
                    hideCountdownAndButton();
                    if (window.countdownTimer) {
                        clearInterval(window.countdownTimer);
                        window.countdownTimer = null;
                    }
                    hideCountdown();
                    hideFinishButton();
                    experimentData.timestamps[promptKey + '_end'] = getCurrentTimestamp();
                    if (experimentData.chatHistory.length > 0) {
                        experimentData.allPracticeChats[promptKey] = JSON.parse(JSON.stringify(experimentData.chatHistory));
                    }
                    if (experimentData.controlPairing) {
                        experimentData.controlPairing.timeoutFallback = false;
                        experimentData.controlPairing.timeoutFallbackReason = '';
                        experimentData.controlPairing.timeoutFallbackAt = '';
                        experimentData.controlPairing.timeoutFallbackPromptKey = '';
                        experimentData.controlPairing.timeoutFallbackWaitMs = 0;
                        experimentData.controlPairing.currentRouteMode = 'paired';
                    }
                }
            }
        ],
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
            finishStage(true);
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
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '我已完成风险评估，结束此阶段';
        btn.style.display = 'block';
    } else {
        // 如果找不到按钮，尝试在 500ms 后重新查找一次
        setTimeout(() => {
            const retryBtn = document.getElementById('finishButton');
            if (retryBtn) {
                retryBtn.disabled = false;
                retryBtn.style.opacity = '1';
                retryBtn.textContent = '我已完成风险评估，结束此阶段';
                retryBtn.style.display = 'block';
            }
        }, 500);
    }
}

function hideFinishButton() {
    const btn = document.getElementById('finishButton');
    if (btn) btn.style.display = 'none';
}

function finishStage(autoTriggered = false) {
    console.log("正在结束当前阶段...");

    if (experimentData.chatMode === 'paired') {
        if (experimentData.controlPairing && experimentData.controlPairing.isCounselor) {
            if (!autoTriggered) {
                const confirmed = window.confirm('确认结束本轮咨询吗？结束后来访者将同步进入反馈填写。');
                if (!confirmed) {
                    return;
                }
            }
            const roundBeforeEnd = experimentData.controlPairing.activeRoundNo || 1;
            const finishBtn = document.getElementById('finishButton');
            if (finishBtn) {
                finishBtn.disabled = true;
                finishBtn.style.opacity = '0.6';
                finishBtn.textContent = autoTriggered ? '已到时，正在自动结束本轮...' : '正在结束本轮...';
            }
            setChatComposerEnabled(false);

            endPairedRoundByCounselor()
                .then(() => {
                    hideFinishButton();
                    runPreFeedbackProbeByRoundNo(roundBeforeEnd, function() {
                        showCounselorRecordModal();
                    });
                })
                .catch(error => {
                    if (finishBtn) {
                        finishBtn.disabled = false;
                        finishBtn.style.opacity = '1';
                        finishBtn.textContent = '我已完成风险评估，结束此阶段';
                    }
                    setChatComposerEnabled(true);
                    alert(`结束失败：${error.message}`);
                });
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
    const posttestConfig = (typeof getCounterbalancedQuestionnaireConfig === 'function')
        ? getCounterbalancedQuestionnaireConfig('posttest')
        : QUESTIONNAIRES.posttest;
    return createQuestionnaireTrial('posttest', posttestConfig);
}

// ===== 二次练习提示 =====
function createSecondPracticePromptTrial() {
    const promptTrial = createPracticePromptTrial(4, '练习3');
    const originalOnLoad = promptTrial.on_load;
    promptTrial.on_load = function() {
        if (typeof originalOnLoad === 'function') {
            originalOnLoad();
        }
        updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.practice2);
        experimentData.timestamps.second_practice_prompt = getCurrentTimestamp();
    };
    return promptTrial;
}

// ===== 第二次练习 =====
// experiment.js

function createSecondPracticeTrial() {
    return {
        timeline: [
            createExperimentalConnectionBriefTrial('SECOND_CLIENT'),
            {
                type: jsPsychHtmlButtonResponse,
                stimulus: function() {
                    return createChatInterface();
                },
                choices: [],
                on_load: function() {
                    experimentData.timestamps.second_practice_start = getCurrentTimestamp();
                    experimentData.chatMode = 'ai';
                    if (typeof stopPairedChatPolling === 'function') {
                        stopPairedChatPolling();
                    }

                    initializeChat('SECOND_CLIENT');
                    if (typeof startCountdown === 'function') {
                        startCountdown();
                    }
                    if (typeof showFinishButton === 'function') {
                        showFinishButton();
                    }
                },
                on_finish: function() {
                    hideCountdownAndButton();
                    if (window.countdownTimer) {
                        clearInterval(window.countdownTimer);
                        window.countdownTimer = null;
                    }
                    hideCountdown();
                    hideFinishButton();
                    experimentData.timestamps.second_practice_end = getCurrentTimestamp();
                    const snapshot = JSON.parse(JSON.stringify(experimentData.chatHistory));
                    experimentData.allPracticeChats['SECOND_CLIENT'] = snapshot;
                    experimentData.allPracticeChats['practice_2_retry'] = snapshot;
                }
            }
        ]
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
    experimentData.timestamps.ai_risk_assessment_form_start = getCurrentTimestamp();
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
    experimentData.timestamps.ai_risk_assessment_form_end = getCurrentTimestamp();

    // 3. 优先按当前练习 promptKey 映射 Profile，避免对照组因前两轮是配对练习而错映射到 P1
    // PRACTICE_1 -> P1(低风险), PRACTICE_3 -> P2(高风险), SECOND_CLIENT -> P3(中风险)
    const currentPromptKey = experimentData.currentPracticePromptKey || '';
    let practiceType = 'P1';
    if (currentPromptKey === 'PRACTICE_3') {
        practiceType = 'P2';
    } else if (currentPromptKey === 'SECOND_CLIENT') {
        practiceType = 'P3';
    } else {
        // 兼容旧流程：若未记录 promptKey，则回退到历史计数映射
        const practiceCount = experimentData.responses.practice_assessments.length;
        if (practiceCount === 2) {
            practiceType = 'P2';
        } else if (practiceCount >= 3) {
            practiceType = 'P3';
        }
    }

    // 先插入 Probe，再进入反馈
    runPreFeedbackProbeByPromptKey(currentPromptKey, function() {
        showSupervisorFeedbackUI(currentAssessment, practiceType);
    });
}

function showCounselorRecordModal() {
    if (document.getElementById('counselorRecordModal')) {
        return;
    }
    window.counselorRecordSubmitting = false;
    const roundNo = experimentData.controlPairing.activeRoundNo || 1;
    experimentData.timestamps[`control_counselor_record_round_${roundNo}_start`] = getCurrentTimestamp();

    const html = `
    <div id="counselorRecordModal" style="
        position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:10002;
        display:flex; align-items:center; justify-content:center; font-family:'Microsoft YaHei',sans-serif;">
        <div style="
            background: white; padding: 30px; border-radius: 12px;
            width: 500px; max-width: 90%; box-shadow: 0 5px 25px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <h3 style="margin:0; color:#2c3e50;">请完成危机等级评估</h3>
                <div id="counselorRecordTimer" style="font-size:13px; color:#ad6800;">剩余填写时间 05:00</div>
            </div>
            <p style="margin:10px 0 0 0; color:#666; font-size:14px;">基于您与来访者的对话，请评估其危机等级：</p>

            <div style="display:flex; justify-content:space-around; margin: 20px 0; background:#f8f9fa; padding:15px; border-radius:8px;">
                <label style="cursor:pointer;"><input type="radio" name="record_modal_crisis_level" value="high"> 🔴 高风险</label>
                <label style="cursor:pointer;"><input type="radio" name="record_modal_crisis_level" value="medium"> 🟡 中风险</label>
                <label style="cursor:pointer;"><input type="radio" name="record_modal_crisis_level" value="low"> 🟢 低风险</label>
            </div>

            <p style="color:#666; font-size:14px;">请给出您的评级理由：</p>
            <textarea id="recordReason"
                placeholder="请输入评估理由...（建议从C-SSRS结构化评估、风险因素、保护性因素的角度进行分析）"
                style="width:100%; height:120px; padding:10px; border:1px solid #ddd; border-radius:4px; resize:none; font-family:inherit;"></textarea>

            <div style="text-align:center; margin-top:20px;">
                <button class="jspsych-btn" style="background:#e91e63; color:#fff; border:none;" onclick="submitCounselorRecord()">提交记录</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    let remainingSeconds = 5 * 60;
    const timerEl = document.getElementById('counselorRecordTimer');
    if (window.counselorRecordWriteTimer) {
        clearInterval(window.counselorRecordWriteTimer);
    }
    window.counselorRecordWriteTimer = setInterval(() => {
        remainingSeconds -= 1;
        if (timerEl) {
            const mm = String(Math.floor(Math.max(remainingSeconds, 0) / 60)).padStart(2, '0');
            const ss = String(Math.max(remainingSeconds, 0) % 60).padStart(2, '0');
            timerEl.textContent = `剩余填写时间 ${mm}:${ss}`;
        }
        if (remainingSeconds <= 0) {
            clearInterval(window.counselorRecordWriteTimer);
            window.counselorRecordWriteTimer = null;
            submitCounselorRecord(true);
        }
    }, 1000);
}

async function submitCounselorRecord(forceSubmit = false) {
    if (window.counselorRecordSubmitting) {
        return;
    }

    const levelEl = document.querySelector('input[name="record_modal_crisis_level"]:checked');
    const reason = document.getElementById('recordReason').value.trim();
    const riskLevel = levelEl ? levelEl.value : '';
    if (!forceSubmit && (!riskLevel || !reason)) {
        alert('请完整填写风险评估记录。');
        return;
    }

    if (!experimentData.responses.counselor_records) {
        experimentData.responses.counselor_records = [];
    }

    const confirmed = forceSubmit ? true : window.confirm('确认提交风险评估记录吗？提交后将无法修改。');
    if (!confirmed) {
        return;
    }
    window.counselorRecordSubmitting = true;

    const submitBtn = document.querySelector('#counselorRecordModal button.jspsych-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.textContent = forceSubmit ? '超时自动提交中...' : '提交中...';
    }

    experimentData.responses.counselor_records.push({
        timestamp: getCurrentTimestamp(),
        room_id: experimentData.controlPairing.roomId,
        round_no: experimentData.controlPairing.activeRoundNo || 1,
        risk_level: riskLevel || '未填写',
        reason: reason || '（未填写）',
        chat_history: JSON.parse(JSON.stringify(experimentData.chatHistory))
    });

    let roundBeforeEnd = experimentData.controlPairing.activeRoundNo || 1;
    experimentData.timestamps[`control_counselor_record_round_${roundBeforeEnd}_end`] = getCurrentTimestamp();

    try {
        await markPairedCounselorReportSubmitted(roundBeforeEnd);
    } catch (error) {
        console.warn('[PEER_FEEDBACK] 标记咨询师评估提交失败:', error);
    }

    const modal = document.getElementById('counselorRecordModal');
    if (modal) modal.remove();
    if (window.counselorRecordWriteTimer) {
        clearInterval(window.counselorRecordWriteTimer);
        window.counselorRecordWriteTimer = null;
    }

    const practiceType = roundBeforeEnd === 1 ? 'P1' : 'P2';
    const feedbackPayload = {
        level: riskLevel,
        reason: reason,
        chatHistory: JSON.parse(JSON.stringify(experimentData.chatHistory)),
        roundNo: roundBeforeEnd
    };
    showSupervisorFeedbackUI(feedbackPayload, practiceType, { mode: 'peer' });
}

function showClientFeedbackModal() {
    if (document.getElementById('clientFeedbackModal')) return;
    window.clientFeedbackSubmitting = false;
    const roundNo = experimentData.controlPairing.activeRoundNo || 1;
    experimentData.timestamps[`control_client_feedback_round_${roundNo}_start`] = getCurrentTimestamp();
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
        <div style="max-width:1200px; margin:0 auto 12px auto; background:#fff7e6; border:1px solid #ffd591; border-radius:10px; padding:12px 14px; color:#ad6800; font-weight:600;">
            练习已结束，请填写对咨询师的反馈。
        </div>
        <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px; max-width:1200px; margin:0 auto;">
            <section style="background:#fff; border-radius:12px; padding:14px; border:1px solid #e8ecf0;">
                <h3 style="margin-top:0;">与咨询师聊天记录</h3>
                <div style="height:72vh; overflow:auto; padding-right:4px;">${recordsHtml}</div>
            </section>
            <section style="background:#fff; border-radius:12px; padding:14px; border:1px solid #e8ecf0;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <h3 style="margin-top:0;">来访者反馈表</h3>
                    <div id="clientFeedbackTimer" style="font-size:13px; color:#ad6800;">剩余填写时间 05:00</div>
                </div>
                <p style="margin:0 0 12px 0; font-size:13px; color:#555; line-height:1.7;">
                    请根据哥伦比亚自杀严重程度评估标准（C-SSRS）和心理咨询原则进行点评：
                </p>
                <label><strong>维度1：建立关系</strong></label>
                <label style="font-size:13px; color:#666;">咨询师做得好的地方：</label>
                <textarea id="clientFbRelGood" style="width:100%; height:70px; margin:6px 0 8px 0; padding:8px;" placeholder="请写出咨询师做得好的点"></textarea>
                <label style="font-size:13px; color:#666;">咨询师需要提升的地方：</label>
                <textarea id="clientFbRelImprove" style="width:100%; height:70px; margin:6px 0 12px 0; padding:8px;" placeholder="请写出咨询师可改进之处"></textarea>

                <label><strong>维度2：风险评估（咨询师是否根据C-SSRS评估自杀想法、计划、实施意向、准备行为、风险性因素等。）</strong></label>
                <label style="font-size:13px; color:#666;">咨询师做得好的地方：</label>
                <textarea id="clientFbRiskGood" style="width:100%; height:70px; margin:6px 0 8px 0; padding:8px;" placeholder="请写出咨询师做得好的点"></textarea>
                <label style="font-size:13px; color:#666;">咨询师需要提升的地方：</label>
                <textarea id="clientFbRiskImprove" style="width:100%; height:70px; margin:6px 0 12px 0; padding:8px;" placeholder="请写出咨询师可改进之处"></textarea>

                <label><strong>维度3：保护因素探索</strong></label>
                <label style="font-size:13px; color:#666;">咨询师做得好的地方：</label>
                <textarea id="clientFbProGood" style="width:100%; height:70px; margin:6px 0 8px 0; padding:8px;" placeholder="请写出咨询师做得好的点"></textarea>
                <label style="font-size:13px; color:#666;">咨询师需要提升的地方：</label>
                <textarea id="clientFbProImprove" style="width:100%; height:70px; margin:6px 0 12px 0; padding:8px;" placeholder="请写出咨询师可改进之处"></textarea>

                <label><strong>维度4：综合建议</strong></label>
                <textarea id="clientFbOverall" style="width:100%; height:110px; margin:6px 0 12px 0; padding:8px;" placeholder="请给出整体建议"></textarea>
                <div style="text-align:right; margin-top:14px;">
                    <button class="jspsych-btn" style="background:#27ae60; color:white; border:none;" onclick="submitClientFeedback()">提交反馈</button>
                </div>
            </section>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    let remainingSeconds = 5 * 60;
    const timerEl = document.getElementById('clientFeedbackTimer');
    if (window.clientFeedbackWriteTimer) {
        clearInterval(window.clientFeedbackWriteTimer);
    }
    window.clientFeedbackWriteTimer = setInterval(() => {
        remainingSeconds -= 1;
        if (timerEl) {
            const mm = String(Math.floor(Math.max(remainingSeconds, 0) / 60)).padStart(2, '0');
            const ss = String(Math.max(remainingSeconds, 0) % 60).padStart(2, '0');
            timerEl.textContent = `剩余填写时间 ${mm}:${ss}`;
        }
        if (remainingSeconds <= 0) {
            clearInterval(window.clientFeedbackWriteTimer);
            window.clientFeedbackWriteTimer = null;
            submitClientFeedback(true);
        }
    }, 1000);
}

function showClientWaitingOverlay(roundNo, latestFeedbackResponse = null) {
    const normalizeFeedback = (input) => {
        if (!input) return null;
        if (input.feedback && typeof input.feedback === 'object') {
            return input.feedback;
        }
        return input;
    };
    const existedOverlay = document.getElementById('clientWaitingOverlay');
    if (existedOverlay) {
        const existedFeedbackEl = document.getElementById('clientWaitingFeedbackContent');
        const normalized = normalizeFeedback(latestFeedbackResponse);
        if (existedFeedbackEl && normalized && typeof renderPeerFeedbackHTML === 'function') {
            existedFeedbackEl.innerHTML = renderPeerFeedbackHTML(normalized);
        }
        return;
    }
    window.clientReviewProceeding = false;

    const initialFeedback = normalizeFeedback(latestFeedbackResponse);
    const initialFeedbackHtml = typeof renderPeerFeedbackHTML === 'function'
        ? renderPeerFeedbackHTML(initialFeedback)
        : '<p style="color:#666;">反馈内容加载中...</p>';
    const activeScenario = (experimentData.controlPairing && experimentData.controlPairing.activeScenario) || 'xiaob_low';
    const activeProfile = (experimentData.controlPairing && experimentData.controlPairing.activeProfile) || {};
    const levelText = activeScenario === 'xiaowu_high' ? '高风险' : '低风险';
    const identityText = activeProfile.identity || '17 岁，高二女生，曾品学兼优';
    const situationText = activeProfile.situation || '寒假在家，期末考试成绩大幅滑坡，排名退步严重。';
    const stressHtml = activeProfile.stress || '';
    const detailHtml = activeProfile.crisisDetail || '';

    const html = `
    <div id="clientWaitingOverlay" style="position:fixed; inset:0; z-index:10004; background:rgba(244,246,248,0.98); overflow:auto; font-family:'Microsoft YaHei',sans-serif; padding:22px;">
        <div style="max-width:900px; margin:0 auto; background:#fff; border-radius:15px; box-shadow:0 10px 40px rgba(0,0,0,0.08); overflow:hidden;">
            <div style="background:linear-gradient(135deg, #2f80ed 0%, #56ccf2 100%); color:#fff; padding:28px; text-align:center;">
                <h2 style="margin:0; font-size:30px; letter-spacing:1px;">危机评估复盘报告</h2>
            </div>
            <div style="padding:28px;">
                <h3 style="color:#222; border-left:5px solid #2f80ed; padding-left:15px; margin:0 0 18px 0;">第一部分：来访者真实档案 (上帝视角)</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                    <div style="background:#f4f9ff; padding:18px; border-radius:10px; border-top:4px solid #2f80ed;">
                        <p style="margin:0 0 10px 0;"><strong>🎯 真实危机等级：</strong> ${levelText}</p>
                        <p style="margin:0 0 10px 0;"><strong>👤 身份设定：</strong> ${identityText}</p>
                        <p style="margin:0;"><strong>📍 当前处境：</strong> ${situationText}</p>
                    </div>
                    <div style="background:#fffaf2; padding:18px; border-radius:10px; border-top:4px solid #f2a154;">
                        <p style="margin:0 0 8px 0;"><strong>🔥 核心压力来源分析：</strong></p>
                        ${stressHtml}
                    </div>
                </div>
                <p style="font-weight:bold; color:#5f6368; margin:0 0 12px 0;">🔍 详细风险评估标准:</p>
                <div>${detailHtml}</div>

                <div style="height:1px; background:#eee; margin:24px 0 24px 0;"></div>
                <h3 style="color:#222; border-left:5px solid #2f80ed; padding-left:15px; margin:0 0 12px 0;">第二部分：您提交的反馈</h3>
                <div style="margin:0 0 22px 0; color:#5f6368; font-size:15px; display:flex; justify-content:space-between; gap:12px;">
                    <span id="clientWaitingText">您的反馈已提交，正在等待咨询师提交评估报告。</span>
                    <span id="clientReadTimer" style="color:#ad6800;">共同阅读待开始</span>
                </div>
                <div id="clientWaitingFeedbackContent">${initialFeedbackHtml}</div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    let sharedReadSeconds = 5 * 60;
    let syncedDeadlineMs = null;
    let syncedClockOffsetMs = 0;
    const timerEl = document.getElementById('clientReadTimer');
    const textEl = document.getElementById('clientWaitingText');
    const feedbackEl = document.getElementById('clientWaitingFeedbackContent');

    const getSyncedRemainingSeconds = () => {
        if (!Number.isFinite(syncedDeadlineMs)) {
            return null;
        }
        const nowServerMs = Date.now() + syncedClockOffsetMs;
        return Math.max(0, Math.ceil((syncedDeadlineMs - nowServerMs) / 1000));
    };

    const applySyncedCountdown = (payload) => {
        if (!payload) {
            return;
        }
        const serverNowMs = Date.parse(payload.server_now);
        const deadlineMs = Date.parse(payload.read_deadline_at);
        if (Number.isFinite(serverNowMs) && Number.isFinite(deadlineMs)) {
            syncedClockOffsetMs = serverNowMs - Date.now();
            syncedDeadlineMs = deadlineMs;
            if (textEl) {
                textEl.textContent = '咨询师已提交评估报告，双方共同阅读中，请耐心等候。';
            }
        }
        const readSecFromServer = Number(payload.shared_read_seconds);
        if (Number.isFinite(readSecFromServer) && readSecFromServer > 0) {
            sharedReadSeconds = Math.floor(readSecFromServer);
        }
    };

    applySyncedCountdown(latestFeedbackResponse);

    if (window.clientReviewWaitTimer) {
        clearInterval(window.clientReviewWaitTimer);
    }
    if (window.clientReviewPollTimer) {
        clearInterval(window.clientReviewPollTimer);
    }

    const proceedWithPostFeedbackProbe = () => {
        runPostFeedbackProbeByRoundNo(roundNo, function() {
            proceedToNextStage();
        });
    };

    const tryProceed = async () => {
        if (window.clientReviewProceeding) {
            return;
        }
        try {
            const payload = await fetchPairedClientFeedback(roundNo);
            applySyncedCountdown(payload);
            if (payload && payload.submitted && payload.feedback && typeof renderPeerFeedbackHTML === 'function' && feedbackEl) {
                feedbackEl.innerHTML = renderPeerFeedbackHTML(payload.feedback);
            }
            if (textEl && payload && !payload.counselor_review_ready) {
                if (payload.counselor_report_submitted && payload.read_deadline_at) {
                    textEl.textContent = '咨询师已提交评估报告，双方共同阅读中，请耐心等候。';
                } else {
                    textEl.textContent = '您的反馈已提交，正在等待咨询师提交评估报告。';
                }
            }
            if (payload && payload.counselor_review_ready) {
                window.clientReviewProceeding = true;
                if (window.clientReviewWaitTimer) clearInterval(window.clientReviewWaitTimer);
                if (window.clientReviewPollTimer) clearInterval(window.clientReviewPollTimer);
                window.clientReviewWaitTimer = null;
                window.clientReviewPollTimer = null;
                const overlay = document.getElementById('clientWaitingOverlay');
                if (overlay) overlay.remove();
                proceedWithPostFeedbackProbe();
            }
        } catch (error) {
            if (textEl) textEl.textContent = `正在等待搭档阅读（网络波动：${error.message}）`;
        }
    };

    window.clientReviewWaitTimer = setInterval(() => {
        let remaining = getSyncedRemainingSeconds();
        if (timerEl) {
            if (!Number.isFinite(remaining)) {
                timerEl.textContent = '共同阅读待开始';
            } else {
                const mm = String(Math.floor(Math.max(remaining, 0) / 60)).padStart(2, '0');
                const ss = String(Math.max(remaining, 0) % 60).padStart(2, '0');
                timerEl.textContent = `共同阅读剩余 ${mm}:${ss}`;
            }
        }
        if (Number.isFinite(remaining) && remaining <= 0) {
            if (window.clientReviewProceeding) {
                return;
            }
            window.clientReviewProceeding = true;
            clearInterval(window.clientReviewWaitTimer);
            window.clientReviewWaitTimer = null;
            if (window.clientReviewPollTimer) {
                clearInterval(window.clientReviewPollTimer);
                window.clientReviewPollTimer = null;
            }
            if (textEl) {
                textEl.textContent = '已达到最长等待时间，将继续下一步。';
            }
            setTimeout(() => {
                const overlay = document.getElementById('clientWaitingOverlay');
                if (overlay) overlay.remove();
                proceedWithPostFeedbackProbe();
            }, 800);
        }
    }, 1000);

    window.clientReviewPollTimer = setInterval(tryProceed, 2000);
    tryProceed();
}

function submitClientFeedback(forceSubmit = false) {
    if (window.clientFeedbackSubmitting) {
        return;
    }

    const relationshipGood = document.getElementById('clientFbRelGood').value.trim();
    const relationshipImprove = document.getElementById('clientFbRelImprove').value.trim();
    const riskGood = document.getElementById('clientFbRiskGood').value.trim();
    const riskImprove = document.getElementById('clientFbRiskImprove').value.trim();
    const protectiveGood = document.getElementById('clientFbProGood').value.trim();
    const protectiveImprove = document.getElementById('clientFbProImprove').value.trim();
    const overallSuggestion = document.getElementById('clientFbOverall').value.trim();
    if (
        !forceSubmit &&
        (
            !relationshipGood || !relationshipImprove ||
            !riskGood || !riskImprove ||
            !protectiveGood || !protectiveImprove ||
            !overallSuggestion
        )
    ) {
        alert('请完整填写反馈表。');
        return;
    }
    window.clientFeedbackSubmitting = true;

    const submitBtn = document.querySelector('#clientFeedbackModal button.jspsych-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.textContent = forceSubmit ? '超时自动提交中...' : '提交中...';
    }

    const fallbackText = '（未填写）';
    const roundNo = experimentData.controlPairing.activeRoundNo || 1;
    const payload = {
        round_no: roundNo,
        relationship_good: relationshipGood || fallbackText,
        relationship_improve: relationshipImprove || fallbackText,
        risk_good: riskGood || fallbackText,
        risk_improve: riskImprove || fallbackText,
        protective_good: protectiveGood || fallbackText,
        protective_improve: protectiveImprove || fallbackText,
        overall_suggestion: overallSuggestion || fallbackText,
    };

    if (!experimentData.responses.client_feedbacks) {
        experimentData.responses.client_feedbacks = [];
    }
    experimentData.responses.client_feedbacks.push({
        timestamp: getCurrentTimestamp(),
        room_id: experimentData.controlPairing.roomId,
        round_no: roundNo,
        ...payload,
        chat_history: JSON.parse(JSON.stringify(experimentData.chatHistory))
    });
    experimentData.timestamps[`control_client_feedback_round_${roundNo}_end`] = getCurrentTimestamp();

    submitPairedClientFeedback(payload)
        .then((serverFeedbackResponse) => {
            if (window.clientFeedbackWriteTimer) {
                clearInterval(window.clientFeedbackWriteTimer);
                window.clientFeedbackWriteTimer = null;
            }
            const modal = document.getElementById('clientFeedbackModal');
            if (modal) modal.remove();
            const mergedResponse = serverFeedbackResponse && typeof serverFeedbackResponse === 'object'
                ? {
                    ...serverFeedbackResponse,
                    feedback: serverFeedbackResponse.feedback || payload
                }
                : { feedback: payload };
            showClientWaitingOverlay(roundNo, mergedResponse);
        })
        .catch(error => {
            window.clientFeedbackSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.textContent = '提交反馈';
            }
            alert(`提交失败：${error.message}`);
        });
}

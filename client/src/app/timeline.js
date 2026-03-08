// Timeline assembly.
function createProgressNode(percent, icon) {
    return {
        type: jsPsychHtmlButtonResponse, // 这个插件你肯定加载了
        stimulus: '', // 空内容
        choices: [],  // 没有按钮
        trial_duration: 0, // 0毫秒，意味着瞬间跳过
        on_finish: function() {
            if (typeof updateCustomProgress === 'function') {
                updateCustomProgress(percent, icon);
            }
        }
    };
}

function isControlChatDebugMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugMode') === 'control-chat';
}

function setupControlChatDebugParticipant() {
    const params = new URLSearchParams(window.location.search);
    const age = parseInt(params.get('debugAge') || '24', 10);
    const gender = params.get('debugGender') || '调试';

    experimentData.group = 'control';
    experimentData.chatMode = 'paired';
    experimentData.participantProfile = {
        age,
        gender
    };
    experimentData.participantId = '';
    experimentData.controlPairing.registered = false;
    experimentData.controlPairing.roomId = '';
    experimentData.controlPairing.partnerId = '';
    experimentData.controlPairing.roomStatus = '';
    experimentData.controlPairing.currentRound = 1;
    experimentData.controlPairing.assignedRole = '';
    experimentData.controlPairing.participantKey = `${age}_${gender}`;
    experimentData.controlPairing.lastMessageId = 0;
    experimentData.timestamps.debug_mode_start = getCurrentTimestamp();
}

function startControlChatDebugExperiment() {
    setupControlChatDebugParticipant();
    initCustomProgressBar();
    updateCustomProgress(35, '🐞');

    const timeline = [
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
                <div style="max-width: 760px; margin: 0 auto; text-align: left; line-height: 1.8;">
                    <h2>对照组 Debug 模式</h2>
                    <p>当前已跳过正式实验流程，直接进入对照组配对聊天室。</p>
                    <p><strong>调试被试ID：</strong>${experimentData.participantId}</p>
                    <p><strong>说明：</strong>请在两个浏览器窗口中分别打开这个入口，才能完成配对。</p>
                </div>
            `,
            choices: ['进入聊天室']
        },
        createPracticePromptTrial(1),
        ...createPracticeTimeline('PRACTICE_1', 'START'),
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
                <div style="max-width: 760px; margin: 0 auto; text-align: left; line-height: 1.8;">
                    <h2>Debug 聊天室结束</h2>
                    <p>当前调试流程已结束。你可以关闭页面，或返回测试页重新进入。</p>
                </div>
            `,
            choices: ['结束调试']
        }
    ];

    jsPsych.run(timeline);
}

function startExperiment() {
    if (isControlChatDebugMode()) {
        startControlChatDebugExperiment();
        return;
    }

    // 初始化新进度条 (初始 5%)
    initCustomProgressBar();
    updateCustomProgress(5); 

    experimentData.startTime = getCurrentTimestamp();
    experimentData.participantId = 'P' + Math.floor(Math.random() * 9000 + 1000) + '_' + Date.now().toString().slice(-4);
    const timeline = [];
    
    // --- 阶段 1：知情同意与分组 ---
    timeline.push(createConsentTrial());
    performRandomGrouping(); 
    timeline.push(createGroupingTrial());

    timeline.push(createProcedureInstructionTrial());
    
    // --- 阶段 2：个人信息与前测 (结束 15%) ---
    timeline.push(createPretestQuestionnaire()); 
    
    // 【修复】使用 createProgressNode 替代 CallFunction
    timeline.push(createProgressNode(15));
    
    // --- 阶段 3：培训 (视频 + Tutor) (结束 20%) ---
    timeline.push(createVideoPromptTrial());
    timeline.push(createVideoTrial());
    timeline.push(createAITutorTrial()); 
    // (Tutor 结束的 20% 已在 createAITutorTrial 的 on_finish 里处理，这里不用加)

    // --- 阶段 4：三次练习 ---
    
    // 练习一 (结束 35%)
    timeline.push(createPracticePromptTrial(1));
    timeline.push(...createPracticeTimeline('PRACTICE_1', 'START')); 

    // 练习三 (结束 65%)
    timeline.push(createPracticePromptTrial(3));
    timeline.push(...createPracticeTimeline('PRACTICE_3', 'WU_START'));

    // 【修复】更新进度 -> 65%
    timeline.push(createProgressNode(65));

    // --- 阶段 5：后测问卷 (结束 80%) ---
    timeline.push(createPosttestQuestionnaire()); // 确保这里是你真实的后测函数
    
    // 【修复】更新进度 -> 80%
    timeline.push(createProgressNode(80));
    
    // --- 阶段 6：第二次练习 (结束 85%) ---
    timeline.push(createSecondPracticePromptTrial());
    timeline.push(createSecondPracticeTrial());
    timeline.push(createCrisisAssessmentTrial());

    // 【修复】更新进度 -> 85%
    timeline.push(createProgressNode(85));

    // --- 阶段 7：AI督导反馈 (结束 90%) ---
    timeline.push(createAISupervisorTrial());
    
    // (AI督导反馈的 90% 我们已经在 createAISupervisorTrial 的 on_load 里加过了，这里可以不加，或者加一个保险)
    timeline.push(createProgressNode(90));

    // --- 阶段 8：最终问卷 (结束 100%) ---
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div style="text-align:left;"><h3>最后一步</h3><p>请填写最后一份简短问卷。</p></div>`,
        choices: ['继续']
    });
    timeline.push(createQuestionnaireTrial('questionnaire3', QUESTIONNAIRES.questionnaire3));

    // 【修复】全部完成 -> 100% (打钩✅)
    timeline.push(createProgressNode(100, '✅'));

    // --- 结束页 ---
    timeline.push(createEndTrial());
    
    jsPsych.run(timeline);
}
   

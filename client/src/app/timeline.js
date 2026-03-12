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

function setupEmergencyNextShortcut() {
    const pressedKeys = new Set();
    document.addEventListener('keydown', function(e) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const k = e.key.toLowerCase();
        if (k === 'n') {
            pressedKeys.add('n');
            if (e.altKey && pressedKeys.has('=')) doTrigger(e);
        } else if (e.key === '=') {
            pressedKeys.add('=');
            if (e.altKey && pressedKeys.has('n')) doTrigger(e);
        }
    }, true);
    document.addEventListener('keyup', function(e) {
        const k = e.key.toLowerCase();
        if (k === 'alt') pressedKeys.clear();
        else if (k === 'n' || e.key === '=') pressedKeys.delete(k === 'n' ? 'n' : '=');
    }, true);
    function doTrigger(e) {
        e.preventDefault();
        if (typeof jsPsych === 'undefined' || !jsPsych.getCurrentTrial) return;
        if (!jsPsych.getCurrentTrial()) return;
        jsPsych.finishTrial();
    }
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
    experimentData.initialGroup = 'control';
    experimentData.chatMode = 'paired';
    experimentData.participantProfile = {
        age,
        gender,
        grade: params.get('debugGrade') || '调试'
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
    experimentData.controlPairing.timeoutFallback = false;
    experimentData.controlPairing.timeoutFallbackReason = '';
    experimentData.controlPairing.timeoutFallbackAt = '';
    experimentData.controlPairing.timeoutFallbackPromptKey = '';
    experimentData.controlPairing.timeoutFallbackWaitMs = 0;
    experimentData.controlPairing.currentRouteMode = 'paired';
    experimentData.controlPairing.hasMatchedOnce = false;
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

async function startExperiment(resumeInfo = null) {
    const restoreInfo = (resumeInfo && typeof resumeInfo === 'object') ? resumeInfo : { available: false, resumeTrialIndex: 0 };
    const isResumeMode = !!(restoreInfo && restoreInfo.available && Number(restoreInfo.resumeTrialIndex || 0) > 0);

    if (isControlChatDebugMode()) {
        startControlChatDebugExperiment();
        return;
    }

    // 初始化新进度条 (初始 5%)
    initCustomProgressBar();
    setupEmergencyNextShortcut();  // 紧急下一页：Alt+N+= 同时按下
    updateCustomProgress(5); 

    if (!experimentData.startTime) {
        experimentData.startTime = getCurrentTimestamp();
    }
    if (!experimentData.participantId) {
        experimentData.participantId = 'P' + Math.floor(Math.random() * 9000 + 1000) + '_' + Date.now().toString().slice(-4);
    }
    if (!isResumeMode) {
        experimentData.controlPairing.timeoutFallback = false;
        experimentData.controlPairing.timeoutFallbackReason = '';
        experimentData.controlPairing.timeoutFallbackAt = '';
        experimentData.controlPairing.timeoutFallbackPromptKey = '';
        experimentData.controlPairing.timeoutFallbackWaitMs = 0;
        experimentData.controlPairing.currentRouteMode = 'paired';
        experimentData.controlPairing.hasMatchedOnce = false;
    }
    if (typeof persistAutosaveNow === 'function') {
        persistAutosaveNow('experiment_start', true).catch((error) => {
            console.warn('[AUTOSAVE] experiment start save failed:', error);
        });
    }
    const timeline = [];
    
    // --- 阶段 1：知情同意与分组 ---
    timeline.push(createConsentTrial());
    if (!isResumeMode || !experimentData.group || !experimentData.timestamps.grouping_complete) {
        await performRandomGrouping();
    }
    timeline.push(createGroupingTrial());

    timeline.push(createProcedureInstructionTrial());
    
    // --- 阶段 2：前测 + Probe1 ---
    timeline.push(createPretestQuestionnaire());
    timeline.push(createProbeTrial('probe1'));
    timeline.push(createProgressNode(15));
    
    // --- 阶段 3：培训 (视频 + Tutor) + Probe2 ---
    timeline.push(createVideoPromptTrial());
    timeline.push(createVideoTrial());
    timeline.push(createAITutorTrial());
    timeline.push(createProbeTrial('probe2'));

    // --- 阶段 4：Practice1 ---
    timeline.push(createPracticePromptTrial(1));
    timeline.push(...createPracticeTimeline('PRACTICE_1', 'START'));

    // --- 阶段 5：Practice2 ---
    timeline.push(createPracticePromptTrial(3));
    timeline.push(...createPracticeTimeline('PRACTICE_3', 'WU_START'));
    timeline.push(createProgressNode(65));

    // --- 阶段 6：后测问卷 ---
    timeline.push(createPosttestQuestionnaire());
    timeline.push(createProgressNode(80));

    // --- 阶段 7：第三次练习（SECOND_CLIENT，不新增probe） ---
    timeline.push(createSecondPracticePromptTrial());
    timeline.push(createSecondPracticeTrial());
    timeline.push(createProgressNode(85));
    timeline.push(createProgressNode(90));

    // --- 阶段 8：questionnaire3（保留，不新增probe） ---
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div style="text-align:left;"><h3>最后一步</h3><p>请填写最后一份简短问卷。</p></div>`,
        choices: ['继续']
    });
    timeline.push(createQuestionnaireTrial('questionnaire3', QUESTIONNAIRES.questionnaire3));

    // --- 阶段 9：收尾 ---
    timeline.push(createProgressNode(100, '✅'));
    timeline.push(createEndTrial());
    
    if (isResumeMode) {
        const resumeIndex = Number(restoreInfo.resumeTrialIndex || 0);
        const boundedIndex = Math.max(0, Math.min(resumeIndex, timeline.length - 1));
        if (boundedIndex > 0 && boundedIndex < timeline.length) {
            console.log(`[AUTOSAVE] resume from trial index ${boundedIndex}/${timeline.length}`);
            jsPsych.run(timeline.slice(boundedIndex));
            return;
        }
    }
    jsPsych.run(timeline);
}
   

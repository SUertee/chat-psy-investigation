// Global state and shared runtime values.
/**
 * 危机评估培训实验主程序
 * 
 * 实验流程：
 * 1. 知情同意 → 2. 随机分组 → 3. 个人信息 → 4. 前测问卷 → 5. 视频学习
 * 6. 练习/观摩 → 7. 后测问卷 → 8. 二次练习 → 9. 危机评估 → 10. 问卷3 → 11. AI反馈 → 12. 问卷4
 */
// 修复 UUID 兼容性问题
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    window.crypto = window.crypto || {};
    window.crypto.randomUUID = function() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    };
}
// ===== 全局变量 =====
let jsPsych;
// ===== 修改 1：在 experiment.js 顶部更新全局变量 =====
let experimentData = {
    participantId: '',
    participantProfile: {
        age: null,
        gender: '',
        grade: ''
    },
    group: '',
    initialGroup: '',
    splitHalfOrder: '',
    startTime: '',
    timestamps: {},
    responses: {
        scripted_simulation: [] // 确保脚本记录初始化
    },
    chatHistory: [], // 这是临时的，每次练习都会被清空
    pairedChatHistory: [],
    tutorChatHistory: [], // AI Tutor 记录
    // >>> 新增：用于永久保存三次练习的完整对话 <<<
    allPracticeChats: {
        PRACTICE_1: [],
        PRACTICE_3: [],
        SECOND_CLIENT: [],
        practice_2_retry: [] // 兼容旧键
    },
    controlPairing: {
        registered: false,
        roomId: '',
        partnerId: '',
        roomStatus: '',
        currentRound: 1,
        assignedRole: '',
        participantKey: '',
        lastMessageId: 0,
        roleInCurrentRound: '',
        isCounselor: false,
        activeScenario: '',
        roundEnded: false,
        activeRoundNo: 1,
        firstRoundRole: '',
        secondRoundRole: '',
        roomLostNotified: false,
        recoveringRoom: false,
        activePromptKey: '',
        timeoutFallback: false,
        timeoutFallbackReason: '',
        timeoutFallbackAt: '',
        timeoutFallbackPromptKey: '',
        timeoutFallbackWaitMs: 0,
        hasMatchedOnce: false,
        currentRouteMode: 'paired',
        localIsTyping: false,
        localTypingLastSentAt: 0,
        peerIsTyping: false
    },
    chatMode: 'ai',
    crisisAssessment: {},
    supervisorFeedback: '',
    supervisorFeedbackByPractice: {},
    __autosaveTrialCount: 0,
    __autosaveDraftForm: null
};

let countdownTimer;
let countdownTimeLeft = EXPERIMENT_CONFIG.COUNTDOWN_TIME;

// >>> START: 新增脚本模拟全局状态变量 <<<
let currentSimulationNodeId = 'START';
let previousAiFeedback = '';
let tutorCountdownInterval;
let tutorTimeLeft = 5 * 60; // 5分钟 = 300秒
let chatStep = 0;
let aiClientPrompt = '';

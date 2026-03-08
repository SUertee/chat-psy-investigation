// Paired control-group backend service helpers.
function getBackendBaseUrl() {
    return (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
}

async function backendRequest(path, options = {}) {
    const baseUrl = getBackendBaseUrl();
    if (!baseUrl) {
        throw new Error('BACKEND_BASE_URL is not configured.');
    }

    const response = await fetch(`${baseUrl}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const errorPayload = await response.json();
            detail = errorPayload.detail || errorPayload.error || JSON.stringify(errorPayload);
        } catch (error) {
            // Ignore JSON parse failure and keep the status text.
        }
        throw new Error(detail);
    }

    return response.json();
}

async function registerPairedParticipant() {
    const profile = experimentData.participantProfile || {};

    if (!profile.age || !profile.gender) {
        throw new Error('缺少年龄或性别，无法注册对照组参与者。');
    }

    const payload = {
        age: profile.age,
        gender: profile.gender,
        group_type: experimentData.group || ''
    };

    const result = await backendRequest('/participants/register', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    experimentData.participantId = result.participant_id;
    experimentData.controlPairing.registered = true;
    return result;
}

async function ensureControlParticipantRegistered() {
    if (experimentData.group !== 'control') {
        return null;
    }

    if (experimentData.controlPairing.registered && experimentData.participantId) {
        return { participant_id: experimentData.participantId };
    }

    return registerPairedParticipant();
}

async function joinMatchQueue() {
    return backendRequest('/match/join', {
        method: 'POST',
        body: JSON.stringify({ participant_id: experimentData.participantId })
    });
}

async function fetchMatchStatus() {
    return backendRequest(`/match/status/${encodeURIComponent(experimentData.participantId)}`);
}

async function waitForMatchReady() {
    let status = await joinMatchQueue();
    if (status.status === 'matched') {
        applyMatchStatus(status);
        return status;
    }

    const maxAttempts = EXPERIMENT_CONFIG.MATCH_POLL_MAX_ATTEMPTS || 30;
    const pollInterval = EXPERIMENT_CONFIG.MATCH_POLL_INTERVAL_MS || 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        status = await fetchMatchStatus();
        if (status.status === 'matched') {
            applyMatchStatus(status);
            return status;
        }
    }

    throw new Error('等待匹配超时，请稍后重试。');
}

function applyMatchStatus(status) {
    experimentData.controlPairing.roomId = status.room_id || '';
    experimentData.controlPairing.partnerId = status.partner_id || '';
    experimentData.controlPairing.roomStatus = status.room_status || status.status || '';
    experimentData.controlPairing.currentRound = status.current_round || 1;
    experimentData.controlPairing.assignedRole = status.role_assignment || '';
}

async function fetchRoomState() {
    if (!experimentData.controlPairing.roomId) {
        throw new Error('当前没有可用房间。');
    }
    const room = await backendRequest(`/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}`);
    experimentData.controlPairing.roomStatus = room.status;
    experimentData.controlPairing.currentRound = room.current_round;
    return room;
}

function getCurrentControlRoundNumber(promptKey) {
    if (promptKey === 'PRACTICE_1') {
        return 1;
    }
    if (promptKey === 'PRACTICE_3') {
        return 2;
    }
    return experimentData.controlPairing.currentRound || 1;
}

function getParticipantRoomKey(room) {
    if (room.participant_a === experimentData.participantId) {
        return 'A';
    }
    if (room.participant_b === experimentData.participantId) {
        return 'B';
    }
    return '';
}

function getRoundScenarioProfile(scenario) {
    if (scenario === 'xiaowu_high') {
        return {
            title: '来访者脚本：小吴（高风险）',
            identity: '27岁，男性，创业失败负债',
            pressure: '经济崩盘、家庭断裂、严重失眠与羞耻感',
            crisis: '存在明确计划与较高意图，需重点评估计划、意图与行为准备'
        };
    }
    return {
        title: '来访者脚本：小B（低风险）',
        identity: '17岁，高二女生，学业退步后陷入绝望',
        pressure: '学业压力、父母指责、失眠与躯体不适',
        crisis: '存在消极意念，但无明确计划和实施意图'
    };
}

function resolveRoundRole(room, roundNo) {
    const roundInfo = room.rounds.find(item => item.round_no === roundNo) || room.rounds[0];
    const roomKey = getParticipantRoomKey(room);
    const isCounselor = roundInfo.counselor_key === roomKey;
    const profile = getRoundScenarioProfile(roundInfo.scenario);
    return {
        roundInfo,
        isCounselor,
        roleText: isCounselor ? '咨询师' : '来访者',
        scenarioText: roundInfo.scenario === 'xiaob_low' ? '小B（低风险）' : '小吴（高风险）',
        profile
    };
}

function mountClientProfilePanel() {
    const layout = document.querySelector('.chat-layout');
    if (!layout) return;

    const existing = document.getElementById('pairedClientProfile');
    if (existing) existing.remove();

    if (experimentData.controlPairing.isCounselor) return;

    const panel = document.createElement('aside');
    panel.id = 'pairedClientProfile';
    panel.className = 'chat-profile-panel';
    panel.innerHTML = getControlClientProfileHTML();
    layout.appendChild(panel);
}

function getControlClientProfileHTML() {
    const profile = experimentData.controlPairing.activeProfile || getRoundScenarioProfile('xiaob_low');
    return `
        <h4>${profile.title}</h4>
        <div class="profile-block"><strong>身份背景：</strong>${profile.identity}</div>
        <div class="profile-block"><strong>压力来源：</strong>${profile.pressure}</div>
        <div class="profile-block"><strong>危机线索：</strong>${profile.crisis}</div>
        <div class="profile-block"><strong>提醒：</strong>请持续以“来访者”视角回应，避免一次性抛出全部细节。</div>
    `;
}

function stopPairedChatPolling() {
    if (window.pairedChatPollingInterval) {
        clearInterval(window.pairedChatPollingInterval);
        window.pairedChatPollingInterval = null;
    }
}

function handlePairedRoomNotFound(error) {
    const message = String((error && error.message) || '');
    if (!/room not found/i.test(message)) {
        return false;
    }

    stopPairedChatPolling();
    setChatComposerEnabled(false);
    experimentData.controlPairing.roomId = '';

    if (!experimentData.controlPairing.roomLostNotified) {
        experimentData.controlPairing.roomLostNotified = true;
        alert('配对房间已失效（可能是后端重启导致内存房间清空）。请重新开始配对练习。');
    }
    return true;
}

async function refreshPairedMessages() {
    if (!experimentData.controlPairing.roomId) {
        return;
    }

    const messages = await backendRequest(
        `/chat/messages/${encodeURIComponent(experimentData.controlPairing.roomId)}?after_id=${experimentData.controlPairing.lastMessageId || 0}`
    );

    if (!Array.isArray(messages) || messages.length === 0) {
        return;
    }

    messages.forEach(message => {
        experimentData.controlPairing.lastMessageId = Math.max(
            experimentData.controlPairing.lastMessageId || 0,
            message.message_id
        );

        if (message.round_no !== experimentData.controlPairing.activeRoundNo) {
            return;
        }

        experimentData.pairedChatHistory.push(message);

        const isSelf = message.sender_id === experimentData.participantId;
        if (isSelf) {
            addChatMessage('user', message.content, { avatarLabel: '我' });
        } else {
            const peerAvatar = message.sender_role === 'counselor' ? '资' : '来';
            addChatMessage('ai', message.content, { avatarLabel: peerAvatar });
        }
        experimentData.chatHistory.push({
            timestamp: message.created_at,
            sender: isSelf ? 'user' : 'ai',
            content: message.content
        });
    });
}

async function monitorPairedRoundStatus() {
    if (!experimentData.controlPairing.roomId) return;
    const room = await fetchRoomState();
    const roundNo = experimentData.controlPairing.activeRoundNo || 1;
    const roundInfo = room.rounds.find(item => item.round_no === roundNo);
    if (!roundInfo) return;

    if (roundInfo.status === 'ended' && !experimentData.controlPairing.roundEnded) {
        experimentData.controlPairing.roundEnded = true;
        if (!experimentData.controlPairing.isCounselor) {
            showClientFeedbackModal();
        }
    }
}

function startPairedChatPolling() {
    stopPairedChatPolling();

    const pollInterval = EXPERIMENT_CONFIG.MATCH_POLL_INTERVAL_MS || 2000;
    window.pairedChatPollingInterval = setInterval(() => {
        refreshPairedMessages().catch(error => {
            if (handlePairedRoomNotFound(error)) return;
            console.error('[PAIRED_CHAT] 拉取消息失败:', error);
        });
        monitorPairedRoundStatus().catch(error => {
            if (handlePairedRoomNotFound(error)) return;
            console.error('[PAIRED_CHAT] 拉取房间状态失败:', error);
        });
    }, pollInterval);
}

function setChatComposerEnabled(enabled) {
    const input = document.getElementById('chatInput');
    const sendButton = document.getElementById('chatSendButton');

    if (input) {
        input.disabled = !enabled;
        input.placeholder = enabled ? '请输入您的回应...' : '正在匹配或等待房间就绪...';
    }

    if (sendButton) {
        sendButton.disabled = !enabled;
        sendButton.style.opacity = enabled ? '1' : '0.5';
        sendButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
}

function getControlRoundBrief(room, roundNo) {
    const role = resolveRoundRole(room, roundNo);
    const roleText = role.roleText;
    const scenarioText = role.scenarioText;
    return `已进入配对房间。当前为第 ${roundNo} 轮，你的角色是${roleText}。本轮脚本场景：${scenarioText}。`;
}

async function initializePairedChat(promptKey) {
    experimentData.chatMode = 'paired';
    experimentData.chatHistory = [];
    experimentData.pairedChatHistory = [];
    experimentData.controlPairing.roomLostNotified = false;
    experimentData.controlPairing.lastMessageId = 0;
    experimentData.controlPairing.roundEnded = false;

    const messagesDiv = document.getElementById('chatMessages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }

    addChatMessage('system', '正在连接配对房间，请稍候...');
    setChatComposerEnabled(false);

    await ensureControlParticipantRegistered();
    if (!experimentData.controlPairing.roomId) {
        await waitForMatchReady();
    }

    const room = await fetchRoomState();
    const roundNo = getCurrentControlRoundNumber(promptKey);
    experimentData.controlPairing.activeRoundNo = roundNo;
    const role = resolveRoundRole(room, roundNo);
    experimentData.controlPairing.roleInCurrentRound = role.roleText;
    experimentData.controlPairing.isCounselor = role.isCounselor;
    experimentData.controlPairing.activeScenario = role.roundInfo.scenario;
    experimentData.controlPairing.activeProfile = role.profile;
    mountClientProfilePanel();

    addChatMessage('system', getControlRoundBrief(room, roundNo));
    experimentData.chatHistory.push({
        timestamp: getCurrentTimestamp(),
        sender: 'ai',
        content: getControlRoundBrief(room, roundNo)
    });

    setChatComposerEnabled(true);
    await refreshPairedMessages();
    startPairedChatPolling();
}

async function sendPairedChatMessageFromInput() {
    const input = document.getElementById('chatInput');
    const message = input ? input.value.trim() : '';
    if (!message) {
        return;
    }

    const roundNo = experimentData.controlPairing.currentRound || 1;

    addChatMessage('user', message, { avatarLabel: '我' });
    experimentData.chatHistory.push({
        timestamp: getCurrentTimestamp(),
        sender: 'user',
        content: message
    });

    if (input) {
        input.value = '';
    }

    const sent = await backendRequest('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
            room_id: experimentData.controlPairing.roomId,
            participant_id: experimentData.participantId,
            round_no: roundNo,
            content: message
        })
    });

    experimentData.controlPairing.lastMessageId = Math.max(
        experimentData.controlPairing.lastMessageId || 0,
        sent.message_id
    );
    experimentData.pairedChatHistory.push(sent);
}

async function completePairedRound() {
    stopPairedChatPolling();

    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        return null;
    }

    const result = await backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/advance-round`,
        {
            method: 'POST',
            body: JSON.stringify({ participant_id: experimentData.participantId })
        }
    );

    experimentData.controlPairing.currentRound = result.current_round;
    experimentData.controlPairing.roomStatus = result.room_status;
    return result;
}

async function endPairedRoundByCounselor() {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法结束本轮。');
    }
    const result = await backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/end-round`,
        {
            method: 'POST',
            body: JSON.stringify({ participant_id: experimentData.participantId })
        }
    );
    experimentData.controlPairing.roundEnded = true;
    experimentData.controlPairing.currentRound = result.current_round;
    experimentData.controlPairing.roomStatus = result.room_status;
    return result;
}

async function submitPairedClientFeedback(payload) {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法提交来访者反馈。');
    }
    return backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/client-feedback`,
        {
            method: 'POST',
            body: JSON.stringify({
                participant_id: experimentData.participantId,
                round_no: payload.round_no,
                relationship_feedback: payload.relationship_feedback,
                risk_exploration_feedback: payload.risk_exploration_feedback,
                protective_factor_feedback: payload.protective_factor_feedback,
                overall_suggestion: payload.overall_suggestion,
                empathy_score: payload.empathy_score,
                continue_intent: payload.continue_intent,
                notes: payload.notes,
            }),
        }
    );
}

async function fetchPairedClientFeedback(roundNo) {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法读取来访者反馈。');
    }
    const query = new URLSearchParams({
        participant_id: experimentData.participantId,
        round_no: String(roundNo),
    });
    return backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/client-feedback?${query.toString()}`
    );
}

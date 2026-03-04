// Paired control-group backend service helpers.
function getBackendBaseUrl() {
    return (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
}

function buildParticipantId(age, gender, unikey) {
    const normalizedGender = String(gender || '').trim().toLowerCase().slice(0, 1) || 'u';
    const normalizedUnikey = String(unikey || '').trim().toLowerCase().replace(/\s+/g, '');
    return `P_${age}-${normalizedGender}-${normalizedUnikey}`;
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

    if (!profile.age || !profile.gender || !profile.unikey) {
        throw new Error('缺少年龄、性别或 unikey，无法注册对照组参与者。');
    }

    const payload = {
        age: profile.age,
        gender: profile.gender,
        unikey: profile.unikey,
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

function stopPairedChatPolling() {
    if (window.pairedChatPollingInterval) {
        clearInterval(window.pairedChatPollingInterval);
        window.pairedChatPollingInterval = null;
    }
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

        experimentData.pairedChatHistory.push(message);

        if (message.sender_id !== experimentData.participantId) {
            addChatMessage('ai', message.content);
            experimentData.chatHistory.push({
                timestamp: message.created_at,
                sender: 'ai',
                content: message.content
            });
        }
    });
}

function startPairedChatPolling() {
    stopPairedChatPolling();

    const pollInterval = EXPERIMENT_CONFIG.MATCH_POLL_INTERVAL_MS || 2000;
    window.pairedChatPollingInterval = setInterval(() => {
        refreshPairedMessages().catch(error => {
            console.error('[PAIRED_CHAT] 拉取消息失败:', error);
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
    const roomKey = getParticipantRoomKey(room);
    const roundInfo = room.rounds.find(item => item.round_no === roundNo) || room.rounds[0];
    const isCounselor = roundInfo.counselor_key === roomKey;
    const roleText = isCounselor ? '咨询师' : '来访者';
    const scenarioText = roundInfo.scenario === 'xiaob_low' ? '小B（低风险）' : '小吴（高风险）';
    return `已进入配对房间。当前为第 ${roundNo} 轮，你的角色是${roleText}。本轮脚本场景：${scenarioText}。`;
}

async function initializePairedChat(promptKey) {
    experimentData.chatMode = 'paired';
    experimentData.chatHistory = [];
    experimentData.pairedChatHistory = [];
    experimentData.controlPairing.lastMessageId = 0;

    const messagesDiv = document.getElementById('chatMessages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }

    addChatMessage('ai', '正在连接配对房间，请稍候...');
    setChatComposerEnabled(false);

    await ensureControlParticipantRegistered();
    if (!experimentData.controlPairing.roomId) {
        await waitForMatchReady();
    }

    const room = await fetchRoomState();
    const roundNo = getCurrentControlRoundNumber(promptKey);

    addChatMessage('ai', getControlRoundBrief(room, roundNo));
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

    addChatMessage('user', message);
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

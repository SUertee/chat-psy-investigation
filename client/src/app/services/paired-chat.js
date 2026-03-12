// Paired control-group backend service helpers.
function getBackendBaseUrl() {
    return (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
}

const PAIRED_TYPING_HEARTBEAT_MS = 2500;

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
            const payloadDetail = errorPayload.detail || errorPayload.error || errorPayload;
            detail = (typeof payloadDetail === 'string')
                ? payloadDetail
                : JSON.stringify(payloadDetail);
        } catch (error) {
            // Ignore JSON parse failure and keep the status text.
        }
        throw new Error(detail);
    }

    return response.json();
}

async function registerPairedParticipant() {
    const profile = experimentData.participantProfile || {};
    const age = parseInt(profile.age, 10);
    const gender = String(profile.gender || '').trim();

    if (!Number.isInteger(age) || age < 1 || age > 120 || !gender) {
        throw new Error('被试信息不完整：请先完成前测中的年龄和性别。');
    }

    const payload = {
        age,
        gender,
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

function activateControlTimeoutFallback(promptKey, waitedMs) {
    const fallbackAt = getCurrentTimestamp();
    if (promptKey === 'PRACTICE_1') {
        // 首轮配对超时后，直接切换到实验组，后续练习不再进入配对等待。
        if (experimentData.initialGroup !== 'control') {
            experimentData.initialGroup = experimentData.group || 'control';
        }
        experimentData.group = 'experimental';
    }
    experimentData.chatMode = 'ai';
    experimentData.controlPairing.timeoutFallback = true;
    experimentData.controlPairing.timeoutFallbackReason = 'match_timeout';
    experimentData.controlPairing.timeoutFallbackAt = fallbackAt;
    experimentData.controlPairing.timeoutFallbackPromptKey = promptKey || '';
    experimentData.controlPairing.timeoutFallbackWaitMs = waitedMs;
    experimentData.timestamps.control_match_timeout_fallback_at = fallbackAt;
}

function switchControlParticipantToExperimentalFlow(reason = 'match_timeout') {
    if (experimentData.initialGroup !== 'control') {
        experimentData.initialGroup = experimentData.group || 'control';
    }
    experimentData.group = 'experimental';
    experimentData.chatMode = 'ai';
    experimentData.timestamps.control_to_experimental_switch_at = getCurrentTimestamp();
    experimentData.timestamps.control_to_experimental_switch_reason = reason;
}

async function waitForMatchReady(promptKey) {
    const pollInterval = EXPERIMENT_CONFIG.MATCH_POLL_INTERVAL_MS || 2000;
    const timeoutMs = EXPERIMENT_CONFIG.MATCH_TIMEOUT_MS || 300000;
    const startMs = Date.now();
    let status = await joinMatchQueue();
    if (status.status === 'matched') {
        applyMatchStatus(status);
        experimentData.controlPairing.timeoutFallback = false;
        experimentData.controlPairing.timeoutFallbackReason = '';
        experimentData.controlPairing.timeoutFallbackAt = '';
        experimentData.controlPairing.timeoutFallbackPromptKey = '';
        experimentData.controlPairing.timeoutFallbackWaitMs = 0;
        return status;
    }

    while (Date.now() - startMs < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        status = await fetchMatchStatus();
        if (status.status === 'matched') {
            applyMatchStatus(status);
            experimentData.controlPairing.timeoutFallback = false;
            experimentData.controlPairing.timeoutFallbackReason = '';
            experimentData.controlPairing.timeoutFallbackAt = '';
            experimentData.controlPairing.timeoutFallbackPromptKey = '';
            experimentData.controlPairing.timeoutFallbackWaitMs = 0;
            return status;
        }
    }
    if (promptKey !== 'PRACTICE_1' || experimentData.controlPairing.hasMatchedOnce) {
        throw new Error('当前轮次连接超时，请点击“重试连接”等待另一位参与者。');
    }
    activateControlTimeoutFallback(promptKey, timeoutMs);
    return {
        status: 'fallback_to_experimental',
        waited_ms: timeoutMs
    };
}

function applyMatchStatus(status) {
    experimentData.controlPairing.roomId = status.room_id || '';
    experimentData.controlPairing.partnerId = status.partner_id || '';
    experimentData.controlPairing.roomStatus = status.room_status || status.status || '';
    experimentData.controlPairing.currentRound = status.current_round || 1;
    experimentData.controlPairing.assignedRole = status.role_assignment || '';
    experimentData.controlPairing.hasMatchedOnce = true;
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

async function syncPairedChatStart(roundNo) {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法同步进入会话。');
    }
    return backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/sync-start`,
        {
            method: 'POST',
            body: JSON.stringify({
                participant_id: experimentData.participantId,
                round_no: roundNo
            }),
        }
    );
}

async function leavePairedRoom(reason = 'user_retry') {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        resetControlRoomState();
        return null;
    }

    const roomId = experimentData.controlPairing.roomId;
    try {
        const result = await backendRequest(
            `/rooms/${encodeURIComponent(roomId)}/leave`,
            {
                method: 'POST',
                body: JSON.stringify({ participant_id: experimentData.participantId }),
            }
        );
        return result;
    } finally {
        resetControlRoomState();
    }
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
            title: '来访者脚本',
            identity: '27 岁，男性，大学毕业后自主创业者',
            situation: '创业失败负债',
            stress: `<ul><li><strong>经济：</strong>身无分文，负债 15 万，融资失败，时常有催债人上门。</li><li><strong>家庭：</strong>家人指责并断绝关系，出租屋即将到期。</li><li><strong>心理：</strong>深度挫败感、社会性死亡、极度自我厌恶。</li><li><strong>生理：</strong>严重失眠，两周内体重骤降 5 斤。</li></ul>`,
            crisisDetail: `<div style="background:#fff5f5; padding:12px; border-radius:8px; border:1px solid #feb2b2; line-height:1.7; color:#2d3748; font-size:13px;"><p style="margin: 0 0 8px 0;"><strong>🔴 自杀想法极强（9/10）：</strong>认为解脱是唯一出路，情绪崩溃时出现幻听。</p><p style="margin: 0 0 8px 0;"><strong>📍 具体自杀计划：</strong>非常明确——网购安眠药，选定本周五在出租屋实施。</p><p style="margin: 0 0 8px 0;"><strong>🎯 实施意图极高（8/10）：</strong>认为人生已无转机，已做好最终决定。</p><p style="margin: 0 0 8px 0;"><strong>📦 准备行为充分：</strong>已买药确认剂量；给室友发告别信息；整理个人物品。</p><p style="margin: 0 0 8px 0;"><strong>⚠️ 风险因素：</strong>重大经济挫折；支持系统断裂；近期负性事件集中爆发。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>对女朋友的愧疚；生理怕疼本能；名牌大学毕业，如果去找工作其实能能找到，可以把钱慢慢还上。</p></div>`
        };
    }
    return {
        title: '来访者脚本',
        identity: '17 岁，高二女生，曾品学兼优',
        situation: '寒假在家，期末考试成绩大幅滑坡，排名退步严重。',
        stress: `<ul><li><strong>学业：</strong>注意力难集中，长期失眠，学业吃力。</li><li><strong>家庭：</strong>父母期望极高，因成绩下降而严厉指责。</li><li><strong>心理：</strong>强烈怀疑自己的能力，感到绝望。</li><li><strong>生理：</strong>强烈的头疼和胃疼。</li></ul>`,
        crisisDetail: `<div style="background:#f0fff4; padding:12px; border-radius:8px; border:1px solid #9ae6b4; line-height:1.7; color:#2d3748; font-size:13px;"><p style="margin: 0 0 8px 0;"><strong>🟢 自杀想法中等（6/10）：</strong>觉得很失败，希望睡着了不用再醒来。</p><p style="margin: 0 0 8px 0;"><strong>📍 没有明确的自杀计划：</strong>只是希望痛苦能够停止，没想过真的结束生命。</p><p style="margin: 0 0 8px 0;"><strong>🎯 无明确意图。</strong></p><p style="margin: 0 0 8px 0;"><strong>📦 准备行为：</strong>未采取任何具体自杀准备或实施行为。</p><p style="margin: 0 0 8px 0;"><strong>⚠️ 风险因素：</strong>持续学业压力，缺乏父母支持，身体不适。</p><p style="margin: 0;"><strong>🛡️ 保护因素：</strong>祖父母的关爱；有好友谈心；通过写日记和听音乐平复心情。</p></div>`
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
        <div class="profile-block"><strong>当前处境：</strong>${profile.situation || ''}</div>
        <div class="profile-block"><strong>核心压力来源：</strong>${profile.stress || ''}</div>
        <div class="profile-block"><strong>风险与保护线索：</strong>${profile.crisisDetail || ''}</div>
        <div class="profile-block"><strong>提醒：</strong>请持续以“来访者”角色回应，符合人设，避免一次性抛出全部细节。</div>
    `;
}

function getPairedTypingIndicatorId() {
    return 'pairedTypingIndicator';
}

function setPeerTypingIndicatorVisible(visible) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;

    const indicatorId = getPairedTypingIndicatorId();
    const existing = document.getElementById(indicatorId);
    if (!visible) {
        if (existing) existing.remove();
        return;
    }
    if (existing) return;

    const avatarLabel = experimentData.controlPairing.isCounselor ? '访' : '咨';
    const row = document.createElement('div');
    row.id = indicatorId;
    row.className = 'message-row ai';
    row.innerHTML = `
        <div class="avatar">${avatarLabel}</div>
        <div class="bubble" style="color:#666; font-style:italic;">对方正在输入中...</div>
    `;
    messagesDiv.appendChild(row);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getTypingRoundNo() {
    return experimentData.controlPairing.activeRoundNo || experimentData.controlPairing.currentRound || 1;
}

async function reportPairedTypingStatus(isTyping, force = false) {
    if (
        !experimentData.controlPairing.roomId ||
        !experimentData.participantId ||
        experimentData.chatMode !== 'paired'
    ) {
        return;
    }

    const now = Date.now();
    if (!force) {
        const sameState = experimentData.controlPairing.localIsTyping === isTyping;
        const withinHeartbeat = now - (experimentData.controlPairing.localTypingLastSentAt || 0) < PAIRED_TYPING_HEARTBEAT_MS;
        if (sameState && withinHeartbeat) {
            return;
        }
    }

    const roundNo = getTypingRoundNo();
    await backendRequest(`/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/typing`, {
        method: 'POST',
        body: JSON.stringify({
            participant_id: experimentData.participantId,
            round_no: roundNo,
            is_typing: !!isTyping,
        }),
    });

    experimentData.controlPairing.localIsTyping = !!isTyping;
    experimentData.controlPairing.localTypingLastSentAt = now;
}

function syncLocalTypingStatusFromInput() {
    if (experimentData.chatMode !== 'paired') return;
    const input = document.getElementById('chatInput');
    if (!input || input.disabled) return;
    const hasText = !!input.value.trim();
    reportPairedTypingStatus(hasText).catch(error => {
        console.warn('[PAIRED_CHAT] 轮询同步输入状态失败:', error);
    });
}

function teardownPairedTypingReporter() {
    const handlers = window.pairedTypingHandlers;
    if (handlers && handlers.input) {
        handlers.input.removeEventListener('input', handlers.onInput);
        handlers.input.removeEventListener('blur', handlers.onBlur);
        handlers.input.removeEventListener('focus', handlers.onFocus);
    }
    if (handlers && handlers.heartbeatTimer) {
        clearInterval(handlers.heartbeatTimer);
    }
    window.pairedTypingHandlers = null;

    if (experimentData.controlPairing.localIsTyping) {
        reportPairedTypingStatus(false, true).catch(error => {
            console.warn('[PAIRED_CHAT] 同步停止输入状态失败:', error);
        });
    }
    experimentData.controlPairing.localIsTyping = false;
    experimentData.controlPairing.localTypingLastSentAt = 0;
    experimentData.controlPairing.peerIsTyping = false;
    setPeerTypingIndicatorVisible(false);
}

function setupPairedTypingReporter() {
    teardownPairedTypingReporter();

    const input = document.getElementById('chatInput');
    if (!input) return;

    const onInput = () => {
        const hasText = !!input.value.trim();
        reportPairedTypingStatus(hasText).catch(error => {
            console.warn('[PAIRED_CHAT] 上报输入状态失败:', error);
        });
    };

    const onBlur = () => {
        reportPairedTypingStatus(false, true).catch(error => {
            console.warn('[PAIRED_CHAT] 上报停止输入状态失败:', error);
        });
    };

    const onFocus = () => {
        if (input.value.trim()) {
            reportPairedTypingStatus(true).catch(error => {
                console.warn('[PAIRED_CHAT] 上报输入状态失败:', error);
            });
        }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);
    input.addEventListener('focus', onFocus);

    const heartbeatTimer = setInterval(() => {
        if (document.activeElement === input && input.value.trim()) {
            reportPairedTypingStatus(true).catch(error => {
                console.warn('[PAIRED_CHAT] 输入心跳同步失败:', error);
            });
        }
    }, PAIRED_TYPING_HEARTBEAT_MS);

    window.pairedTypingHandlers = { input, onInput, onBlur, onFocus, heartbeatTimer };
    syncLocalTypingStatusFromInput();
}

async function refreshPeerTypingStatus() {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        return;
    }
    const roundNo = getTypingRoundNo();
    const query = new URLSearchParams({
        participant_id: experimentData.participantId,
        round_no: String(roundNo),
    });
    const status = await backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/typing-status?${query.toString()}`
    );
    const peerIsTyping = !!status.peer_is_typing;
    experimentData.controlPairing.peerIsTyping = peerIsTyping;
    setPeerTypingIndicatorVisible(peerIsTyping);
}

function stopPairedChatPolling() {
    if (window.pairedChatPollingInterval) {
        clearInterval(window.pairedChatPollingInterval);
        window.pairedChatPollingInterval = null;
    }
    teardownPairedTypingReporter();
}

function isRoomNotFoundError(error) {
    const message = String((error && error.message) || '');
    return /room not found/i.test(message);
}

function isParticipantNotRegisteredError(error) {
    const message = String((error && error.message) || '');
    return /participant not registered|participant not found/i.test(message);
}

function getRecoveryPromptKey() {
    if (experimentData.controlPairing.activePromptKey) {
        return experimentData.controlPairing.activePromptKey;
    }
    return (experimentData.controlPairing.activeRoundNo || 1) === 2 ? 'PRACTICE_3' : 'PRACTICE_1';
}

function resetControlRoomState() {
    experimentData.controlPairing.roomId = '';
    experimentData.controlPairing.partnerId = '';
    experimentData.controlPairing.roomStatus = '';
    experimentData.controlPairing.lastMessageId = 0;
    experimentData.controlPairing.roundEnded = false;
    experimentData.controlPairing.peerIsTyping = false;
    setPeerTypingIndicatorVisible(false);
}

async function recoverPairedRoom(reason = 'room_lost') {
    if (experimentData.controlPairing.recoveringRoom) {
        return;
    }

    experimentData.controlPairing.recoveringRoom = true;
    stopPairedChatPolling();
    setChatComposerEnabled(false);
    addChatMessage('system', '检测到配对连接中断，正在尝试自动恢复...');

    const promptKey = getRecoveryPromptKey();
    resetControlRoomState();

    try {
        if (reason === 'participant_missing') {
            experimentData.controlPairing.registered = false;
        }

        try {
            await preparePairedChatSession(promptKey);
        } catch (error) {
            if (!isParticipantNotRegisteredError(error)) {
                throw error;
            }
            experimentData.controlPairing.registered = false;
            await preparePairedChatSession(promptKey);
        }

        mountClientProfilePanel();
        await refreshPairedMessages();
        setChatComposerEnabled(true);
        startPairedChatPolling();
        experimentData.controlPairing.roomLostNotified = false;
        addChatMessage('system', '配对连接已恢复，可以继续聊天。');
    } catch (error) {
        console.error('[PAIRED_CHAT] 自动恢复失败:', error);
        if (!experimentData.controlPairing.roomLostNotified) {
            experimentData.controlPairing.roomLostNotified = true;
            alert('配对房间已失效且自动恢复失败，请刷新页面后重新进入本轮练习。');
        }
    } finally {
        experimentData.controlPairing.recoveringRoom = false;
    }
}

function handlePairedRoomNotFound(error) {
    if (!isRoomNotFoundError(error)) {
        return false;
    }

    recoverPairedRoom('room_lost');
    return true;
}

function handlePairedParticipantMissing(error) {
    if (!isParticipantNotRegisteredError(error)) {
        return false;
    }

    recoverPairedRoom('participant_missing');
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
            setPeerTypingIndicatorVisible(false);
            experimentData.controlPairing.peerIsTyping = false;
            const peerAvatar = message.sender_role === 'counselor' ? '咨' : '访';
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
            runPreFeedbackProbeByRoundNo(roundNo, function() {
                showClientFeedbackModal();
            });
        }
    }
}

function startPairedChatPolling() {
    stopPairedChatPolling();

    const pollInterval = EXPERIMENT_CONFIG.MATCH_POLL_INTERVAL_MS || 2000;
    window.pairedChatPollingInterval = setInterval(() => {
        syncLocalTypingStatusFromInput();
        refreshPairedMessages().catch(error => {
            if (handlePairedRoomNotFound(error) || handlePairedParticipantMissing(error)) return;
            console.error('[PAIRED_CHAT] 拉取消息失败:', error);
        });
        monitorPairedRoundStatus().catch(error => {
            if (handlePairedRoomNotFound(error) || handlePairedParticipantMissing(error)) return;
            console.error('[PAIRED_CHAT] 拉取房间状态失败:', error);
        });
        refreshPeerTypingStatus().catch(error => {
            if (handlePairedRoomNotFound(error) || handlePairedParticipantMissing(error)) return;
            console.error('[PAIRED_CHAT] 拉取输入状态失败:', error);
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

    if (!enabled) {
        teardownPairedTypingReporter();
    }
}

function getControlRoundBrief(room, roundNo) {
    const role = resolveRoundRole(room, roundNo);
    const roleText = role.roleText;
    const scenarioText = role.scenarioText;
    return `已进入配对房间。当前为第 ${roundNo} 轮，你的角色是${roleText}。本轮脚本场景：${scenarioText}。`;
}

async function preparePairedChatSession(promptKey) {
    experimentData.chatMode = 'paired';
    experimentData.controlPairing.roomLostNotified = false;
    experimentData.controlPairing.roundEnded = false;

    if (experimentData.controlPairing.timeoutFallback && !experimentData.controlPairing.hasMatchedOnce) {
        return {
            fallbackToExperimental: true,
            waitedMs: experimentData.controlPairing.timeoutFallbackWaitMs || (EXPERIMENT_CONFIG.MATCH_TIMEOUT_MS || 300000)
        };
    }

    await ensureControlParticipantRegistered();
    if (!experimentData.controlPairing.roomId) {
        if (promptKey !== 'PRACTICE_1') {
            throw new Error('仅首轮允许执行配对等待；当前未找到首轮房间，请刷新后从第一轮重新进入。');
        }
        const matchResult = await waitForMatchReady(promptKey);
        if (matchResult && matchResult.status === 'fallback_to_experimental') {
            return {
                fallbackToExperimental: true,
                waitedMs: matchResult.waited_ms || (EXPERIMENT_CONFIG.MATCH_TIMEOUT_MS || 300000)
            };
        }
    }

    const room = await fetchRoomState();
    const roundNo = getCurrentControlRoundNumber(promptKey);
    experimentData.controlPairing.activeRoundNo = roundNo;

    const role = resolveRoundRole(room, roundNo);
    experimentData.controlPairing.roleInCurrentRound = role.roleText;
    experimentData.controlPairing.isCounselor = role.isCounselor;
    experimentData.controlPairing.activeScenario = role.roundInfo.scenario;
    experimentData.controlPairing.activeProfile = role.profile;
    if (roundNo === 1) {
        experimentData.controlPairing.firstRoundRole = role.roleText;
    } else if (roundNo === 2) {
        experimentData.controlPairing.secondRoundRole = role.roleText;
    }

    return {
        roundNo,
        roleText: role.roleText,
        isCounselor: role.isCounselor
    };
}

async function initializePairedChat(promptKey, options = {}) {
    experimentData.chatMode = 'paired';
    experimentData.chatHistory = [];
    experimentData.controlPairing.roomLostNotified = false;
    experimentData.controlPairing.recoveringRoom = false;
    experimentData.controlPairing.activePromptKey = promptKey;
    experimentData.controlPairing.lastMessageId = 0;
    experimentData.controlPairing.roundEnded = false;

    const messagesDiv = document.getElementById('chatMessages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }

    setChatComposerEnabled(false);

    const hasPreparedRole =
        !!experimentData.controlPairing.roomId &&
        !!experimentData.controlPairing.roleInCurrentRound;
    if (!options.prepared || !hasPreparedRole) {
        const prepareResult = await preparePairedChatSession(promptKey);
        if (prepareResult && prepareResult.fallbackToExperimental) {
            throw new Error('连接等待超时，请继续实验。');
        }
    } else {
        // Refresh room state in case the room changed while waiting.
        await fetchRoomState();
    }
    mountClientProfilePanel();

    setChatComposerEnabled(true);
    setupPairedTypingReporter();
    await refreshPairedMessages();
    await refreshPeerTypingStatus().catch(() => {});
    startPairedChatPolling();
}

async function sendPairedChatMessageFromInput() {
    if (experimentData.controlPairing.recoveringRoom) {
        return;
    }

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
    reportPairedTypingStatus(false, true).catch(error => {
        console.warn('[PAIRED_CHAT] 发送后同步输入状态失败:', error);
    });

    let sent;
    try {
        sent = await backendRequest('/chat/send', {
            method: 'POST',
            body: JSON.stringify({
                room_id: experimentData.controlPairing.roomId,
                participant_id: experimentData.participantId,
                round_no: roundNo,
                content: message
            })
        });
    } catch (error) {
        if (handlePairedRoomNotFound(error) || handlePairedParticipantMissing(error)) {
            return;
        }
        throw error;
    }

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
                relationship_good: payload.relationship_good,
                relationship_improve: payload.relationship_improve,
                risk_good: payload.risk_good,
                risk_improve: payload.risk_improve,
                protective_good: payload.protective_good,
                protective_improve: payload.protective_improve,
                overall_suggestion: payload.overall_suggestion,
            }),
        }
    );
}

async function markPairedCounselorReportSubmitted(roundNo) {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法标记咨询师评估提交。');
    }
    return backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/counselor-report-submitted`,
        {
            method: 'POST',
            body: JSON.stringify({
                participant_id: experimentData.participantId,
                round_no: roundNo,
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

async function markPairedReviewComplete(roundNo) {
    if (!experimentData.controlPairing.roomId || !experimentData.participantId) {
        throw new Error('房间未就绪，无法标记反馈阅读完成。');
    }
    return backendRequest(
        `/rooms/${encodeURIComponent(experimentData.controlPairing.roomId)}/review-complete`,
        {
            method: 'POST',
            body: JSON.stringify({
                participant_id: experimentData.participantId,
                round_no: roundNo,
            }),
        }
    );
}

// Data export helpers.
function saveData() {
    const ts = experimentData.timestamps || {};
    const responses = experimentData.responses || {};
    const control = experimentData.controlPairing || {};
    const now = getCurrentTimestamp();

    const toDate = (value) => {
        if (!value) return null;
        const normalized = String(value).replace(/-/g, '/');
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    };
    const calcDurationSeconds = (start, end) => {
        const s = toDate(start);
        const e = toDate(end);
        if (!s || !e) return '';
        return ((e.getTime() - s.getTime()) / 1000).toFixed(1);
    };
    const safeStringify = (value) => {
        try {
            return JSON.stringify(value ?? null);
        } catch (error) {
            return String(value ?? '');
        }
    };
    const getProbeResponse = (probeKey) => responses[probeKey] || {};
    const getProbeValue = (probeKey, field) => {
        const payload = getProbeResponse(probeKey);
        if (payload == null || typeof payload !== 'object') {
            return '';
        }
        if (field in payload) {
            return payload[field];
        }
        const questionnaireField = `${probeKey}_${field}`;
        if (questionnaireField in payload) {
            return payload[questionnaireField];
        }
        return '';
    };
    const getProbeSubmittedAt = (probeKey) =>
        getProbeValue(probeKey, 'submitted_at') || ts[`${probeKey}_end`] || '';
    const buildDurationMap = (timestamps) => {
        const durationMap = {};
        Object.keys(timestamps || {}).forEach((key) => {
            if (!key.endsWith('_start')) return;
            const baseKey = key.slice(0, -6);
            const endKey = `${baseKey}_end`;
            const duration = calcDurationSeconds(timestamps[key], timestamps[endKey]);
            if (duration !== '') {
                durationMap[`${baseKey}_duration_sec`] = duration;
            }
        });
        return durationMap;
    };

    // ========== 1) 事件长表（便于审计） ==========
    const eventRows = [];
    const addEvent = (category, subCategory, item, value, timeInfo = '') => {
        eventRows.push({
            participant_id: experimentData.participantId || '',
            group: experimentData.group || '',
            category,
            sub_category: subCategory,
            item,
            value: typeof value === 'string' ? value : safeStringify(value),
            time_info: timeInfo
        });
    };

    addEvent('meta', 'participant', 'start_time', experimentData.startTime || '');
    addEvent('meta', 'participant', 'end_time', ts.end || now);
    addEvent('meta', 'participant', 'group', experimentData.group || '');
    addEvent('meta', 'participant', 'initial_group', experimentData.initialGroup || '');
    addEvent('meta', 'participant', 'split_half_order', experimentData.splitHalfOrder || '');
    addEvent('meta', 'participant', 'age', experimentData.participantProfile?.age ?? '');
    addEvent('meta', 'participant', 'gender', experimentData.participantProfile?.gender ?? '');
    const firstRole = control.firstRoundRole || (experimentData.group === 'experimental' ? '咨询师' : '');
    const secondRole = control.secondRoundRole || (experimentData.group === 'experimental' ? '咨询师' : '');
    addEvent('meta', 'group_flow', 'first_round_role', firstRole);
    addEvent('meta', 'group_flow', 'second_round_role', secondRole);
    addEvent('meta', 'group_flow', 'control_timeout_fallback', control.timeoutFallback ? '1' : '0');
    addEvent('meta', 'group_flow', 'control_timeout_fallback_reason', control.timeoutFallbackReason || '');
    addEvent('meta', 'group_flow', 'control_timeout_fallback_at', control.timeoutFallbackAt || '');
    addEvent('meta', 'group_flow', 'control_timeout_fallback_prompt_key', control.timeoutFallbackPromptKey || '');
    addEvent('meta', 'group_flow', 'control_timeout_fallback_wait_ms', control.timeoutFallbackWaitMs || '');
    ['probe1', 'probe2', 'probe3', 'probe4', 'probe5', 'probe6'].forEach((probeKey) => {
        addEvent('probe', probeKey, 'confidence', getProbeValue(probeKey, 'confidence'));
        addEvent('probe', probeKey, 'tension', getProbeValue(probeKey, 'tension'));
        addEvent('probe', probeKey, 'submitted_at', getProbeSubmittedAt(probeKey));
    });

    // 对话记录（AI）
    ['PRACTICE_1', 'PRACTICE_3', 'SECOND_CLIENT'].forEach((key) => {
        const chats = (experimentData.allPracticeChats && experimentData.allPracticeChats[key]) || [];
        chats.forEach((msg, idx) => {
            addEvent('chat_ai', key, `${idx + 1}_${msg.sender || ''}`, msg.content || '', msg.timestamp || '');
        });
    });

    // 对话记录（配对）
    (experimentData.pairedChatHistory || []).forEach((msg, idx) => {
        addEvent('chat_paired', `round_${msg.round_no || ''}`, `${idx + 1}_${msg.sender_role || ''}`, msg.content || '', msg.created_at || '');
    });

    // 风险评估（AI练习）
    (responses.practice_assessments || []).forEach((item, idx) => {
        addEvent('risk_assessment', 'ai_practice', `assessment_${idx + 1}_level`, item.level || '', item.timestamp || '');
        addEvent('risk_assessment', 'ai_practice', `assessment_${idx + 1}_reason`, item.reason || '', '');
    });

    // 对照组咨询师记录 + 来访者反馈
    (responses.counselor_records || []).forEach((item, idx) => {
        addEvent('risk_assessment', 'control_counselor_record', `record_${idx + 1}`, item, item.timestamp || '');
    });
    (responses.client_feedbacks || []).forEach((item, idx) => {
        addEvent('peer_feedback', 'control_client_feedback', `feedback_${idx + 1}`, item, item.timestamp || '');
    });

    // AI督导反馈
    addEvent('ai_feedback', 'supervisor', 'full_text', experimentData.supervisorFeedback || '');

    // 问卷（完整保存）
    Object.entries(responses).forEach(([phase, payload]) => {
        if (payload == null) return;
        addEvent('questionnaire', phase, 'raw', payload);
    });

    // ========== 2) 单行宽表（便于后续 Python 合并） ==========
    const wideRow = {
        participant_id: experimentData.participantId || '',
        group: experimentData.group || '',
        initial_group: experimentData.initialGroup || '',
        control_timeout_fallback: control.timeoutFallback ? 1 : 0,
        control_timeout_fallback_reason: control.timeoutFallbackReason || '',
        control_timeout_fallback_at: control.timeoutFallbackAt || '',
        control_timeout_fallback_prompt_key: control.timeoutFallbackPromptKey || '',
        control_timeout_fallback_wait_ms: control.timeoutFallbackWaitMs || '',
        age: experimentData.participantProfile?.age ?? '',
        gender: experimentData.participantProfile?.gender ?? '',
        split_half_order: experimentData.splitHalfOrder || '',
        pretest_half: experimentData.splitHalfOrder === 'BA' ? 'B' : 'A',
        posttest_half: experimentData.splitHalfOrder === 'BA' ? 'A' : 'B',
        first_round_role: firstRole,
        second_round_role: secondRole,

        experiment_start_time: experimentData.startTime || '',
        experiment_end_time: ts.end || now,

        pretest_start: ts.pretest_start || '',
        pretest_end: ts.pretest_end || '',
        pretest_duration_sec: calcDurationSeconds(ts.pretest_start, ts.pretest_end),
        posttest_start: ts.posttest_start || '',
        posttest_end: ts.posttest_end || '',
        posttest_duration_sec: calcDurationSeconds(ts.posttest_start, ts.posttest_end),

        practice1_start: ts.PRACTICE_1_start || '',
        practice1_end: ts.PRACTICE_1_end || '',
        practice1_duration_sec: calcDurationSeconds(ts.PRACTICE_1_start, ts.PRACTICE_1_end),
        practice3_start: ts.PRACTICE_3_start || '',
        practice3_end: ts.PRACTICE_3_end || '',
        practice3_duration_sec: calcDurationSeconds(ts.PRACTICE_3_start, ts.PRACTICE_3_end),
        second_client_start: ts.second_practice_start || ts.SECOND_CLIENT_start || '',
        second_client_end: ts.second_practice_end || ts.SECOND_CLIENT_end || '',
        second_client_duration_sec: calcDurationSeconds(ts.second_practice_start || ts.SECOND_CLIENT_start, ts.second_practice_end || ts.SECOND_CLIENT_end),

        ai_risk_form_start: ts.ai_risk_assessment_form_start || '',
        ai_risk_form_end: ts.ai_risk_assessment_form_end || '',
        ai_risk_form_duration_sec: calcDurationSeconds(ts.ai_risk_assessment_form_start, ts.ai_risk_assessment_form_end),

        counselor_record_round1_start: ts.control_counselor_record_round_1_start || '',
        counselor_record_round1_end: ts.control_counselor_record_round_1_end || '',
        counselor_record_round1_duration_sec: calcDurationSeconds(ts.control_counselor_record_round_1_start, ts.control_counselor_record_round_1_end),
        counselor_record_round2_start: ts.control_counselor_record_round_2_start || '',
        counselor_record_round2_end: ts.control_counselor_record_round_2_end || '',
        counselor_record_round2_duration_sec: calcDurationSeconds(ts.control_counselor_record_round_2_start, ts.control_counselor_record_round_2_end),

        client_feedback_round1_start: ts.control_client_feedback_round_1_start || '',
        client_feedback_round1_end: ts.control_client_feedback_round_1_end || '',
        client_feedback_round1_duration_sec: calcDurationSeconds(ts.control_client_feedback_round_1_start, ts.control_client_feedback_round_1_end),
        client_feedback_round2_start: ts.control_client_feedback_round_2_start || '',
        client_feedback_round2_end: ts.control_client_feedback_round_2_end || '',
        client_feedback_round2_duration_sec: calcDurationSeconds(ts.control_client_feedback_round_2_start, ts.control_client_feedback_round_2_end),

        pretest_json: safeStringify(responses.pretest || {}),
        posttest_json: safeStringify(responses.posttest || {}),
        questionnaire3_json: safeStringify(responses.questionnaire3 || {}),
        questionnaire4_json: safeStringify(responses.questionnaire4 || {}),

        probe1_confidence: getProbeValue('probe1', 'confidence'),
        probe1_tension: getProbeValue('probe1', 'tension'),
        probe1_submitted_at: getProbeSubmittedAt('probe1'),
        probe2_confidence: getProbeValue('probe2', 'confidence'),
        probe2_tension: getProbeValue('probe2', 'tension'),
        probe2_submitted_at: getProbeSubmittedAt('probe2'),
        probe3_confidence: getProbeValue('probe3', 'confidence'),
        probe3_tension: getProbeValue('probe3', 'tension'),
        probe3_submitted_at: getProbeSubmittedAt('probe3'),
        probe4_confidence: getProbeValue('probe4', 'confidence'),
        probe4_tension: getProbeValue('probe4', 'tension'),
        probe4_submitted_at: getProbeSubmittedAt('probe4'),
        probe5_confidence: getProbeValue('probe5', 'confidence'),
        probe5_tension: getProbeValue('probe5', 'tension'),
        probe5_submitted_at: getProbeSubmittedAt('probe5'),
        probe6_confidence: getProbeValue('probe6', 'confidence'),
        probe6_tension: getProbeValue('probe6', 'tension'),
        probe6_submitted_at: getProbeSubmittedAt('probe6'),

        ai_chat_practice1_json: safeStringify((experimentData.allPracticeChats && experimentData.allPracticeChats.PRACTICE_1) || []),
        ai_chat_practice3_json: safeStringify((experimentData.allPracticeChats && experimentData.allPracticeChats.PRACTICE_3) || []),
        ai_chat_second_client_json: safeStringify((experimentData.allPracticeChats && experimentData.allPracticeChats.SECOND_CLIENT) || []),
        paired_chat_json: safeStringify(experimentData.pairedChatHistory || []),
        tutor_chat_json: safeStringify(experimentData.tutorChatHistory || []),

        ai_practice_assessments_json: safeStringify(responses.practice_assessments || []),
        control_counselor_records_json: safeStringify(responses.counselor_records || []),
        control_client_feedbacks_json: safeStringify(responses.client_feedbacks || []),
        scripted_simulation_json: safeStringify(responses.scripted_simulation || []),
        ai_supervisor_feedback_text: experimentData.supervisorFeedback || '',

        full_timestamps_json: safeStringify(ts),
        full_responses_json: safeStringify(responses),
        full_control_pairing_json: safeStringify(control)
    };

    const jsPsychRawData = (() => {
        try {
            if (typeof jsPsych !== 'undefined' && jsPsych && jsPsych.data && jsPsych.data.get) {
                return jsPsych.data.get().values();
            }
        } catch (error) {
            console.warn('读取 jsPsych 原始数据失败:', error);
        }
        return [];
    })();

    const resultSnapshot = {
        schema_version: 'v1',
        saved_at: now,
        participant_id: experimentData.participantId || '',
        file_name: `participant_${experimentData.participantId || 'unknown'}_${now.replace(/[^\d]/g, '').slice(0, 14)}.json`,
        meta: {
            group: experimentData.group || '',
            initial_group: experimentData.initialGroup || '',
            control_timeout_fallback: !!control.timeoutFallback,
            control_timeout_fallback_reason: control.timeoutFallbackReason || '',
            control_timeout_fallback_at: control.timeoutFallbackAt || '',
            control_timeout_fallback_prompt_key: control.timeoutFallbackPromptKey || '',
            control_timeout_fallback_wait_ms: control.timeoutFallbackWaitMs || null,
            age: experimentData.participantProfile?.age ?? null,
            gender: experimentData.participantProfile?.gender ?? '',
            split_half_order: experimentData.splitHalfOrder || '',
            user_agent: navigator.userAgent || '',
            language: navigator.language || '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            screen: {
                width: window.screen ? window.screen.width : null,
                height: window.screen ? window.screen.height : null
            },
            viewport: {
                width: window.innerWidth || null,
                height: window.innerHeight || null
            }
        },
        timestamps: ts,
        durations: buildDurationMap(ts),
        responses,
        chat_records: {
            ai_practice_chats: experimentData.allPracticeChats || {},
            paired_chat_history: experimentData.pairedChatHistory || [],
            tutor_chat_history: experimentData.tutorChatHistory || [],
            current_chat_history: experimentData.chatHistory || []
        },
        risk_assessment: {
            ai_practice_assessments: responses.practice_assessments || [],
            control_counselor_records: responses.counselor_records || [],
            control_client_feedbacks: responses.client_feedbacks || [],
            crisis_assessment: experimentData.crisisAssessment || {}
        },
        ai_feedback: {
            supervisor_feedback: experimentData.supervisorFeedback || ''
        },
        control_pairing: control,
        event_log_rows: eventRows,
        participant_wide_row: wideRow,
        jspsych_raw_trials: jsPsychRawData
    };

    // ========== 3) 导出 ==========
    const workbook = XLSX.utils.book_new();

    const eventSheet = XLSX.utils.json_to_sheet(eventRows);
    eventSheet['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 52 }, { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(workbook, eventSheet, 'event_log');

    const wideSheet = XLSX.utils.json_to_sheet([wideRow]);
    XLSX.utils.book_append_sheet(workbook, wideSheet, 'participant_wide');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `participant_${experimentData.participantId || 'unknown'}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    uploadToServer(blob, fileName);
    uploadExcelToLocalResult(blob, fileName, experimentData.participantId || '');
    uploadResultSnapshot(resultSnapshot);
}

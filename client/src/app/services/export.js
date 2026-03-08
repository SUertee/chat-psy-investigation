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
    addEvent('meta', 'participant', 'split_half_order', experimentData.splitHalfOrder || '');
    addEvent('meta', 'participant', 'age', experimentData.participantProfile?.age ?? '');
    addEvent('meta', 'participant', 'gender', experimentData.participantProfile?.gender ?? '');
    const firstRole = control.firstRoundRole || (experimentData.group === 'experimental' ? '咨询师' : '');
    const secondRole = control.secondRoundRole || (experimentData.group === 'experimental' ? '咨询师' : '');
    addEvent('meta', 'group_flow', 'first_round_role', firstRole);
    addEvent('meta', 'group_flow', 'second_round_role', secondRole);

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
}

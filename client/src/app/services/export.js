// Data export helpers.
function saveData() {
    let allDataRows = [];

    // 辅助函数：添加一行数据
    function addRow(category, subCategory, item, value, timeInfo = '') {
        allDataRows.push({
            '被试ID': experimentData.participantId,
            '分组': experimentData.group === 'experimental' ? '实验组(AI)' : '对照组(脚本)',
            '数据大类': category,
            '数据子类': subCategory,
            '条目/角色': item,
            '内容/数值': value,
            '时间戳/时长': timeInfo
        });
    }

    // --- 1. 基础信息 ---
    addRow('基本信息', '元数据', '开始实验时间', experimentData.startTime);
    addRow('基本信息', '元数据', '结束实验时间', experimentData.timestamps.end || getCurrentTimestamp());
    
    // --- 2. 耗时统计 (自动计算各阶段时长) ---
    // 辅助函数：计算两个时间戳的秒数差
    function calcDuration(startStr, endStr) {
        if (!startStr || !endStr) return '';
        const start = new Date(startStr.replace(/-/g, "/")); // 兼容性替换
        const end = new Date(endStr.replace(/-/g, "/"));
        const diff = (end - start) / 1000; // 秒
        return diff.toFixed(1) + '秒';
    }

    // 遍历 timestamps 计算时长
    const phases = [
        { key: 'pretest', name: '前测问卷' },
        { key: 'video', name: '视频学习' }, // 注意：视频只有 start，end 在 finishVideo
        { key: 'tutor', name: 'AI Tutor答疑' },
        { key: 'practice_1', name: '练习一' },
        { key: 'practice_3', name: '练习三' },
        { key: 'posttest', name: '后测问卷' },
        { key: 'second_practice', name: '二次练习' },
        { key: 'crisis_assessment', name: '危机评估' },
        { key: 'supervisor_feedback', name: 'AI督导' },
        { key: 'questionnaire3', name: '最终问卷' }
    ];

    phases.forEach(p => {
        const start = experimentData.timestamps[p.key + '_start'];
        const end = experimentData.timestamps[p.key + '_end'] || experimentData.timestamps[p.key + '_submit']; // 兼容 submit
        
        if (start) addRow('时间戳', p.name, '开始时间', start);
        if (end) addRow('时间戳', p.name, '结束时间', end);
        if (start && end) {
            addRow('耗时分析', p.name, '总耗时', calcDuration(start, end));
        }
    });

    // --- 3. 问卷数据 (保留你满意的部分) ---
    if (experimentData.responses) {
        Object.entries(experimentData.responses).forEach(([phaseName, answers]) => {
            // 跳过脚本模拟数据，后面单独处理
            if (phaseName === 'scripted_simulation') return; 
            if (phaseName === 'personal_info') return; // 单独处理或合并

            if (typeof answers === 'object') {
                Object.entries(answers).forEach(([qId, val]) => {
                    // 如果是对象（例如 scenario题的评分），转字符串
                    const valStr = typeof val === 'object' ? JSON.stringify(val) : val;
                    addRow('问卷数据', phaseName, qId, valStr);
                });
            }
        });
        
        // 单独保存个人信息
        if (experimentData.responses.personal_info) {
             Object.entries(experimentData.responses.personal_info).forEach(([k, v]) => {
                 addRow('基本信息', '个人信息', k, v);
             });
        }
    }

    // --- 4. 危机评估数据 (之前遗漏的) ---
    if (experimentData.crisisAssessment && experimentData.crisisAssessment.level) {
        addRow('危机评估', '二次练习后', '评估等级', experimentData.crisisAssessment.level);
        addRow('危机评估', '二次练习后', '评估理由', experimentData.crisisAssessment.reason);
    }

    // --- 5. 对话记录：AI Tutor (之前遗漏的) ---
    if (experimentData.tutorChatHistory && experimentData.tutorChatHistory.length > 0) {
        experimentData.tutorChatHistory.forEach((msg, index) => {
            // 跳过 system prompt
            if (msg.role === 'system') return; 
            // 简单添加序号保持顺序
            const roleLabel = msg.role === 'user' ? '学员(User)' : 'AI Tutor';
            addRow('对话记录', 'AI_Tutor', `${index}_${roleLabel}`, msg.content);
        });
    }

    // --- 6. 对话记录：实验组的所有练习 (之前遗漏的) ---
// --- 2. 对话记录保存 (修正 Key 值以匹配你的 config) ---
    // 注意：小陆已删，这里只保留你实际运行的三个练习 ID
    const practiceKeys = ['PRACTICE_1', 'PRACTICE_3', 'SECOND_CLIENT']; 
    practiceKeys.forEach(pkey => {
        const chats = experimentData.allPracticeChats[pkey];
        if (chats && chats.length > 0) {
            chats.forEach((msg, index) => {
                const senderLabel = msg.sender === 'user' ? '咨询师(User)' : '虚拟来访者(AI)';
                addRow('对话记录', pkey, `${index}_${senderLabel}`, msg.content, msg.timestamp);
            });
        }
    });

    // --- 3. 核心修复：保存每次练习后的危机评估 (定级 + 理由) ---
    // 对应你在 handleModalAssessmentSubmit 中保存的 practice_assessments 数组
    if (experimentData.responses.practice_assessments && experimentData.responses.practice_assessments.length > 0) {
        experimentData.responses.practice_assessments.forEach((assess, index) => {
            // 根据你的练习顺序自动打标签
            let stageLabel = "";
            if (index === 0) stageLabel = "练习一(小B)评估";
            else if (index === 1) stageLabel = "练习三(小吴)评估";
            else if (index === 2) stageLabel = "后测练习(小C)评估";
            else stageLabel = `第${index + 1}次练习评估`;

            addRow('过程评估', stageLabel, '被试判定等级', assess.level, assess.timestamp);
            addRow('过程评估', stageLabel, '判定理由', assess.reason);
        });
    }
    // --- 7. 脚本选择记录：对照组 (增强版) ---
    if (experimentData.group === 'control' && experimentData.responses.scripted_simulation) {
        // 按时间顺序遍历每一次点击
        experimentData.responses.scripted_simulation.forEach((step, index) => {
            
            // 1. 智能判断是哪个练习阶段 (根据 config.js 的命名规则)
            let sessionName = '练习一(小B)'; // 默认
            if (step.node_id && step.node_id.includes('LU_')) sessionName = '练习二(小陆)';
            if (step.node_id && step.node_id.includes('WU_')) sessionName = '练习三(小吴)';

            // 2. 格式化序号，保证Excel里排序整齐 (例如 01, 02...)
            const stepNum = String(index + 1).padStart(2, '0');
            
            // 3. 第一行：记录【用户选了什么】
            // 格式：[节点ID] 用户选择: ... (结果类型)
            const choiceContent = `【选择】: ${step.user_choice_text}  (类型: ${step.outcome_type})`;
            addRow('脚本交互', sessionName, `${stepNum}_节点:${step.node_id}_选择`, choiceContent, step.timestamp);

            // 4. 第二行：记录【系统的反馈/AI的话】(如果有)
            // 这样你就能看到被试选了这个选项后，看到了什么
            if (step.ai_response) {
                addRow('脚本交互', sessionName, `${stepNum}_节点:${step.node_id}_反馈`, step.ai_response);
            }
        });
    }
    // --- 8. AI督导反馈 (之前遗漏的) ---
    if (experimentData.supervisorFeedback) {
        addRow('督导反馈', 'AI生成', '完整内容', experimentData.supervisorFeedback);
    }

    // ===== 导出 Excel =====
    // 创建 WorkBook
    const workbook = XLSX.utils.book_new();
    // 创建 WorkSheet
    const worksheet = XLSX.utils.json_to_sheet(allDataRows);
    
    // 设置列宽 (可选，让Excel打开更好看)
    const wscols = [
        {wch: 20}, // ID
        {wch: 10}, // 分组
        {wch: 15}, // 大类
        {wch: 15}, // 子类
        {wch: 25}, // 条目
        {wch: 50}, // 内容 (宽一点)
        {wch: 20}  // 时间
    ];
    worksheet['!cols'] = wscols;

    // 添加 Sheet (只用这一个Sheet)
    XLSX.utils.book_append_sheet(workbook, worksheet, '完整实验数据');

    // 导出文件
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const fileName = `完整数据_${experimentData.participantId}.xlsx`;
    
    // 下载
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    
    // 上传 (复用原有逻辑)
    uploadToServer(blob, fileName);
}

// Assessment and follow-up questionnaire trials.
function createCrisisAssessmentTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="crisis-assessment">
                <h2>危机等级评估</h2>
                <p>基于您与AI虚拟来访者的对话，请评估其危机等级：</p>
                
                <div class="crisis-level">
                    <label>
                        <input type="radio" name="crisis_level" value="high" required>
                        高风险
                    </label>
                    <label>
                        <input type="radio" name="crisis_level" value="medium" required>
                        中风险
                    </label>
                    <label>
                        <input type="radio" name="crisis_level" value="low" required>
                        低风险
                    </label>
                </div>
                
                <p>请给出您的评级理由：</p>
                <textarea id="crisis_reason" placeholder="请输入您的评估理由..." required></textarea>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="jspsych-btn" onclick="submitCrisisAssessment()">提交评估</button>
                </div>
            </div>
        `,
        choices: [],
        on_load: function() {
            updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.crisis_assessment);
            experimentData.timestamps.crisis_assessment_start = getCurrentTimestamp();
        }
    };
}

function submitCrisisAssessment() {
    const crisisLevel = document.querySelector('input[name="crisis_level"]:checked');
    const crisisReason = document.getElementById('crisis_reason').value;
    
    if (!crisisLevel || !crisisReason.trim()) {
        alert('请完成所有评估项目');
        return;
    }
    
    experimentData.crisisAssessment = {
        level: crisisLevel.value,
        reason: crisisReason,
        timestamp: getCurrentTimestamp()
    };
    
    experimentData.timestamps.crisis_assessment_submit = getCurrentTimestamp();
    jsPsych.finishTrial();
}

// ===== 第三次问卷 =====
function createQuestionnaire3() {
    return createQuestionnaireTrial('questionnaire3', QUESTIONNAIRES.questionnaire3);
}

// ===== AI督导反馈 =====
// experiment.js - 请替换 createAISupervisorTrial 函数
function createQuestionnaire4() {
    return createQuestionnaireTrial('questionnaire4', QUESTIONNAIRES.questionnaire4);
}

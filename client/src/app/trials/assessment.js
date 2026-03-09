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

function createProbeTrial(probeKey) {
    return createQuestionnaireTrial(probeKey, {
        title: '简短状态问卷',
        pages: [
            {
                title: '请根据你此刻的真实感受作答',
                questions: [
                    {
                        id: `${probeKey}_confidence`,
                        type: 'slider_9',
                        text: '我有信心对来访者的自杀风险进行评估。',
                        labels: ['1', '9'],
                        required: true
                    },
                    {
                        id: `${probeKey}_tension`,
                        type: 'slider_9',
                        text: '此刻想到要进行自杀风险评估，我感到紧张。',
                        labels: ['1', '9'],
                        required: true
                    }
                ]
            }
        ]
    });
}

function getProbePairByPracticeType(practiceType) {
    if (practiceType === 'P2') {
        return { preFeedback: 'probe5', postFeedback: 'probe6' };
    }
    return { preFeedback: 'probe3', postFeedback: 'probe4' };
}

function getProbePairByPromptKey(promptKey) {
    if (promptKey === 'SECOND_CLIENT') {
        return null;
    }
    if (promptKey === 'PRACTICE_3') {
        return getProbePairByPracticeType('P2');
    }
    return getProbePairByPracticeType('P1');
}

function getProbePairByRoundNo(roundNo) {
    return roundNo === 2 ? getProbePairByPracticeType('P2') : getProbePairByPracticeType('P1');
}

function ensureProbeOverlayStyle() {
    if (document.getElementById('probeOverlayStyle')) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'probeOverlayStyle';
    style.innerHTML = `
        .probe-overlay {
            position: fixed;
            inset: 0;
            z-index: 10050;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: "Microsoft YaHei", sans-serif;
        }
        .probe-card {
            width: min(720px, 92vw);
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
            padding: 26px 28px;
            color: #2d3748;
        }
        .probe-item {
            margin-top: 18px;
            padding: 14px 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
        }
        .probe-item label {
            display: block;
            margin-bottom: 10px;
            line-height: 1.7;
            font-weight: 600;
        }
        .probe-item input[type="range"] {
            width: 100%;
        }
        .probe-scale-row {
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #718096;
        }
        .probe-values {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            color: #1a365d;
            font-weight: 700;
            font-size: 14px;
        }
        .probe-submit {
            margin-top: 24px;
            width: 100%;
            border: none;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 16px;
            cursor: pointer;
            background: #2b6cb0;
            color: #fff;
        }
        .probe-submit:hover {
            background: #2c5282;
        }
    `;
    document.head.appendChild(style);
}

function showInlineProbe(probeKey, done) {
    if (!probeKey) {
        done();
        return;
    }

    if (experimentData.responses && experimentData.responses[probeKey]) {
        done();
        return;
    }

    if (document.getElementById('probeOverlay')) {
        done();
        return;
    }

    ensureProbeOverlayStyle();
    experimentData.timestamps[`${probeKey}_start`] = getCurrentTimestamp();

    const overlay = document.createElement('div');
    overlay.id = 'probeOverlay';
    overlay.className = 'probe-overlay';
    overlay.innerHTML = `
        <div class="probe-card">
            <h3 style="margin:0; color:#1a365d;">简短状态问卷</h3>
            <p style="margin:8px 0 0 0; color:#4a5568;">请根据你此刻的真实感受作答（1-9分）。</p>

            <div class="probe-item">
                <label for="probeConfidence">我有信心对来访者的自杀风险进行评估。</label>
                <input id="probeConfidence" type="range" min="1" max="9" step="1" value="5">
                <div class="probe-scale-row"><span>1</span><span>9</span></div>
            </div>

            <div class="probe-item">
                <label for="probeTension">此刻想到要进行自杀风险评估，我感到紧张。</label>
                <input id="probeTension" type="range" min="1" max="9" step="1" value="5">
                <div class="probe-scale-row"><span>1</span><span>9</span></div>
            </div>

            <div class="probe-values">
                <span>信心：<span id="probeConfidenceValue">5</span></span>
                <span>紧张：<span id="probeTensionValue">5</span></span>
            </div>

            <button class="probe-submit" id="probeSubmitBtn" type="button">提交并继续</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const confidenceInput = document.getElementById('probeConfidence');
    const tensionInput = document.getElementById('probeTension');
    const confidenceValue = document.getElementById('probeConfidenceValue');
    const tensionValue = document.getElementById('probeTensionValue');

    confidenceInput.addEventListener('input', function() {
        confidenceValue.textContent = confidenceInput.value;
    });
    tensionInput.addEventListener('input', function() {
        tensionValue.textContent = tensionInput.value;
    });

    document.getElementById('probeSubmitBtn').addEventListener('click', function() {
        experimentData.responses[probeKey] = {
            confidence: Number(confidenceInput.value),
            tension: Number(tensionInput.value),
            submitted_at: getCurrentTimestamp(),
        };
        experimentData.timestamps[`${probeKey}_end`] = getCurrentTimestamp();
        overlay.remove();
        done();
    });
}

function runPreFeedbackProbeByPromptKey(promptKey, done) {
    const pair = getProbePairByPromptKey(promptKey);
    if (!pair) {
        done();
        return;
    }
    showInlineProbe(pair.preFeedback, done);
}

function runPostFeedbackProbeByPracticeType(practiceType, done) {
    const pair = getProbePairByPracticeType(practiceType);
    showInlineProbe(pair.postFeedback, done);
}

function runPreFeedbackProbeByRoundNo(roundNo, done) {
    const pair = getProbePairByRoundNo(roundNo);
    showInlineProbe(pair.preFeedback, done);
}

function runPostFeedbackProbeByRoundNo(roundNo, done) {
    const pair = getProbePairByRoundNo(roundNo);
    showInlineProbe(pair.postFeedback, done);
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

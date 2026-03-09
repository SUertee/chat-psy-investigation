// Grouping and baseline questionnaire trials.
function createGroupingTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        // 修改内容为简单的欢迎和继续按钮
        stimulus: `
            <h2>感谢你愿意参与本次实验</h2>
            <p>点击下方按钮继续，您将开始填写个人信息和前测问卷。</p>
        `,
        choices: ['进入实验'],
        on_load: function() {
            // 在此阶段执行随机分组，保证分组在个人信息收集前完成
           updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.grouping);
            experimentData.timestamps.grouping_start = getCurrentTimestamp();
        },
        // on_finish 可以留空，因为 performRandomGrouping() 已经完成了分组
    };
}

function createProcedureInstructionTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <style>
                .inst-container {
                    max-width: 800px;
                    margin: 0 auto;
                    text-align: left;
                    font-family: "Microsoft YaHei", sans-serif;
                    color: #2c3e50;
                    line-height: 1.6;
                }
                .inst-title {
                    text-align: center;
                    color: #1a73e8;
                    font-size: 28px;
                    margin-bottom: 30px;
                }
                /* 流程步骤条样式 */
                .flow-path {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8f9fa;
                    padding: 25px 15px;
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    margin-bottom: 35px;
                    position: relative;
                }
                .flow-step {
                    flex: 1;
                    text-align: center;
                    position: relative;
                    font-size: 14px;
                    font-weight: bold;
                }
                .flow-step:not(:last-child)::after {
                    content: '→';
                    position: absolute;
                    right: -10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #bdc3c7;
                    font-size: 18px;
                }
                .step-time {
                    display: block;
                    font-weight: normal;
                    font-size: 12px;
                    color: #7f8c8d;
                    margin-top: 5px;
                }
                /* 注意事项卡片 */
                .notice-card {
                    background: #fff;
                    border-radius: 8px;
                    border-left: 5px solid #f39c12;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    padding: 20px 30px;
                }
                .notice-card h3 {
                    margin-top: 0;
                    color: #e67e22;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .notice-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .notice-list li {
                    margin-bottom: 12px;
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                }
                .notice-list li::before {
                    content: '📍';
                }
                .progress-hint {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 14px;
                    color: #666;
                    background: #e8f0fe;
                    padding: 10px;
                    border-radius: 20px;
                }
            </style>

            <div class="inst-container">
                <h2 class="inst-title">实验流程说明</h2>
                
                <p>为了帮助您更好地完成接下来的学习与练习，请了解以下实验流程：</p>
                
                <div class="flow-path">
                    <div class="flow-step">问卷填写 1</div>
                    <div class="flow-step">视频学习</div>
                    <div class="flow-step">AI 答疑</div>
                    <div class="flow-step">模拟练习</div>
                    <div class="flow-step">问卷填写 2</div>
                    <div class="flow-step">再次模拟练习</div>
                    <div class="flow-step">简短问卷</div>
                </div>

                <div class="notice-card">
                    <h3>⚠️ 实验注意事项</h3>
                    <ul class="notice-list">
                        <li>整个实验大约耗时 <strong>90分钟</strong>，过程中请保持环境安静；</li>
                        <li>如果在实验过程中有任何疑问或技术问题，请<strong>随时举手向主试示意</strong>；</li>
                        <li>实验期间请务必<strong>关注自己的电脑屏幕</strong>，请勿与其他参与者交流或观看他人屏幕。</li>
                        <li><strong><span style="white-space: nowrap;">推荐使用 Edge 或 Chrome 浏览器</span></strong>；请勿使用微信内置浏览器或 Safari。实验时请将页面全屏打开，过程中不要切屏。</li>
                        <li>实验最后会弹出文件下载按钮，请务必选择<strong>保存</strong>。</li>

                    </ul>
                </div>

                <div class="progress-hint">
                    💡 提示：实验界面右上角设有<strong>实时进度环</strong>，方便您预估剩余时间。
                </div>
            </div>
        `,
        choices: ['我已了解，开始实验'],
        button_html: '<button class="jspsych-btn" style="padding: 12px 50px; background-color: #1a73e8; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; transition: 0.3s; margin-top: 30px;">%choice%</button>',
        on_load: function() {
            experimentData.timestamps.procedure_instruction_start = getCurrentTimestamp();
        }
    };
}

async function assignGroupBySequenceCC2E1() {
    const base = (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
    if (!base) {
        throw new Error('BACKEND_BASE_URL 未配置，无法按顺序分组。');
    }
    const response = await fetch(`${base}/grouping/assign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ strategy: 'cc2e1' })
    });
    if (!response.ok) {
        let detail = response.statusText;
        try {
            const payload = await response.json();
            detail = payload.detail || payload.error || JSON.stringify(payload);
        } catch (error) {
            // Ignore parse error and keep status text.
        }
        throw new Error(detail || '分组接口调用失败');
    }
    return response.json();
}

async function performRandomGrouping() {
    // 检查是否有强制分组设置
    if (typeof GROUP_MODE !== 'undefined' && GROUP_MODE !== 'random' && GROUP_MODE !== 'cc2e1') {
        experimentData.group = GROUP_MODE;
    } else if (GROUP_MODE === 'cc2e1') {
        try {
            const assigned = await assignGroupBySequenceCC2E1();
            experimentData.group = assigned.group;
            experimentData.responses.grouping_sequence = assigned;
            experimentData.timestamps.grouping_sequence_assigned = getCurrentTimestamp();
        } catch (error) {
            console.warn('[GROUPING] 顺序分组失败，回退随机分组:', error);
            experimentData.group = Math.random() < 0.5 ? 'experimental' : 'control';
            experimentData.responses.grouping_sequence = {
                strategy: 'cc2e1',
                fallback: 'random',
                reason: String((error && error.message) || error || '')
            };
        }
    } else {
        // 执行 1:1 随机分组
        experimentData.group = Math.random() < 0.5 ? 'experimental' : 'control';
    }
    experimentData.initialGroup = experimentData.group;
    
    experimentData.timestamps.grouping_complete = getCurrentTimestamp();
}

function createPersonalInfoTrial() {
    return {
        type: jsPsychSurveyHtmlForm,
        preamble: '<h2>个人信息</h2>',
        html: `
            <div class="questionnaire">
                <div class="question">
                    <label>手机号后四位（用于生成被试ID）：</label>
                    <input type="text" name="phone_last4" pattern="[0-9]{4}" required maxlength="4" placeholder="请输入4位数字">
                </div>
            </div>
        `,
        button_label: '继续',
        on_finish: function(data) {
            const responses = data.response;
            experimentData.participantId = 'P' + responses.phone_last4 + '_' + Date.now().toString().slice(-4);
            experimentData.responses.personal_info = responses;
            experimentData.timestamps.personal_info = getCurrentTimestamp();
        }
    };
}

function ensureSplitHalfCounterbalanceOrder() {
    if (experimentData.splitHalfOrder) {
        return experimentData.splitHalfOrder;
    }
    const order = Math.random() < 0.5 ? 'AB' : 'BA';
    experimentData.splitHalfOrder = order;
    experimentData.responses.split_half_counterbalance = {
        order,
        pretest_half: order === 'AB' ? 'A' : 'B',
        posttest_half: order === 'AB' ? 'B' : 'A',
        assigned_at: getCurrentTimestamp()
    };
    experimentData.timestamps.split_half_order_assigned = getCurrentTimestamp();
    return order;
}

function getCounterbalancedQuestionnaireConfig(phase) {
    const order = ensureSplitHalfCounterbalanceOrder();
    const preCfg = JSON.parse(JSON.stringify(QUESTIONNAIRES.pretest));
    const postCfg = JSON.parse(JSON.stringify(QUESTIONNAIRES.posttest));

    const preScenarioPage = (preCfg.pages || []).find(
        p => Array.isArray(p.questions) && p.questions.some(q => String(q.id || '').startsWith('pt_case_'))
    );
    const postScenarioPage = (postCfg.pages || []).find(
        p => Array.isArray(p.questions) && p.questions.some(q => String(q.id || '').startsWith('post_case_'))
    );

    if (order === 'BA' && preScenarioPage && postScenarioPage) {
        const swapped = preScenarioPage.questions;
        preScenarioPage.questions = postScenarioPage.questions;
        postScenarioPage.questions = swapped;
    }

    return phase === 'posttest' ? postCfg : preCfg;
}

// ===== 前测问卷 =====
function createPretestQuestionnaire() {
    return createQuestionnaireTrial('pretest', getCounterbalancedQuestionnaireConfig('pretest'));
}

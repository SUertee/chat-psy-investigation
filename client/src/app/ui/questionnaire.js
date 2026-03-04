// Questionnaire rendering helpers.
function injectQuestionnaireStyles() {
    if (document.getElementById('custom-survey-css')) return;
    const style = document.createElement('style');
    style.id = 'custom-survey-css';
    style.innerHTML = `
        /* 整体容器 */
        .survey-container {
            max-width: 900px;
            margin: 0 auto;
            text-align: left;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            padding-bottom: 50px;
        }
        
        /* 分页控制 */
        .survey-page {
            display: none;
            animation: fadeIn 0.4s ease;
        }
        .survey-page.active {
            display: block;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* 标题和描述 */
        .page-title {
            font-size: 24px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        .page-desc {
            font-size: 15px;
            color: #666;
            margin-bottom: 25px;
            line-height: 1.6;
        }

        /* 题目卡片 */
        .q-card {
            background: #fff;
            padding: 20px 25px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            border: 1px solid #eee;
            transition: transform 0.2s;
        }
        .q-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .q-label {
            display: block;
            font-weight: 600;
            margin-bottom: 12px;
            color: #2c3e50;
            font-size: 16px;
        }

        /* 输入框美化 */
        input[type="number"], input[type="text"], textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 15px;
            box-sizing: border-box;
        }
        input:focus {
            border-color: #3498db;
            outline: none;
            box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
        }

        /* 单选组美化 */
        .radio-group label {
            display: inline-block;
            margin-right: 20px;
            cursor: pointer;
            padding: 5px 0;
        }
        .radio-group input {
            margin-right: 8px;
        }

        /* Likert 量表美化 */
        .likert-container {
            display: flex;
            justify-content: space-between;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }
        .likert-item {
            text-align: center;
            flex: 1;
            cursor: pointer;
        }
        .likert-item input {
            margin-bottom: 5px;
            cursor: pointer;
        }
        .likert-text {
            font-size: 12px;
            color: #666;
            display: block;
        }

        /* 情境判断题 (Scenario) 特殊样式 */
        .scenario-box {
            border-left: 4px solid #3498db;
            background: #fdfdfd;
            padding-left: 15px;
        }
        .client-statement {
            font-style: italic;
            color: #555;
            margin-bottom: 15px;
            background: #eef2f7;
            padding: 10px;
            border-radius: 4px;
        }
        .response-block {
            margin-top: 15px;
            border-top: 1px dashed #eee;
            padding-top: 10px;
        }
        .res-text {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 8px;
        }
        .rating-scale {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        }
        .rating-option {
            text-align: center;
            flex: 1;
        }
        .rating-num {
            display: block;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .rating-desc {
            font-size: 10px;
            color: #888;
        }

        /* >>>>>> 新增：滑动条样式 <<<<<< */
        .slider-container {
            padding: 10px 0;
        }
        .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #555;
            margin-bottom: 5px;
        }
        input[type="range"] {
            width: 100%;
            margin: 10px 0;
            cursor: pointer;
        }
        .slider-value-display {
            text-align: center;
            font-weight: bold;
            color: #3498db;
            font-size: 18px;
            margin-top: 5px;
        }

        /* 导航按钮 */
        .nav-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .btn-nav {
            padding: 10px 25px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        .btn-prev {
            background: #95a5a6;
            color: white;
        }
        .btn-next {
            background: #3498db;
            color: white;
        }
        .btn-submit {
            background: #27ae60;
            color: white;
        }
        .btn-nav:hover { opacity: 0.9; }
        .btn-nav:disabled { background: #ccc; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
}

// 4. 单题渲染器 (更新版，支持 slider_9 和 likert_4)
// experiment.js

// 4. 单题渲染器 (升级版：支持反馈Likert和文本域)
function generateQuestionItem(q) {
    let html = `<div class="q-card" id="card-${q.id}">`;
    
    // 标签 (情境题不需要常规标签)
    if (q.type !== 'scenario_rating') {
        html += `<label class="q-label">${q.text} ${q.required ? '<span style="color:red">*</span>' : ''}</label>`;
    }

    // 根据类型渲染控件
    switch (q.type) {
        case 'number':
            html += `<input type="number" name="${q.id}" ${q.required ? 'required' : ''} placeholder="请输入数字...">`;
            break;
            
        case 'radio': // 是/否，男/女
            html += `<div class="radio-group">`;
            q.options.forEach(opt => {
                html += `<label><input type="radio" name="${q.id}" value="${opt}" ${q.required ? 'required' : ''}>${opt}</label>`;
            });
            html += `</div>`;
            break;
            
        case 'radio_group': // 知识题
            html += `<div class="radio-group" style="display:flex; gap:15px;">`;
            q.options.forEach(opt => {
                html += `<label style="background:#f8f9fa; padding:8px 15px; border-radius:4px; border:1px solid #ddd; flex:1; text-align:center;">
                            <input type="radio" name="${q.id}" value="${opt}" ${q.required ? 'required' : ''}> ${opt}
                         </label>`;
            });
            html += `</div>`;
            break;
            
        case 'likert_7': // 信心 1-7
            html += generateStyledLikert(q.id, 7, ['毫无信心', '', '', '中立', '', '', '极其有信心']);
            break;
            
        case 'likert_5_agree': // 态度 1-5 (默认同意度)
            html += generateStyledLikert(q.id, 5, ['非常不符合', '比较不符合', '不确定', '比较符合', '非常符合']);
            break;
            
        // >>> 新增：Likert 4 (状态焦虑) <<<
        case 'likert_4': 
            html += generateStyledLikert(q.id, 4, ['强烈反对', '反对', '同意', '强烈同意']);
            break;

        // >>> 新增：Likert 4 Feedback (练习反馈) <<<
        case 'likert_4_feedback': 
            html += generateStyledLikert(q.id, 4, ['完全没有', '略有', '比较有', '非常有']);
            break;

        // >>> 新增：Slider 9 (投入度) <<<
        case 'slider_9':
            html += `
                <div class="slider-container">
                    <div class="slider-labels">
                        <span>${q.labels[0]}</span>
                        <span>${q.labels[1]}</span>
                    </div>
                    <input type="range" name="${q.id}" min="1" max="9" step="1" value="5" 
                           oninput="document.getElementById('disp_${q.id}').innerText = this.value">
                    <div class="slider-value-display">当前选择: <span id="disp_${q.id}">5</span></div>
                </div>
            `;
            break;

        // >>> 新增：Textarea (定性反馈) <<<
        case 'textarea':
            html += `
                <textarea name="${q.id}" rows="4" 
                          style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; font-family:inherit;" 
                          placeholder="请输入您的回答（不少于20字）..." ${q.required ? 'required minlength="20"' : ''}></textarea>
            `;
            break;
            
        case 'scenario_rating': // 复杂情境题
            html += generateScenarioHTML(q);
            break;
            
        default:
            html += `<input type="text" name="${q.id}">`;
    }
    
    html += `</div>`;
    return html;
}


// 2. 创建问卷试次 (createQuestionnaireTrial)
function createQuestionnaireTrial(phase, questionnaireConfig) {
    return {
        type: jsPsychSurveyHtmlForm,
        preamble: '', // 我们在 HTML 内部自己处理标题
        html: function() {
            injectQuestionnaireStyles(); // 确保样式加载
            // 如果配置里有 pages，说明是新版多页问卷
            if (questionnaireConfig.pages) {
                return generateMultiPageHTML(questionnaireConfig.pages, phase);
            }
            // 否则是旧版单页问卷 (兼容后测等)
            return generateSinglePageHTML(questionnaireConfig);
        },
        button_label: '提交', // 这个按钮会被我们的自定义导航隐藏，只用于最后提交
        on_load: function() {
            // 更新进度条 (如果有的话)
            if (typeof updateProgress === 'function') {
                updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES?.[phase] || 50);
            }
            experimentData.timestamps[`${phase}_start`] = getCurrentTimestamp();
            
            // 如果是多页问卷，初始化分页逻辑
            if (questionnaireConfig.pages) {
                initMultiPageLogic();
            }
        },
        on_finish: function(data) {
            experimentData.responses[phase] = data.response;
            experimentData.timestamps[`${phase}_end`] = getCurrentTimestamp();

            if (phase === 'pretest' && data.response) {
                const age = parseInt(data.response.pt_age, 10);
                const gender = (data.response.pt_gender || '').trim();
                const unikey = (data.response.pt_unikey || '').trim();

                if (!Number.isNaN(age) && gender && unikey) {
                    experimentData.participantProfile = { age, gender, unikey };
                    experimentData.participantId = buildParticipantId(age, gender, unikey);
                    experimentData.controlPairing.participantKey = `${age}_${gender}_${unikey}`;
                }
            }
        }
    };
}

// 3. 多页 HTML 生成器
function generateMultiPageHTML(pages, phaseId) {
    let html = `<div class="survey-container" id="survey-root">`;
    
    // 生成每一页
    pages.forEach((page, index) => {
        const activeClass = index === 0 ? 'active' : '';
        html += `<div class="survey-page ${activeClass}" id="page-${index}" data-page="${index}">`;
        
        // 页眉
        html += `<div class="page-header">`;
        if (page.title) html += `<div class="page-title">${page.title}</div>`;
        if (page.description) html += `<div class="page-desc">${page.description}</div>`;
        html += `</div>`;
        
        // 题目列表
        html += `<div class="questions-list">`;
        page.questions.forEach(q => {
            html += generateQuestionItem(q);
        });
        html += `</div>`; // end questions-list
        
        // 导航按钮
        html += `<div class="nav-buttons">`;
        
        // 上一步
        if (index > 0) {
            html += `<button type="button" class="btn-nav btn-prev" onclick="changePage(${index - 1})">上一页</button>`;
        } else {
            html += `<div></div>`; // 占位
        }
        
        // 下一步 / 提交
        if (index < pages.length - 1) {
            html += `<button type="button" class="btn-nav btn-next" onclick="validateAndNext(${index})">下一页</button>`;
        } else {
            // 如果是最后一页且是 DEBUG 模式，去掉 novalidate 限制或添加特殊跳过逻辑
            html += `<button type="submit" class="btn-nav btn-submit" id="real-submit-btn" 
                    ${DEBUG_MODE ? 'formnovalidate' : ''}>提交问卷</button>`;
        }
        
        html += `</div>`; // end nav-buttons
        html += `</div>`; // end survey-page
    });
    
    html += `</div>`; // end container
    
    // 隐藏 jsPsych 默认的提交按钮，完全由我们接管
    html += `<style>.jspsych-btn { display: none !important; }</style>`;
    
    return html;
}


// 5. Likert 量表渲染
function generateStyledLikert(name, scale, labels) {
    let html = `<div class="likert-container">`;
    for (let i = 1; i <= scale; i++) {
        let labelText = labels[i-1] || i;
        html += `
            <div class="likert-item" onclick="selectLikert('${name}', ${i})">
                <input type="radio" name="${name}" value="${i}" required>
                <span class="likert-text">${labelText}</span>
            </div>
        `;
    }
    html += `</div>`;
    return html;
}

// 6. 情境题渲染 (Case A/B)
function generateScenarioHTML(q) {
    // 评分标准
    const ratings = [
        { val: -3, text: "非常不恰当" },
        { val: -2, text: "不恰当" },
        { val: -1, text: "略显不恰当" },
        { val: 0, text: "中立" },
        { val: 1, text: "勉强恰当" },
        { val: 2, text: "恰当" },
        { val: 3, text: "非常恰当" }
    ];

    const generateRatingRow = (subId) => {
        let h = `<div class="rating-scale">`;
        ratings.forEach(r => {
            h += `
                <div class="rating-option">
                    <label style="display:block; cursor:pointer;">
                        <span class="rating-num">${r.val > 0 ? '+'+r.val : r.val}</span>
                        <input type="radio" name="${subId}" value="${r.val}" required>
                        <br><span class="rating-desc">${r.text}</span>
                    </label>
                </div>
            `;
        });
        h += `</div>`;
        return h;
    };

    return `
        <div class="scenario-box">
            <div class="client-statement"><strong>来访者：</strong>${q.client}</div>
            
            <div class="response-block">
                <div class="res-text">回应 A：${q.resA}</div>
                ${generateRatingRow(q.id + '_A')}
            </div>
            
            <div class="response-block">
                <div class="res-text">回应 B：${q.resB}</div>
                ${generateRatingRow(q.id + '_B')}
            </div>
        </div>
    `;
}

// 7. 分页控制逻辑 (全局暴露给 HTML onclick 使用)
window.initMultiPageLogic = function() {
    window.currentPage = 0;
    changePage(0); // 确保初始化时显示第一页
};

window.changePage = function(pageIndex) {
    const pages = document.querySelectorAll('.survey-page');
    if(pages.length === 0) return; // 防错
    
    pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${pageIndex}`);
    if(targetPage) targetPage.classList.add('active');
    
    window.currentPage = pageIndex;
    // 回到顶部
    const container = document.querySelector('.survey-container');
    if(container) container.scrollIntoView({behavior: 'smooth'});
};

window.validateAndNext = function(currentIndex) {
    // 如果是 DEBUG 模式，直接跳过
    if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
        changePage(currentIndex + 1);
        return;
    }

    const currentDiv = document.getElementById(`page-${currentIndex}`);
    const inputs = currentDiv.querySelectorAll('input[required], textarea[required], select[required]');
    let allValid = true;
    let firstError = null;

    inputs.forEach(input => {
        let isInvalid = false;
        if (input.type === 'radio') {
            const group = currentDiv.querySelectorAll(`input[name="${input.name}"]`);
            if (!Array.from(group).some(r => r.checked)) isInvalid = true;
        } else {
            // 针对 textarea，手动检查长度是否符合要求（针对你设置的20字限制）
            if (!input.value.trim() || (input.minLength && input.value.length < input.minLength)) {
                isInvalid = true;
            }
        }

        if (isInvalid) {
            allValid = false;
            if (!firstError) firstError = input;
            input.closest('.q-card').style.border = '2px solid #e74c3c';
        } else {
            input.closest('.q-card').style.border = '1px solid #eee';
        }
    });

    if (allValid) {
        changePage(currentIndex + 1);
    } else {
        alert('请完成本页所有必填项（部分题目有字数要求）后再继续。');
        // 关键：滚动到错误位置，但不强制触发浏览器的 native focus 以防报错
        if (firstError) {
            firstError.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }
};

// 辅助：点击 Likert 条目选中 Radio
window.selectLikert = function(name, val) {
    const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (radio) radio.click();
}

// 8. 兼容旧版单页生成 (供后测用)
function generateSinglePageHTML(questionnaire) {
    let html = `<div class="survey-container">`;
    // 标题
    if(questionnaire.title) html += `<h2>${questionnaire.title}</h2>`;
    
    // 渲染题目
    if(questionnaire.questions) {
        questionnaire.questions.forEach(q => {
            html += generateQuestionItem(q); // 复用上面的渲染器
        });
    }
    
    html += `</div>`;
    // 恢复提交按钮显示
    html += `<style>.jspsych-btn { display: inline-block !important; margin-top: 20px; }</style>`;
    return html;
}

// ==========================================
// 问卷渲染模块 (结束)
// ==========================================
// ===== 进度条更新 =====

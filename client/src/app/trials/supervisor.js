// Supervisor feedback and ending trials.
function createAISupervisorTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            // 🔴 删除这里的 generateSupervisorFeedback(); 
            // 此时页面还没渲染，调用会导致找不到元素报错
            
            return `
                <div class="supervisor-feedback">
                    <h2>AI督导反馈</h2>
                    <div id="supervisorContent">
                        <p style="color:#666;">正在初始化督导界面...</p>
                    </div>
                </div>
            `;
        },
        choices: [], // 暂时不显示按钮，等生成完了再在 feedback 里显示
        on_load: function() {
            // 更新进度条
            if (typeof updateCustomProgress === 'function') {
                updateCustomProgress(90); 
            }
            
            // 记录开始时间
            experimentData.timestamps.supervisor_feedback_start = getCurrentTimestamp();
            
            // 🟢 正确位置：在 on_load 里调用
            // 此时 <div id="supervisorContent"> 已经存在于页面上了
            generateSupervisorFeedback();
        }
    };
}

// experiment.js - 请完全替换 generateSupervisorFeedback 函数
function finishSupervisorFeedback() {
    experimentData.timestamps.supervisor_feedback_end = getCurrentTimestamp();
    jsPsych.finishTrial();
}
function createEndTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <h2>实验结束</h2>
            <p>感谢您参与本次研究！</p>
            <p>您的数据正在保存中...</p>
            <p>实验数据将自动下载到您的电脑中。</p>
            <p style="margin-top:24px;">如果浏览器试图拦截，请点击“允许”下载文件</p>
            <p>请把浏览器自动下载的文件发送到邮箱：
                <a href="mailto:liyangpsy@mail.bnu.edu.cn">liyangpsy@mail.bnu.edu.cn</a>
                （不用改文件名）
            </p>
        `,
        choices: [],
        on_load: function() {
            experimentData.timestamps.end = getCurrentTimestamp();
            // 自动结束
            setTimeout(() => {
                jsPsych.finishTrial();
            }, 3000);
        }
    };
}

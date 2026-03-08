// Progress and countdown UI helpers.
function initCustomProgressBar() {
    // 1. 隐藏旧的进度条元素 (这是新增的关键代码)
    const oldBar = document.getElementById('progressBar');
    const oldText = document.getElementById('progressText');
    const oldContainer = document.querySelector('.progress'); // 尝试获取常见的进度条容器类名
    
    // 暴力隐藏所有旧元素
    if (oldBar) {
        oldBar.style.display = 'none';
        if (oldBar.parentElement) oldBar.parentElement.style.display = 'none';
    }
    if (oldText) oldText.style.display = 'none';
    if (oldContainer) oldContainer.style.display = 'none';

    // 2. 注入新进度条的 CSS
    const css = `
    <style>
        /* 隐藏 jsPsych 默认进度条 */
        #jspsych-progressbar-container { display: none !important; }

        /* 自定义进度条容器 - 固定在右上角 */
        .custom-progress-fixed-container {
            position: fixed;
            top: 25px;
            right: 25px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: "Microsoft YaHei", sans-serif;
            pointer-events: none;
        }

        /* 外圈圆环 */
        .progress-ring-outer {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: conic-gradient(#07c160 0%, #e6e6e6 0%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: background 0.3s ease;
        }

        /* 内圈圆 */
        .progress-ring-inner {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background-color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .progress-ring-icon {
            font-size: 16px;
            color: #07c160;
        }

        .progress-label-text {
            margin-top: 6px;
            font-size: 12px;
            color: #666;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }
    </style>
    `;

    const html = `
    <div class="custom-progress-fixed-container" id="customProgressContainer" style="display:none;">
        <div class="progress-ring-outer" id="progressRing">
            <div class="progress-ring-inner">
                <span class="progress-ring-icon" id="progressIcon">🏃</span>
            </div>
        </div>
        <span class="progress-label-text">实验进度</span>
    </div>
    `;

    document.head.insertAdjacentHTML('beforeend', css);
    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * 2. 更新进度条状态
 * @param {number} percent - 进度百分比 (0-100)
 * @param {string} [statusIcon] - (可选) 更改中间的图标，例如完成后变成 ✅
 */
function updateCustomProgress(percent, statusIcon) {
    const container = document.getElementById('customProgressContainer');
    const ring = document.getElementById('progressRing');
    const icon = document.getElementById('progressIcon');

    if (container && ring) {
        // 确保容器可见
        container.style.display = 'flex';

        // 使用 CSS conic-gradient 更新绿色部分的比例
        // 绿色(#07c160) 占 percent%，剩下的灰色(#e6e6e6)
        ring.style.background = `conic-gradient(#07c160 ${percent}%, #e6e6e6 ${percent}%)`;

        // 如果传入了新的图标（例如完成时的对勾），更新它
        if (statusIcon) {
            icon.textContent = statusIcon;
        } else if (percent >= 100) {
            icon.textContent = '✅'; // 默认满进度显示对勾
        }
    }
}
function startCountdown() {
    // 关键：先辞退之前所有的报时员，防止时间跑快
    if (window.countdownTimer) {
        clearInterval(window.countdownTimer);
        window.countdownTimer = null;
    }

    // 重置时间
    countdownTimeLeft = EXPERIMENT_CONFIG.COUNTDOWN_TIME;
    
    // 显示粉色按钮
    const finishBtn = document.getElementById('finishButton');
    if (finishBtn) finishBtn.style.display = 'block';

    // 启动新的报时员
    updateCountdownDisplay();
    window.countdownTimer = setInterval(() => {
        countdownTimeLeft -= 1000;
        
        // 如果找不到显示数字的地方了，就说明换页了，自动停止
        const display = document.getElementById('headerTimeDisplay');
        if (!display) {
            clearInterval(window.countdownTimer);
            return;
        }

        updateCountdownDisplay();
        
        if (countdownTimeLeft <= 0) {
            clearInterval(window.countdownTimer);
            finishStage(); 
        }
    }, 1000);
}

// 2. 彻底隐藏倒计时和粉色按钮
function hideCountdownAndButton() {
    // 辞退报时员
    if (window.countdownTimer) {
        clearInterval(window.countdownTimer);
        window.countdownTimer = null;
    }
    
    // 让倒计时气泡变透明
    const headerBadge = document.querySelector('.header-timer-badge');
    if (headerBadge) headerBadge.style.display = 'none';

    // 让粉色按钮变透明
    const finishBtn = document.getElementById('finishButton');
    if (finishBtn) finishBtn.style.display = 'none';
}
function updateCountdownDisplay() {
    const minutes = Math.floor(countdownTimeLeft / 60000);
    const seconds = Math.floor((countdownTimeLeft % 60000) / 1000);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const headerDisplay = document.getElementById('headerTimeDisplay');
    if (headerDisplay) { // 增加安全检查
        headerDisplay.textContent = timeString;
        if (minutes < 1) {
            headerDisplay.style.color = '#e74c3c';
            headerDisplay.style.fontWeight = 'bold';
        }
    }

    const oldDisplay = document.getElementById('timeLeft');
    if (oldDisplay) { // 增加安全检查
        oldDisplay.textContent = timeString;
    }
}

function hideCountdown() {
    // 1. 停止计时器
    if (countdownTimer) clearInterval(countdownTimer);
    
    // 2. 尝试寻找旧版倒计时容器
    const oldCountdown = document.getElementById('countdown');
    if (oldCountdown) {
        oldCountdown.style.display = 'none';
    }

    // 3. 尝试寻找新版标题栏倒计时容器
    const headerDisplay = document.getElementById('headerTimeDisplay');
    if (headerDisplay) {
        // 找到它父级那个带背景的“气泡”并隐藏
        const badge = headerDisplay.closest('.header-timer-badge');
        if (badge) {
            badge.style.display = 'none';
        } else {
            headerDisplay.style.display = 'none';
        }
    }
}

function showFinishButton() {
    const btn = document.getElementById('finishButton');
    if (btn) {
        btn.textContent = '我已完成风险评估，结束此阶段';
        btn.style.display = 'block';
    } else {
        // 如果找不到按钮，尝试在 500ms 后重新查找一次
        setTimeout(() => {
            const retryBtn = document.getElementById('finishButton');
            if (retryBtn) {
                retryBtn.textContent = '我已完成风险评估，结束此阶段';
                retryBtn.style.display = 'block';
            }
        }, 500);
    }
}

function hideFinishButton() {
    document.getElementById('finishButton').style.display = 'none';
}

function finishStage() {
    console.log("正在结束当前阶段...");
    
    // 如果是在练习一或练习三阶段（即你说的练习一和练习二）
    const currentTrial = jsPsych.getCurrentTrial();
    // 检查是否在对话练习中
    if (document.getElementById('chatMessages')) {
        showCrisisAssessmentModal(); // 调用新写的弹窗函数
    } else {
        // 非练习阶段直接结束
        proceedToNextStage();
    }
}

// 提取原有的结束逻辑为独立函数
function updateProgress(percentage) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar && progressText) {
        progressBar.style.width = percentage + '%';
        progressText.textContent = percentage + '%';
    }
}

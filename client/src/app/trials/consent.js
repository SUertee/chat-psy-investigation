// Consent-related trials.
function createConsentTrial() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="consent-form">
                ${CONSENT_TEXT.content}
            </div>
            <div class="consent-buttons">
                <button class="jspsych-btn" onclick="handleConsent(true)">同意参与</button>
                <button class="jspsych-btn" onclick="handleConsent(false)" style="background-color: #f44336;">不同意</button>
            </div>
        `,
        choices: [],
        on_load: function() {
            updateProgress(EXPERIMENT_CONFIG.PROGRESS_STAGES.consent);
            experimentData.timestamps.consent_start = getCurrentTimestamp();
        }
    };
}

function handleConsent(agreed) {
    experimentData.timestamps.consent_decision = getCurrentTimestamp();
    experimentData.responses.consent = agreed;
    
    if (agreed) {
        // 同意，继续实验
        jsPsych.finishTrial();
    } else {
        // 不同意，播放培训视频后结束
        showTrainingOnly();
    }
}

// experiment.js
function showTrainingOnly() {
    const trainingDiv = document.createElement('div');
    trainingDiv.innerHTML = `
        <div class="video-container">
            <h2>您选择不同意，但仍可观看培训视频</h2>
            <div style="position: relative; width: min(1100px, 94vw); margin: 0 auto; background: #000; border-radius: 12px; overflow: hidden;">
                <video id="trainingVideoOnly" style="display:block; width:100%; height:auto; max-height:72vh; background:#000; object-fit:contain;"
                       oncontextmenu="return false;" 
                       disablepictureinpicture>
                    <source src="${EXPERIMENT_CONFIG.TRAINING_VIDEO_PATH}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
                <button id="trainingOnlyStartOverlay" type="button" style="
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    padding: 12px 22px;
                    border: none;
                    border-radius: 999px;
                    background: rgba(0, 0, 0, 0.68);
                    color: #fff;
                    font-size: 16px;
                    cursor: pointer;
                ">点击开始播放</button>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
             <p id="exitMessage">请耐心观看视频，结束后将自动关闭页面...</p>
        </div>
    `;
    
    document.body.innerHTML = '';
    document.body.appendChild(trainingDiv);
    
    // JS逻辑：禁用进度条拖动和监听播放结束
    const video = document.getElementById('trainingVideoOnly');
    const exitMessage = document.getElementById('exitMessage');
    const startOverlay = document.getElementById('trainingOnlyStartOverlay');

    if (startOverlay) {
        startOverlay.onclick = function() {
            video.play().then(() => {
                startOverlay.style.display = 'none';
            }).catch((error) => {
                console.warn('Video play blocked:', error);
            });
        };
    }

    video.onloadeddata = function() {
        video.addEventListener('seeking', function() {
            if (video.currentTime > video.currentPlayTime + 5) {
                video.currentTime = video.currentPlayTime;
            }
            video.currentPlayTime = video.currentTime;
        });
        video.currentPlayTime = 0;
    };

    video.onended = function() {
        exitMessage.textContent = '感谢您的观看，页面将在 3 秒后关闭。';
        // 3秒后自动结束
        setTimeout(() => {
            window.close();
        }, 3000);
    };
    // ...
}

// Application bootstrap.
document.addEventListener('DOMContentLoaded', function() {
    let restoreInfo = { available: false, resumeTrialIndex: 0 };
    if (typeof initAutosave === 'function') {
        try {
            initAutosave();
            if (typeof getAutosaveRestoreInfo === 'function') {
                restoreInfo = getAutosaveRestoreInfo() || restoreInfo;
            }
            if (restoreInfo && restoreInfo.available) {
                const savedAt = restoreInfo.savedAt || '未知时间';
                const shouldResume = window.confirm(
                    `检测到未完成实验进度（最近保存：${savedAt}）。\n\n点击“确定”继续；点击“取消”重新开始。`
                );
                if (!shouldResume) {
                    if (typeof rotateAutosaveSession === 'function') {
                        rotateAutosaveSession();
                    }
                    window.location.reload();
                    return;
                }
            }
        } catch (error) {
            console.warn('[AUTOSAVE] init failed:', error);
        }
    }

    // 初始化jsPsych
    jsPsych = initJsPsych({
        on_trial_finish: function() {
            experimentData.__autosaveTrialCount = Number(experimentData.__autosaveTrialCount || 0) + 1;
            if (typeof persistAutosaveNow === 'function') {
                persistAutosaveNow('trial_finish', false).catch((error) => {
                    console.warn('[AUTOSAVE] trial save failed:', error);
                });
            }
        },
        display_element: 'jspsych-target',
        on_finish: function() {
            // 实验结束后保存数据
            experimentData.timestamps.end = experimentData.timestamps.end || getCurrentTimestamp();
            if (typeof persistAutosaveNow === 'function') {
                persistAutosaveNow('experiment_finish', true).catch((error) => {
                    console.warn('[AUTOSAVE] finish save failed:', error);
                });
            }
            saveData();
            if (typeof stopAutosave === 'function') {
                stopAutosave();
            }
            if (typeof rotateAutosaveSession === 'function') {
                rotateAutosaveSession();
            }
        }
    });
    
    // 开始实验
    startExperiment(restoreInfo);
});

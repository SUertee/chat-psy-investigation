// Application bootstrap.
document.addEventListener('DOMContentLoaded', function() {
    // 初始化jsPsych
    jsPsych = initJsPsych({
        display_element: 'jspsych-target',
        on_finish: function() {
            // 实验结束后保存数据
            saveData();
        }
    });
    
    // 开始实验
    startExperiment();
});

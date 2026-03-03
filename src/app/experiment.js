// Compatibility loader for the refactored app modules.
(function loadExperimentModules() {
    var currentScript = document.currentScript;
    if (!currentScript) {
        throw new Error('Unable to resolve current script for experiment loader.');
    }

    var baseUrl = new URL('./', currentScript.src);
    var scripts = [
        'state.js',
        'utils/time.js',
        'utils/helpers.js',
        'ui/progress.js',
        'ui/questionnaire.js',
        'ui/chat.js',
        'trials/consent.js',
        'trials/grouping.js',
        'trials/practice.js',
        'trials/assessment.js',
        'trials/supervisor.js',
        'services/ai.js',
        'services/upload.js',
        'services/export.js',
        'timeline.js',
        'main.js'
    ];

    var tags = scripts.map(function(path) {
        return '<script src="' + new URL(path, baseUrl).href + '"><\/script>';
    }).join('');

    document.write(tags);
})();

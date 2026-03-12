// Mid-experiment autosave and restore helpers.
(function () {
    const STORAGE_KEY = 'ai_psy_autosave_current_snapshot_v1';
    const DEFAULT_INTERVAL_MS = 15000;
    const RUNTIME = {
        initialized: false,
        timer: null,
        intervalMs: DEFAULT_INTERVAL_MS,
        seq: 0,
        sessionId: '',
        restoreInfo: { available: false, resumeTrialIndex: 0 },
        enabled: true,
    };

    function nowIso() {
        return (typeof getCurrentTimestamp === 'function') ? getCurrentTimestamp() : new Date().toISOString();
    }

    function deepClone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return null;
        }
    }

    function getConfig() {
        const cfg = (typeof EXPERIMENT_CONFIG !== 'undefined' && EXPERIMENT_CONFIG) || {};
        return {
            enabled: cfg.AUTOSAVE_ENABLED !== false,
            intervalMs: Number(cfg.AUTOSAVE_INTERVAL_MS || DEFAULT_INTERVAL_MS),
        };
    }

    function createSessionId() {
        if (window.crypto && crypto.randomUUID) {
            return `S_${crypto.randomUUID().slice(0, 8)}`;
        }
        return `S_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    }

    function captureSurveyDraft() {
        const form = document.getElementById('jspsych-survey-html-form');
        if (!form || !form.elements) return null;

        const values = {};
        Array.from(form.elements).forEach((field) => {
            if (!field || !field.name || field.disabled) return;
            const t = (field.type || '').toLowerCase();
            if (t === 'submit' || t === 'button' || t === 'reset' || t === 'file') return;

            if (t === 'radio') {
                if (field.checked) values[field.name] = field.value;
                return;
            }

            if (t === 'checkbox') {
                if (!Array.isArray(values[field.name])) values[field.name] = [];
                if (field.checked) values[field.name].push(field.value);
                return;
            }

            values[field.name] = field.value;
        });

        return { kind: 'survey-html-form', saved_at: nowIso(), values };
    }

    function getCompletedTrialCount() {
        if (experimentData && Number.isFinite(experimentData.__autosaveTrialCount)) {
            return experimentData.__autosaveTrialCount;
        }
        try {
            if (typeof jsPsych !== 'undefined' && jsPsych && jsPsych.data && jsPsych.data.get) {
                return jsPsych.data.get().count();
            }
        } catch (error) {
            // Ignore.
        }
        return 0;
    }

    function inferResumeTrialIndex(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return 0;
        const explicit = Number(snapshot.completed_trial_count || 0);
        if (explicit > 0) return explicit;

        const exp = snapshot.experiment_data || {};
        const ts = exp.timestamps || {};
        let idx = 0;
        if (ts.consent_decision || exp.responses?.consent) idx = Math.max(idx, 1);
        if (ts.grouping_start || ts.grouping_complete) idx = Math.max(idx, 2);
        if (ts.procedure_instruction_start) idx = Math.max(idx, 3);
        if (ts.pretest_start) idx = Math.max(idx, 3);
        if (ts.pretest_end) idx = Math.max(idx, 4);
        if (ts.probe1_end) idx = Math.max(idx, 5);
        if (ts.video_prompt) idx = Math.max(idx, 6);
        if (ts.video_start) idx = Math.max(idx, 7);
        if (ts.tutor_start) idx = Math.max(idx, 8);
        if (ts.tutor_end) idx = Math.max(idx, 9);
        if (ts.probe2_end) idx = Math.max(idx, 10);
        if (ts.PRACTICE_1_start) idx = Math.max(idx, 11);
        if (ts.PRACTICE_1_end) idx = Math.max(idx, 12);
        if (ts.PRACTICE_3_start) idx = Math.max(idx, 13);
        if (ts.PRACTICE_3_end) idx = Math.max(idx, 14);
        if (ts.posttest_start) idx = Math.max(idx, 15);
        if (ts.posttest_end) idx = Math.max(idx, 16);
        if (ts.second_practice_start || ts.SECOND_CLIENT_start) idx = Math.max(idx, 17);
        if (ts.second_practice_end || ts.SECOND_CLIENT_end) idx = Math.max(idx, 18);
        if (ts.questionnaire3_start) idx = Math.max(idx, 20);
        if (ts.questionnaire3_end) idx = Math.max(idx, 21);
        return idx;
    }

    function buildSnapshot(reason) {
        const draft = captureSurveyDraft();
        const snapshotExperimentData = deepClone(experimentData) || {};
        if (snapshotExperimentData) {
            snapshotExperimentData.__autosaveDraftForm = draft;
        }
        return {
            schema_version: 'autosave_v1',
            saved_at: nowIso(),
            reason: reason || 'autosave',
            session_id: RUNTIME.sessionId,
            participant_id: (experimentData && experimentData.participantId) || '',
            seq: RUNTIME.seq,
            completed_trial_count: getCompletedTrialCount(),
            experiment_data: snapshotExperimentData,
        };
    }

    function saveLocalSnapshot(snapshot) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }

    function loadLocalSnapshot() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function syncRemoteSnapshot(snapshot) {
        if (typeof uploadResultSnapshot !== 'function') {
            return Promise.resolve(null);
        }
        const payload = {
            ...snapshot,
            file_name: `autosave_${snapshot.session_id || 'unknown'}_${String(snapshot.seq || 0)}.json`,
        };
        return uploadResultSnapshot(payload);
    }

    function applySnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        const restored = deepClone(snapshot.experiment_data || {});
        if (!restored) return;
        Object.keys(experimentData).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(restored, key)) {
                experimentData[key] = restored[key];
            }
        });
    }

    function rotateSession() {
        RUNTIME.sessionId = createSessionId();
        RUNTIME.seq = 0;
        RUNTIME.restoreInfo = { available: false, resumeTrialIndex: 0 };
        localStorage.removeItem(STORAGE_KEY);
    }

    function persistAutosave(reason, options = {}) {
        if (!RUNTIME.initialized || !RUNTIME.enabled) return Promise.resolve(null);
        RUNTIME.seq += 1;
        const snapshot = buildSnapshot(reason);
        saveLocalSnapshot(snapshot);
        if (options.remote) {
            return syncRemoteSnapshot(snapshot);
        }
        return Promise.resolve(snapshot);
    }

    function stopAutosave() {
        if (RUNTIME.timer) {
            clearInterval(RUNTIME.timer);
            RUNTIME.timer = null;
        }
    }

    function bindLifecycle() {
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                persistAutosave('visibility_hidden', { remote: true }).catch((error) => {
                    console.warn('[AUTOSAVE] hidden sync failed:', error);
                });
            }
        });
        window.addEventListener('beforeunload', function () {
            try {
                RUNTIME.seq += 1;
                const snapshot = buildSnapshot('beforeunload');
                saveLocalSnapshot(snapshot);
                const baseUrl = (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
                if (navigator.sendBeacon && baseUrl) {
                    const body = {
                        participant_id: snapshot.participant_id || '',
                        file_name: `autosave_${snapshot.session_id || 'unknown'}_${String(snapshot.seq || 0)}.json`,
                        schema_version: snapshot.schema_version || 'autosave_v1',
                        saved_at: snapshot.saved_at || '',
                        payload: snapshot,
                    };
                    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
                    navigator.sendBeacon(`${baseUrl}/results/save`, blob);
                }
            } catch (error) {
                // Ignore unload failures.
            }
        });
    }

    function initAutosave() {
        if (RUNTIME.initialized) return;
        const cfg = getConfig();
        RUNTIME.enabled = !!cfg.enabled;
        RUNTIME.intervalMs = cfg.intervalMs;
        RUNTIME.sessionId = createSessionId();
        RUNTIME.seq = 0;

        if (!RUNTIME.enabled) {
            RUNTIME.initialized = true;
            return;
        }

        const existing = loadLocalSnapshot();
        if (existing && existing.session_id) {
            RUNTIME.sessionId = existing.session_id;
            RUNTIME.seq = Number(existing.seq || 0);
            const finished = !!(existing.experiment_data && existing.experiment_data.timestamps && existing.experiment_data.timestamps.end);
            if (!finished) {
                applySnapshot(existing);
                RUNTIME.restoreInfo = {
                    available: true,
                    sessionId: existing.session_id,
                    participantId: existing.participant_id || '',
                    savedAt: existing.saved_at || '',
                    resumeTrialIndex: inferResumeTrialIndex(existing),
                };
            }
        }

        bindLifecycle();
        RUNTIME.timer = setInterval(() => {
            persistAutosave('interval', { remote: true }).catch((error) => {
                console.warn('[AUTOSAVE] interval sync failed:', error);
            });
        }, RUNTIME.intervalMs);

        RUNTIME.initialized = true;
    }

    window.initAutosave = initAutosave;
    window.stopAutosave = stopAutosave;
    window.persistAutosaveNow = function (reason, remote) {
        return persistAutosave(reason || 'manual', { remote: !!remote });
    };
    window.getAutosaveRestoreInfo = function () {
        return deepClone(RUNTIME.restoreInfo) || { available: false, resumeTrialIndex: 0 };
    };
    window.rotateAutosaveSession = rotateSession;
})();

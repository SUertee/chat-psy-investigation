// Upload helpers.
function uploadToServer(blob, fileName) {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    
    fetch(EXPERIMENT_CONFIG.DATA_UPLOAD_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            console.log('数据上传成功');
        } else {
            console.error('数据上传失败');
        }
    })
    .catch(error => {
        console.error('上传错误:', error);
    });
}

function uploadResultSnapshot(snapshotPayload) {
    const baseUrl = (EXPERIMENT_CONFIG.BACKEND_BASE_URL || '').replace(/\/$/, '');
    if (!baseUrl) {
        console.error('结果保存失败：BACKEND_BASE_URL 未配置');
        return Promise.resolve(null);
    }

    const requestBody = {
        participant_id: (snapshotPayload && snapshotPayload.participant_id) || '',
        file_name: (snapshotPayload && snapshotPayload.file_name) || '',
        schema_version: (snapshotPayload && snapshotPayload.schema_version) || 'v1',
        saved_at: (snapshotPayload && snapshotPayload.saved_at) || '',
        payload: snapshotPayload || {}
    };

    return fetch(`${baseUrl}/results/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
        .then(async (response) => {
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log('本地结果保存成功:', data.saved_path || '');
            return data;
        })
        .catch((error) => {
            console.error('本地结果保存失败:', error);
            return null;
        });
}

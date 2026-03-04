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

<?php
// proxy.php - 兼容 IIS/Windows 环境的修复版本
// 允许所有来源进行跨域请求 (关键!)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// 确保这是一个 POST 请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. 获取客户端发送的原始 JSON 数据
    $input_json = file_get_contents('php://input');

    // 2. 健壮地获取授权头 (使用 $_SERVER 替代 getallheaders() )
    // Authorization 头部在 $_SERVER 中通常以 HTTP_AUTHORIZATION 存在
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null; 
    
    // 如果仍然为空，尝试从所有 HTTP 头部中查找（getallheaders() 可能会崩溃，所以避免使用）
    if (empty($auth_header)) {
        // Fallback for some non-standard IIS configurations
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                if (strtoupper(substr($name, 5)) === 'AUTHORIZATION') {
                    $auth_header = $value;
                    break;
                }
            }
        }
    }

    if (empty($auth_header)) {
        http_response_code(400);
        echo json_encode(['error' => 'AUTH_MISSING: API Key (Authorization Header) is missing.']);
        exit;
    }

    // 设置转发目标 URL (火山引擎)
    $target_url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    // 3. 使用 cURL 进行转发
    $ch = curl_init($target_url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input_json);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        "Authorization: $auth_header" // 确保头信息正确转发
    ));
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);

    // 4. 处理 cURL 转发错误
    if ($curl_error) {
        http_response_code(502); 
        echo json_encode(['error' => 'CURL_FORWARDING_ERROR: ' . $curl_error]);
        exit;
    }
    
    // 将火山引擎的响应和状态码返回给浏览器
    http_response_code($httpcode);
    echo $response;
    
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
?>
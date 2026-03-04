# 20260304_1325_server_start_script_uvicorn_fix_review

## 时间

- 2026-03-04 13:25 (Asia/Shanghai)

## 内容

- 修复后端启动脚本对全局 `uvicorn` 命令的硬依赖

## 动作

- 更新 [run-server.sh](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/scripts/run-server.sh)
  - 将 `uvicorn app.main:app --reload --port "$PORT"` 改为 `python3 -m uvicorn app.main:app --reload --port "$PORT"`
  - 在启动前增加模块检测：
    - `python3 -c "import uvicorn"`
  - 若未安装 `uvicorn`，输出明确的安装指引并退出

## Review

- Shell 语法检查通过：
  - `sh -n scripts/run-server.sh`
- 运行行为检查通过：
  - 当前环境未安装 `uvicorn`
  - 脚本现在会输出清晰提示：
    - `Error: Python module 'uvicorn' is not installed in the current environment.`
    - `cd server`
    - `pip install -r requirements.txt`
- 修复结果：
  - 失败模式从“命令不存在”变成“依赖缺失且有明确安装指引”，更适合后续排障

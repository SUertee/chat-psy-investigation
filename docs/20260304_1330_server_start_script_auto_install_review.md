# 20260304_1330_server_start_script_auto_install_review

## 时间

- 2026-03-04 13:30 (Asia/Shanghai)

## 内容

- 将后端启动脚本从“提示手动安装依赖”改为“缺依赖时自动安装”

## 动作

- 更新 [run-server.sh](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/scripts/run-server.sh)
  - 检测不到 `uvicorn` 模块时，自动执行：
    - `python3 -m pip install -r requirements.txt`
  - 安装完成后继续执行：
    - `python3 -m uvicorn app.main:app --reload --port "$PORT"`

## Review

- Shell 语法检查通过：
  - `sh -n scripts/run-server.sh`
- 脚本逻辑确认：
  - 当前启动流程变为：
    1. 进入 `server/`
    2. 检测 `uvicorn`
    3. 如果缺失则自动安装 `requirements.txt`
    4. 启动 FastAPI
- 限制说明：
  - 本轮未在沙箱内实际执行安装，因为安装依赖需要联网
  - 但脚本内容已经具备自动安装能力，用户本机直接运行即可触发

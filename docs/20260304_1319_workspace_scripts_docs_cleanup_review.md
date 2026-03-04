# 20260304_1319_workspace_scripts_docs_cleanup_review

## 时间

- 2026-03-04 13:19 (Asia/Shanghai)

## 内容

- 整理外围结构，使 `client/ + server/` 布局在脚本和文档层面也一致
- 明确前端/后端启动方式和部署入口

## 动作

- 新增前端启动脚本：
  - [run-client.sh](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/scripts/run-client.sh)
- 新增后端启动脚本：
  - [run-server.sh](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/scripts/run-server.sh)
- 重命名部署脚本：
  - `scripts/deploy.sh` -> [deploy-client.sh](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/scripts/deploy-client.sh)
- 更新部署脚本内容：
  - 复制 `client/` 而不是旧的 `public/` 和 `src/`
  - 保留复制 `server/`
  - 部署地址文案改为 `client/public/...`
  - 配置路径文案改为 `client/src/config/config.js`
- 新增前端目录说明：
  - [README.md](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/README.md)
- 更新核心文档：
  - [README.md](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/README.md)
  - [README.md](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/docs/README.md)
  - [PROJECT_OVERVIEW.md](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/docs/PROJECT_OVERVIEW.md)
- 设置脚本可执行权限：
  - `chmod +x scripts/run-client.sh scripts/run-server.sh scripts/deploy-client.sh`

## Review

- 脚本语法检查通过：
  - `sh -n scripts/deploy-client.sh`
  - `sh -n scripts/run-client.sh`
  - `sh -n scripts/run-server.sh`
- 路径检查通过：
  - 文档中的前端配置路径已统一为 `client/src/config/config.js`
  - 部署地址已统一为 `client/public/index.html` 和 `client/public/test.html`
- 仍需注意：
  - 第一份操作记录是历史记录，里面保留了“当时尚未修复部署脚本”的说明，这是正常的时间线记录，不应回写覆盖

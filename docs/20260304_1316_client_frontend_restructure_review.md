# 20260304_1316_client_frontend_restructure_review

## 时间

- 2026-03-04 13:16 (Asia/Shanghai)

## 内容

- 将前端整体从根目录整理到 `client/`
- 保持前端内部结构为 `client/public` + `client/src`
- 修正因此变化的根入口和测试页文档路径

## 动作

- 移动目录：
  - `public/` -> `client/public/`
  - `src/` -> `client/src/`
  - `package.json` -> `client/package.json`
  - `package-lock.json` -> `client/package-lock.json`
- 更新根目录跳转页 [index.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/index.html)：
  - `./public/index.html` -> `./client/public/index.html`
- 更新 [.gitignore](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/.gitignore)：
  - `src/config/config.local.js` -> `client/src/config/config.local.js`
- 更新 [test.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/public/test.html)：
  - 文档链接 `../docs/README.md` -> `../../docs/README.md`

## Review

- 路径检查通过：
  - 根目录 [index.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/index.html) 现在跳转到 [index.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/public/index.html)
  - [index.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/public/index.html) 继续通过 `../src/...` 引用 [config.js](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/src/config/config.js) 和前端模块，兄弟目录关系未被破坏
  - [test.html](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/client/public/test.html) 到 [README.md](/Users/suerte/Desktop/Programming/Projects/ai_psy/experiment%20-%20%E5%89%AF%E6%9C%AC%20(2)/docs/README.md) 的相对路径已修正
- 风险说明：
  - 本轮未做后端或部署脚本修正，`scripts/deploy.sh` 仍引用旧的 `public/` 和 `src/`
  - 当前 shell 环境缺少 `node`，无法做 `node --check` 语法校验；本轮 review 仅覆盖文件存在性与路径引用检查

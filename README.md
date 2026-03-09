# 危机评估培训实验系统

## 📋 项目简介

这是一个基于jsPsych的心理学实验系统，用于研究AI辅助危机评估培训的效果。参与者可以通过网页链接直接参与实验，无需下载任何软件。

## 🚀 快速开始

### 1. 运行方式

#### 方法一：本地运行前端

1. 在项目根目录启动静态服务：
   ```bash
   ./scripts/run-client.sh 8002
   ```
2. 在浏览器中访问：
   - 测试入口：`http://127.0.0.1:8002/client/public/test.html`
   - 实验入口：`http://127.0.0.1:8002/client/public/index.html`

#### 方法二：同时启用配对后端

1. 保持前端静态服务运行（推荐 8002）
2. 启动 FastAPI 后端（默认 8001）：
   ```bash
   ./scripts/run-server.sh
   ```
3. 对照组配对聊天室和 AI 代理接口都由 `server/` 提供
4. 健康检查地址：`http://127.0.0.1:8001/api/health`

#### 方法三：部署到服务器

1. 使用部署脚本：
   ```bash
   ./scripts/deploy-client.sh /var/www/html/experiment
   ```
2. 确保根目录 `index.html` 可以直接访问
3. 如需配对聊天室，额外启动 `server` 内的 FastAPI 服务

#### 方法六：Docker 一键运行（推荐服务器）

在项目根目录执行：

```bash
docker compose up -d --build
```

访问地址：

- 前端实验页：`http://127.0.0.1:9000/client/public/index.html`
- 后端健康检查：`http://127.0.0.1:9000/api/health`

停止服务：

```bash
docker compose down
```

#### 方法四：没有 bash 时，手动启动（推荐）

如果你的环境没有 `bash`（例如部分 Windows 环境），可以不用脚本，直接执行命令：

前端（项目根目录）：

```bash
python3 -m http.server 8002
```

浏览器访问：`http://127.0.0.1:8002/client/public/index.html`

后端（新开终端，进入 `server/` 目录）：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8001
```

后端地址：`http://127.0.0.1:8001`（接口前缀 `/api`）

#### 方法五：Windows PowerShell 启动

前端（项目根目录）：

```powershell
py -m http.server 8002
```

后端（进入 `server` 目录）：

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8001
```

### 2. 文件结构

```
experiment/
├── client/             # 前端代码
│   ├── public/         # 静态入口、资源、vendor
│   └── src/            # 前端源码
├── server/             # FastAPI 后端
├── docs/               # 项目文档和操作记录
├── scripts/            # 启动和部署脚本
├── index.html          # 根目录跳转页
└── README.md           # 项目总说明
```

## 🔧 配置说明

### 修改API配置

前端配置都在 `client/src/config/config.js` 文件中，您可以轻松修改以下设置：

#### 1. AI 调用链路（当前方式）

当前项目使用“前端 -> 后端代理 -> AI 服务”的方式：

- 前端请求：`EXPERIMENT_CONFIG.BACKEND_BASE_URL + /ai/chat`
- 后端读取 `server/.env` 中的 `AI_API_KEY`、`OPENAI_API_URL`、`AI_PROVIDER`

说明：

- 前端 `config.js` 不再保存真实 API Key。
- 若 AI 调用失败，请优先检查 `server/.env` 和后端是否已启动。

#### 2. 修改AI模型参数

在 `client/src/config/config.js` 中可以调整AI的行为：

```javascript
AI_TEMPERATURE: 0.7,      // 值越小，回答越确定；值越大，回答越随机
AI_MAX_TOKENS: 500,       // 限制AI回答的最大长度
AI_STREAM: false,         // 是否使用流式输出（建议保持false）
```

#### 3. 修改API密钥

请修改 `server/.env`（不是前端）：

```env
AI_PROVIDER=openai
AI_API_KEY=你的真实密钥
OPENAI_API_URL=你的上游地址
```

修改后需要重启后端：

```bash
./scripts/run-server.sh
```

### 修改PDF文件

对照组需要观摩PDF材料，当前使用的是占位文件 `sample.pdf`。

**替换PDF的步骤：**

1. 准备您的PDF文件（比如叫 `training_material.pdf`）
2. 将PDF文件放入项目文件夹
3. 打开 `client/src/config/config.js`
4. 找到这一行：
   ```javascript
   PDF_PATH: "./sample.pdf",
   ```
5. 改成：
   ```javascript
   PDF_PATH: "./training_material.pdf",
   ```

### 修改实验设置

在 `client/src/config/config.js` 的 `EXPERIMENT_CONFIG` 部分可以修改：

```javascript
const EXPERIMENT_CONFIG = {
  COUNTDOWN_TIME: 10 * 60 * 1000, // 倒计时时间（毫秒）
  DATA_UPLOAD_URL: "http://39.105.200.50/exp_data/upload.php", // 数据上传地址
  TRAINING_VIDEO_PATH: "视频URL", // 培训视频路径
};
```

## 📊 数据收集

### 数据内容

实验会自动收集以下数据：

1. **基本信息**
   - 被试ID（基于手机号后四位生成）
   - 分组信息（实验组/对照组）
   - 实验开始和结束时间

2. **时间戳**
   - 每个实验步骤的精确时间
   - 格式：YYYY-MM-DD HH:MM:SS

3. **问卷数据**
   - 前测问卷（个人背景、WIS量表、知识测试）
   - 后测问卷（参与度、WIS量表、知识测试、状态焦虑）
   - 第三次问卷（可接受性、开放性问题）
   - 第四次问卷（状态检查）

4. **聊天记录**
   - 时间戳
   - 发送方（用户/AI）
   - 对话内容

5. **危机评估**
   - 危机等级评估结果
   - 评估理由

6. **AI督导反馈**
   - 个性化反馈内容

### 数据保存

实验结束后，数据会：

1. **自动下载到本地**
   - 文件名格式：`实验数据_被试ID.xlsx`
   - 包含所有实验数据

2. **上传到服务器**
   - 上传到配置的服务器地址
   - 用于数据备份

### 数据格式

所有数据保存在Excel文件中，包含多个工作表：

- 基本信息
- 时间戳
- 问卷数据
- 聊天记录
- 危机评估
- AI督导反馈

## 🎮 实验流程

### 参与者体验

1. **知情同意** - 阅读并同意参与研究
2. **随机分组** - 系统自动分配实验组/对照组
3. **个人信息** - 输入手机号后四位
4. **前测问卷** - 填写基础信息和量表
5. **视频学习** - 观看培训视频
6. **练习阶段**
   - 实验组：与AI虚拟来访者对话（10分钟）
   - 对照组：观摩PDF材料（10分钟）
7. **后测问卷** - 评估学习效果
8. **二次练习** - 所有人与新的AI来访者对话
9. **危机评估** - 评估来访者危机等级
10. **体验问卷** - 评估AI练习体验
11. **AI督导反馈** - 获得个性化反馈
12. **状态检查** - 检查练习后的状态

### 进度显示

页面顶部显示进度条，让参与者了解实验进度（0%-100%）。

## 🤖 AI交互说明

### AI虚拟来访者

系统包含两个AI虚拟来访者角色：

- **小B**：学业压力导致的自杀倾向
- **小C**：校园霸凌导致的自杀倾向

AI会根据设定的角色特点进行回应，包括：

- 口语化的表达方式
- 情绪化的反应
- 逐步透露信息
- 对不同类型的咨询回应有不同反应

### AI督导

系统会自动分析参与者的对话记录，从四个维度提供反馈：

1. **建立关系** - 共情、倾听技巧
2. **评估风险因素** - 识别关键风险点
3. **评估保护性因素** - 探索保护性因素
4. **询问自杀相关内容** - 全面温和的询问

## ⚠️ 注意事项

1. **API密钥安全**
   - 不要在公开场合暴露API密钥
   - 定期更换密钥
   - 使用环境变量存储敏感信息

2. **数据隐私**
   - 确保数据上传地址安全
   - 遵守数据保护法规
   - 及时清理测试数据

3. **技术支持**
   - 建议使用现代浏览器（Chrome、Firefox、Edge）
   - 确保网络连接稳定
   - 测试API调用是否正常

## 🔍 故障排除

### 常见问题

1. **AI不回应**
   - 检查API密钥是否正确
   - 检查网络连接
   - 查看浏览器控制台错误信息

2. **数据未上传**
   - 检查上传服务器地址
   - 检查服务器是否正常运行
   - 查看浏览器网络请求

3. **PDF无法显示**
   - 检查PDF文件路径
   - 确保PDF文件存在
   - 检查浏览器是否支持PDF预览

### 调试模式

在浏览器中按F12打开开发者工具，查看控制台（Console）中的错误信息。

## 📞 技术支持

如有技术问题，可以：

1. 检查浏览器控制台错误信息
2. 确认API配置是否正确
3. 验证网络连接是否正常

## 📄 许可说明

本项目仅用于研究目的。使用AI API时请遵守相应的服务条款。

## 🔄 更新日志

- v1.0.0: 初始版本
  - 实现完整的实验流程
  - 支持AI对话和督导反馈
  - 自动数据收集和保存

---

**注意事项：**

- 本项目使用jsPsych 7.3.3版本
- 需要现代浏览器支持
- API调用需要稳定的网络连接
- 数据保存需要服务器支持

<div align="center">

<h1 style="color:red">Supercell 🚀</h1>

**Local-first AI 应用平台**

连接任意 OpenAI 兼容端点（LM Studio / Ollama / OpenAI 等），提供多轮对话、Agent 团队协作、数据分析三大核心能力。

[![Node.js >= 18](https://img.shields.io/badge/Node.js->=18-green)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: Private](https://img.shields.io/badge/License-Private-gray)](#)

</div>

---

## 目录

- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [常用脚本](#常用脚本)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [技术细节](#技术细节)
- [Agent Team API](#agent-team-api)
- [贡献指南](#贡献指南)

---

## 核心功能

### 💬 Chat — 多轮对话

与任意大模型进行多轮对话，支持多会话管理、流式输出和模型动态切换。

| 特性 | 说明 |
|------|------|
| 多会话管理 | 多会话并行，随时切换 |
| 流式输出 | SSE 实时响应 |
| 主题切换 | 暗色 / 亮色（跟随系统） |
| 快捷键 | `Enter` 发送 / `Shift+Enter` 换行 |

### 🤖 Agent Team — 智能体协作

多角色 Agent 并行审查与协作，可自定义角色组合。

- **Developer + Tester** 双角色并行审查代码
- 可扩展 `Product` / `PM` 等自定义角色
- 定时任务调度，运行历史查询

### 📊 DataLens — 自然语言数据分析

上传 CSV，用自然语言查询数据并自动生成图表。

- CSV 导入 → Text-to-SQL（DuckDB）→ ECharts 可视化
- 用自然语言直接查询数据，无需写 SQL
- 支持柱状图、折线图、饼图等多种图表类型

### 🔗 其他能力

- 社交关系图谱分析

---

## 快速开始

### 前置要求

- Node.js >= 18
- npm / yarn / pnpm

### 安装与启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 API 地址和密钥

# 3. 启动前端
npm run dev

# 4. 启动后端（Agent / DataLens 功能需要）
npm run dev:server
```

> 前端访问地址：**http://localhost:5173**

### 仅使用 Chat 功能

如果只需要聊天功能，只需启动前端（步骤 1~3），配置好 `VITE_OPENAI_BASE_URL` 和 `VITE_OPENAI_API_KEY` 即可。

---

## 环境变量

| 变量 | 必填 | 用途 | 示例 |
|------|:----:|------|------|
| `VITE_OPENAI_BASE_URL` | ✅ | OpenAI 兼容 API 地址 | `http://localhost:1234/v1` |
| `VITE_OPENAI_API_KEY` | ✅ | API 密钥 | `lm-studio` |
| `VITE_OPENAI_MODEL` | — | 默认模型 | `gpt-4o` |
| `AGENT_MODEL_DEVELOPER` | — | Developer 角色模型 | `claude` |
| `AGENT_MODEL_TESTER` | — | Tester 角色模型 | `codex` |

**模型路由优先级：**

```
AGENT_MODEL_{ROLE} → AGENT_MODEL → VITE_OPENAI_MODEL → local-model
```

---

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 前端开发服务器 |
| `npm run dev:server` | 后端开发服务器（watch 模式） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run test` | Vitest 交互模式 |
| `npm run test:run` | Vitest 单次运行 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| **前端** | React 19 (React Compiler) · TypeScript · Vite · Tailwind CSS v4 · Zustand/Immer |
| **后端** | Express 5 · OpenAI SDK · DuckDB · better-sqlite3 |
| **可视化** | ECharts 6 |
| **测试** | Vitest · Testing Library |

---

## 项目结构

```
src/
├── features/       # 业务功能模块（csv-import 等）
├── datalens/       # DataLens 前端
├── store/          # Zustand stores
├── service/        # API 调用层
├── uikit/          # 通用 UI 组件
└── createStore/    # Store 工厂

server/
├── agents/         # Agent 角色定义与编排
├── datalens/       # Text-to-SQL 管线（DuckDB）
├── routes/         # Express 路由
├── db/             # SQLite 持久化
├── loop/           # 定时任务
└── utils/          # LLM 调用、代码读取等工具
```

---

## 技术细节

<details>
<summary>📦 Store 架构</summary>

自研 `createLocalStore` / `createStore` 工厂，封装 Zustand + Immer + persist：

```ts
const store = createLocalStore("key", initialState, (api) => ({
  // actions 直接 mutate draft（Immer），自动持久化到 localStorage
}));

// 组件中使用
const { state, actions } = store.useSelector((s) => s.someSlice);
```

提供 `useSelector`（自动 shallow 对比）、`useSelectorWatch`（订阅变化回调）、`getState` / `setState` 外部访问。

</details>

<details>
<summary>🤖 Agent 系统</summary>

**架构：** 抽象基类 `BaseAgent` → 具体角色（Developer / Tester / Product / PM / XiaoQ）

**每个 Agent 运行流程：**

1. `buildSystemPrompt()` — 构建系统提示词
2. `buildUserPrompt()` — 构建用户提示词
3. `run()` — 调用 LLM，返回结果
4. 结果持久化到 SQLite

**定时任务：** `loop/` 目录下的调度器按配置周期触发 Agent 运行。

</details>

<details>
<summary>📊 DataLens 数据分析</summary>

**流程：**

```
CSV 文件 → DuckDB 自动建表 → LLM 生成 SQL → 执行查询 → ECharts 配置生成
```

**关键设计：**

- **DuckDB in-memory** — CSV 导入即建表，`read_csv_auto` 自动推断类型
- **SQL 安全** — 白名单模式，只允许 `SELECT`/`WITH`，屏蔽 DDL 和写操作
- **Few-shot prompting** — 4 个示例覆盖 bar/line/pie/scalar 场景
- **Chart 生成是确定性的** — 不走 LLM，根据推荐类型 + 数据直接构造 ECharts option
- **Schema 上下文** — 向 LLM 注入 DDL + 列样本值，提高生成准确率

</details>

<details>
<summary>⚙️ 后端服务</summary>

- Express 5，端口 3999（可配）
- BigInt 全局 JSON 序列化处理（DuckDB 返回 BigInt）
- CORS 开放（本地开发）
- 优雅关闭（5s 超时强制退出）
- 路由：`/api/agents`（Agent 团队）、`/api/datalens`（数据分析）、`/health`

</details>

---

## Agent Team API

### 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/agents/run` | 运行 Agent 团队 |
| `GET` | `/api/agents` | 列出可用角色 |

### 运行示例

```bash
# 运行默认团队（developer + tester 并行）
curl -X POST http://localhost:3999/api/agents/run

# 指定角色子集
curl -X POST http://localhost:3999/api/agents/run \
  -H "Content-Type: application/json" \
  -d '{"agents": ["developer", "tester"]}'

# 列出可用角色
curl http://localhost:3999/api/agents
```

---

## 贡献指南

欢迎提交 Issue 和 Pull Request。开发前请：

1. Fork 本项目并创建特性分支
2. 运行 `npm run lint` 确保代码规范
3. 运行 `npm run test:run` 确保测试通过
4. 提交 PR 时附上变更说明

---

## License

Private

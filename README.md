# Supercell 🚀

> Local-first AI 应用平台，连接任意 OpenAI 兼容端点（LM Studio / Ollama / OpenAI 等），提供多轮对话、Agent 团队协作、数据分析三大核心能力。

*Last updated: 2026-05-19*

## 核心功能

| 模块 | 说明 |
|------|------|
| **Chat** | 多会话管理、流式输出、模型动态切换 |
| **Agent Team** | Developer + Tester 双角色并行审查，可扩展 product / pm 等角色 |
| **DataLens** | CSV 导入 → Text-to-SQL（DuckDB）→ ECharts 可视化，自然语言查数据 |

其他亮点：
- 社交关系图谱分析
- 暗色/亮色主题（跟随系统）
- Enter 发送 / Shift+Enter 换行

## 快速开始

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

前端访问 http://localhost:5173

## 环境变量

| 变量 | 用途 | 示例 |
|------|------|------|
| `VITE_OPENAI_BASE_URL` | OpenAI 兼容 API 地址 | `http://localhost:1234/v1` |
| `VITE_OPENAI_API_KEY` | API 密钥 | `lm-studio` |
| `AGENT_MODEL_DEVELOPER` | Developer 角色模型 | `claude` |
| `AGENT_MODEL_TESTER` | Tester 角色模型 | `codex` |

## 技术栈

- **前端** — React 19 (React Compiler) + TypeScript + Vite + Tailwind CSS v4 + Zustand/Immer
- **后端** — Express 5 + OpenAI SDK + DuckDB + better-sqlite3
- **可视化** — ECharts 6
- **测试** — Vitest + Testing Library

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

## 技术细节

### Store 架构

自研 `createLocalStore` / `createStore` 工厂，封装 Zustand + Immer + persist：

```ts
const store = createLocalStore("key", initialState, (api) => ({
  // actions 直接 mutate draft（Immer），自动持久化到 localStorage
}));

// 组件中使用
const { state, actions } = store.useSelector((s) => s.someSlice);
```

提供 `useSelector`（自动 shallow 对比）、`useSelectorWatch`（订阅变化回调）、`getState`/`setState` 外部访问。

### Agent 系统

**架构：** 抽象基类 `BaseAgent` → 具体角色（Developer / Tester / Product / PM / XiaoQ）

每个 Agent 运行流程：
1. `buildSystemPrompt()` — 定义角色职责和关注领域
2. `buildUserMessage(context)` — 收集项目源码/上下文
3. 调用 LLM，强制返回结构化 JSON（score / findings / iterations）
4. 持久化到 SQLite（WAL 模式）

**编排器（Orchestrator）：**
- `Promise.allSettled` 并行运行多个 Agent
- 支持 cron 定时调度（node-cron）
- 单 Agent 防重入锁
- 结果缓存 + 运行历史查询

**数据模型：**
```
agent_runs   → 运行记录（状态、评分、摘要）
findings     → 发现的问题（severity × priority 排序）
iterations   → 改进建议（effort × impact 排序）
```

### DataLens 管线

```
用户提问 → Text-to-SQL (LLM) → DuckDB 执行 → 自动纠错（最多 2 次）→ ECharts 配置生成
```

关键设计：
- **DuckDB in-memory** — CSV 导入即建表，`read_csv_auto` 自动推断类型
- **SQL 安全** — 白名单模式，只允许 SELECT/WITH，屏蔽 DDL 和写操作
- **Few-shot prompting** — 4 个示例覆盖 bar/line/pie/scalar 场景
- **Chart 生成是确定性的** — 不走 LLM，根据推荐类型 + 数据直接构造 ECharts option
- **Schema 上下文** — 向 LLM 注入 DDL + 列样本值，提高生成准确率

### 后端服务

- Express 5，端口 3999（可配）
- BigInt 全局 JSON 序列化处理（DuckDB 返回 BigInt）
- CORS 开放（本地开发）
- 优雅关闭（5s 超时强制退出）
- 路由：`/api/agents`（Agent 团队）、`/api/datalens`（数据分析）、`/health`

## Agent Team API

```bash
# 运行默认团队（developer + tester 并行）
POST /api/agents/run

# 指定角色子集
POST /api/agents/run  { "agents": ["developer", "tester"] }

# 列出可用角色
GET /api/agents
```

模型路由优先级：`AGENT_MODEL_{ROLE}` → `AGENT_MODEL` → `VITE_OPENAI_MODEL` → `local-model`

## 脚本

```bash
npm run dev            # 前端开发服务器
npm run dev:server     # 后端开发服务器（watch）
npm run build          # 类型检查 + 生产构建
npm run lint           # ESLint
npm run test           # Vitest 交互模式
npm run test:run       # Vitest 单次运行
```

## License

Private

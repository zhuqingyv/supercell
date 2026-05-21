# Supercell 测试策略框架

## 1. 项目概述

Supercell 是一个"虚拟办公室"项目，为 AI Agent 提供虚拟办公环境，用户以游戏化方式管理 AI 团队。
技术栈：React 19 + Zustand + TypeScript + Express + SQLite + OpenAI SDK，前端 Vite 构建，后端 tsx 运行。

---

## 2. 测试范围划分（按模块）

| 模块 | 描述 | 关键文件/目录 | 优先级 |
|------|------|-------------|--------|
| **角色系统** | 角色定义、Agent 实例管理、多角色协作 | `server/agents/*.ts` (11个角色文件) | P0 |
| **工作空间** | 员工记忆维护、项目笔记、经验存储 | `server/db/`, `server/utils/codeReader.ts` | P0 |
| **聊天系统** | 对话管理、消息流式传输、侧边栏交互 | `src/store/`, `src/uikit/ChatSidebar/`, `src/uikit/Message/`, `src/uikit/UserInput/` | P0 |
| **办公软件** | Tools 动态注入、虚拟界面 | `server/agents/orchestrator.ts`, `server/routes/` | P1 |
| **API 路由层** | Express 路由、参数校验、错误处理 | `server/routes/agents.ts`, `server/routes/agents.validation.ts` | P1 |
| **LLM 集成** | OpenAI SDK 调用、流式响应、模型切换 | `server/utils/llm.ts`, `src/service/` | P1 |
| **视觉/动画** | Q版像素风、骨骼动画、员工状态展示 | 待开发（Cocos/Phaser/PixiJS） | P2 |
| **提示词系统** | 角色感知、环境感知、任务理解 | `server/agents/base.ts`, 各角色 prompt | P1 |
| **持久化** | localStorage 持久化、SQLite 数据库 | `src/createStore/`, `server/db/` | P0 |

---

## 3. 测试类型规划

### 3.1 单元测试（Unit Test）
- **工具**: Vitest + jsdom + @testing-library/react
- **范围**:
  - Store 层：状态操作、持久化读写、边界场景（已有 `store.test.ts`, `store-actions.test.ts`）
  - UI 组件：ChatSidebar、Message、UserInput 的渲染和交互（已有部分测试）
  - Service 层：API 调用封装、参数处理（已有 `role.test.ts`, `service.test.ts`）
  - Server 端：路由注册顺序、参数校验（已有 `agents.routes.test.ts`, `agents.validation.test.ts`）
  - Agent 角色：各角色 prompt 生成、输入输出格式
  - 工具函数：`codeReader.ts`, `llm.ts` 的核心逻辑
- **覆盖率目标**: 核心业务逻辑 ≥ 80%

### 3.2 集成测试（Integration Test）
- **工具**: Vitest + supertest（server 端）
- **范围**:
  - API 端到端：请求 → 路由 → Agent 调用 → 响应（mock LLM）
  - Store ↔ Service 联动：用户操作 → API 调用 → 状态更新
  - 多 Agent 协作流程：Orchestrator 调度多角色执行任务
  - 数据库操作：SQLite 读写完整链路
- **覆盖率目标**: 核心链路 100% 覆盖

### 3.3 E2E 测试（End-to-End）
- **工具**: Playwright
- **范围**:
  - 新建对话 → 发送消息 → 收到流式回复 → 持久化验证
  - 侧边栏操作：新建/删除/切换/重命名对话
  - 角色管理：创建员工、查看工作空间、搜索
  - 响应式布局：移动端侧栏折叠/展开
- **执行策略**: CI 中仅跑 smoke test，完整套件手动/定时触发

### 3.4 性能测试
- **工具**: Lighthouse CI + 自定义 benchmark
- **范围**:
  - 首屏加载时间（Vite 构建产物体积）
  - 长对话场景：100+ 消息时的渲染性能
  - 流式消息渲染帧率（不低于 30fps）
  - Agent 并发调度：多角色同时工作时的服务端吞吐
  - SQLite 查询性能：大量历史记录时的读写延迟
- **执行策略**: 关键路径每次 PR 检查，完整性能测试周维度

### 3.5 视觉回归测试
- **工具**: Playwright screenshot + Percy 或 Chromatic（接入 Storybook）
- **范围**:
  - 聊天界面基准截图
  - 组件库（Message、UserInput、ChatSidebar）各状态截图
  - 像素风动画帧关键帧对比（视觉模块开发后）
- **执行策略**: PR 时自动截图对比，阈值 0.1% 像素差异

---

## 4. 核心功能验收标准

### 4.1 角色系统
- [ ] 能创建包含名称、简介、职位的角色
- [ ] 每个角色支持最多 3 个 Agent 实例（干活/整理记忆/聊天）
- [ ] 角色间通信消息正确路由
- [ ] 角色 prompt 包含正确的身份、环境、任务上下文
- [ ] 无效角色名返回明确错误

### 4.2 工作空间
- [ ] 员工记忆持久化并可跨会话恢复
- [ ] 项目笔记 CRUD 操作正确
- [ ] 搜索功能能检索笔记、代码仓库等工作痕迹
- [ ] 工作空间数据隔离（不同员工不互串）

### 4.3 聊天系统
- [ ] 消息发送后立即出现在界面
- [ ] 流式回复逐字渲染，无丢字
- [ ] 对话列表增删改查正确
- [ ] 切换对话时消息列表正确切换
- [ ] localStorage 持久化：刷新后数据恢复
- [ ] isLoading 状态正确阻止重复提交

### 4.4 办公软件模块
- [ ] Tools 动态注入后 Agent 能正确调用
- [ ] 虚拟界面正确反映 Tool 执行结果
- [ ] Git 操作模块：clone/commit/push 基本流程
- [ ] 管理模块：创建/解雇员工流程完整

### 4.5 LLM 集成
- [ ] 支持模型切换（至少 qwen2.5-7b-instruct-1m）
- [ ] 流式响应正确拼接为完整回复
- [ ] LLM 调用失败时有明确错误提示
- [ ] Token 用量不超预期（prompt 膨胀控制）

---

## 5. 测试工具选型

| 用途 | 工具 | 理由 |
|------|------|------|
| 单元/集成测试 | **Vitest** | 项目已集成，与 Vite 无缝配合，速度快 |
| 组件测试 | **@testing-library/react** | 项目已集成，面向用户行为测试 |
| DOM 环境 | **jsdom** | 项目已配置，轻量够用 |
| 覆盖率 | **@vitest/coverage-v8** | 项目已集成 |
| E2E 测试 | **Playwright** | 跨浏览器支持好，API 简洁，支持截图对比 |
| API 测试 | **supertest** | Express 集成测试标准方案，需新增 |
| 视觉回归 | **Playwright screenshots** | 复用 E2E 基础设施，零额外成本 |
| 性能监控 | **Lighthouse CI** | CI 集成成熟，指标全面 |
| 组件文档/视觉 | **Storybook**（可选） | 组件隔离开发+视觉回归，视觉模块开发时引入 |

---

## 6. 风险区域标注

### 高风险（必须重点测试）
| 风险区域 | 原因 | 建议措施 |
|----------|------|---------|
| **多 Agent 协作调度** (`orchestrator.ts`) | 并发控制复杂，角色间通信容易丢消息 | 集成测试覆盖完整调度链路，mock 各角色 |
| **流式消息处理** | SSE/Stream 拼接易出现丢字、乱序、连接断开 | 单元测试覆盖各种 chunk 拆分场景 |
| **提示词膨胀** | Tools 注入导致 prompt token 爆炸，Claude 同类问题 | 监控每次调用的 token 数，设置阈值报警 |
| **localStorage 持久化** | 数据格式迁移、存储容量上限、并发写入 | 已有测试，需补充版本迁移和容量边界测试 |
| **Agent 记忆系统** | 记忆读写一致性、跨会话恢复、数据隔离 | 集成测试覆盖完整生命周期 |

### 中风险
| 风险区域 | 原因 | 建议措施 |
|----------|------|---------|
| **SQLite 并发** (`better-sqlite3`) | 多 Agent 同时写入可能锁冲突 | 压测并发写入场景 |
| **Express 路由参数** | 动态路由 `/:name` 可能匹配到静态路由 | 已有路由顺序测试，需持续维护 |
| **前端性能** | 长对话渲染、大量组件实例 | 性能测试覆盖极端场景 |

### 低风险（但需关注）
| 风险区域 | 原因 |
|----------|------|
| 视觉/动画模块 | 尚未开发，技术选型未定 |
| Cron 定时任务 | `node-cron` 相对稳定，但需测试任务取消/重启 |

---

## 7. 自动化测试策略

### 7.1 CI 流水线集成
```
PR 提交 → Lint → 单元测试 → 集成测试 → 覆盖率检查 → (E2E smoke)
                                                    ↓
合并 main → 完整 E2E → 性能测试 → 视觉回归
```

### 7.2 执行频率
| 测试类型 | 触发时机 | 预期耗时 |
|----------|---------|---------|
| 单元测试 | 每次 PR | < 30s |
| 集成测试 | 每次 PR | < 2min |
| E2E smoke | 每次 PR | < 3min |
| 完整 E2E | 合并 main | < 10min |
| 性能测试 | 每周 / 手动 | < 5min |
| 视觉回归 | 每次 PR（组件变更时） | < 2min |

### 7.3 覆盖率门禁
- 全局行覆盖率 ≥ 70%
- 核心模块（store, service, agents）≥ 80%
- 新增代码覆盖率 ≥ 90%
- PR 不允许降低已有覆盖率

### 7.4 测试数据管理
- 单元测试：硬编码 fixture + factory 函数
- 集成测试：SQLite 内存数据库（`:memory:`），每个 suite 独立
- E2E 测试：seed 脚本初始化标准数据，测试后清理

### 7.5 现有测试盘点
| 文件 | 类型 | 覆盖模块 |
|------|------|---------|
| `src/store/store.test.ts` | 单元 | Store 核心操作、持久化 |
| `src/store/store-actions.test.ts` | 单元 | Store actions |
| `src/uikit/ChatSidebar/ChatSidebar.test.tsx` | 组件 | 侧边栏交互 |
| `src/uikit/Message/Message.test.tsx` | 组件 | 消息展示 |
| `src/uikit/UserInput/UserInput.test.tsx` | 组件 | 输入框交互 |
| `src/service/role.test.ts` | 单元 | 角色 service |
| `src/service/service.test.ts` | 单元 | Service 层 |
| `server/routes/agents.routes.test.ts` | 集成 | 路由注册顺序 |
| `server/routes/agents.validation.test.ts` | 单元 | 参数校验 |

### 7.6 待补充测试（按优先级）
1. **P0** — `server/agents/base.ts` 基础 Agent 类单元测试
2. **P0** — `server/agents/orchestrator.ts` 调度逻辑集成测试
3. **P0** — `server/utils/llm.ts` LLM 调用层（mock OpenAI SDK）
4. **P1** — `server/db/index.ts` 数据库操作完整测试
5. **P1** — 各角色 Agent（pm, developer, architect 等）prompt 输出测试
6. **P1** — `src/service/` 流式响应处理测试
7. **P2** — E2E 基础流程（Playwright 搭建）
8. **P2** — 性能基线建立

---

## 8. 测试命名与组织规范

```
src/
  store/
    store.test.ts          # 单元测试与源码同目录
  uikit/
    ChatSidebar/
      ChatSidebar.test.tsx  # 组件测试与组件同目录
server/
  routes/
    agents.routes.test.ts   # server 端测试同目录
tests/
  e2e/                      # E2E 测试独立目录（待建）
  fixtures/                 # 共享测试数据（待建）
```

- 测试文件命名：`{模块名}.test.ts(x)`
- describe 块：中文描述功能模块
- it 块：中文描述具体行为（保持与现有风格一致）

---

## 9. 集成测试工程师交叉审核意见

> 审核人：tester-integration
> 审核日期：2026-04-02

### 9.1 总体评价

测试策略框架结构清晰，模块划分合理，风险标注基本准确。以下为具体审核意见和补充方案。

### 9.2 测试范围审核

**已覆盖（9大模块中的7个）：** 角色系统、工作空间、聊天系统、办公软件、API路由层、LLM集成、持久化

**遗漏或不足：**

1. **迭代循环（Loop）系统** — `server/loop/types.ts` 定义了完整的6阶段迭代流程（PM分析 → PM辩论 → 需求共识 → 开发实现 → 测试 → PM评估），这是多Agent协作的核心链路，但策略中未单独列为测试模块。建议升级为 **P0**。

2. **提示词系统测试深度不足** — 策略仅提到"各角色 prompt 输出测试"（P1），但需求文档明确指出"提示词是重中之重"。建议：
   - 每个Agent的 `buildSystemPrompt()` 和 `buildUserMessage()` 需要独立测试
   - 验证 handoff 上下文正确注入
   - 验证 RESPONSE_SCHEMA 被正确嵌入每个 prompt
   - Token 膨胀监控：对每个角色的 prompt 输出长度设置上限断言

3. **Cron 调度模块** — 标为低风险偏保守。`scheduleCron` 涉及状态管理（stop旧任务→创建新任务），`stopCron` 需验证资源释放。建议提升为中风险。

### 9.3 风险区域补充

| 风险区域 | 级别 | 原因 | 策略中状态 |
|----------|------|------|-----------|
| **迭代循环状态机** | 高 | 6阶段流程任意阶段失败需正确回退，`is_stunning` 判断终止条件 | 未提及 |
| **Agent 重复执行防护** | 高 | `orchestrator.ts:68` 用 Set 防重入，并发竞态可能绕过 | 未提及 |
| **LLM JSON 解析容错** | 高 | `extractJSON` 依赖正则提取 JSON，LLM 输出格式不可控 | 部分提及 |
| **BaseAgent.run() 错误传播** | 中 | catch 块调用 `finishRun` 后 re-throw，上层需正确处理 | 未提及 |
| **codeReader 符号链接循环** | 中 | `listSourceFiles` 有 `_visited` 防循环，但 `realpath` 可能抛异常 | 未提及 |
| **DB 事务完整性** | 中 | `insertFindings`/`insertIterations` 用事务批量写入，异常时需回滚 | 部分提及 |

### 9.4 现有测试质量审核

**优点：**
- 组件测试面向用户行为，使用 `screen.getByRole` 等语义查询
- Store 测试覆盖了边界场景（删最后一条、空列表自动补回）
- Service 测试验证了缓存机制

**问题：**

1. **Store 测试绕过 actions** — `store.test.ts` 直接用 `store.setState` 操作状态，未通过 actions 层测试。这意味着 actions 中的业务逻辑（如 `commitChat` 的 fallback 查找逻辑）实际未被测试。建议补充通过 actions 调用的测试。

2. **ChatSidebar 测试 mock 过重** — 完全 mock 了 store，导致 selector 逻辑未被覆盖。建议至少有一组测试使用真实 store。

3. **路由测试覆盖不足** — `agents.routes.test.ts` 仅测试路由注册顺序（1个case），未覆盖任何实际请求处理逻辑。

4. **缺少负面测试** — 现有测试几乎全是 happy path。需要补充：恶意输入、超大 payload、并发请求等。

### 9.5 工具选型审核

**同意：** Vitest、RTL、jsdom、coverage-v8、Playwright — 均为项目已集成或生态匹配的工具。

**补充建议：**

| 用途 | 建议工具 | 理由 |
|------|---------|------|
| HTTP 集成测试 | **supertest** 或直接用 Express `app.listen` + `fetch` | supertest 需额外依赖，对 Express 5 兼容性需验证。替代方案：直接启动 app 用 `node:fetch` 测试，零依赖 |
| LLM Mock | **msw (Mock Service Worker)** | 拦截 OpenAI SDK 的 HTTP 请求，比 `vi.mock` 更贴近真实行为，前后端通用 |
| SQLite 测试 | **`:memory:` 模式** + 测试前 `initSchema` | 策略已提及，补充：每个 test suite 需独立 DB 实例，避免并行测试互相干扰 |
| 并发测试 | **p-limit / 手写 Promise.all** | 验证 orchestrator 并发防护 |

### 9.6 覆盖率门禁修订建议

策略中的门禁：
- 全局 >= 70%，核心模块 >= 80%，新增代码 >= 90%

**建议调整：**
- `server/agents/base.ts` + `server/agents/orchestrator.ts` 行覆盖率 >= **90%**（核心调度逻辑，出错影响全局）
- `server/db/index.ts` 分支覆盖率 >= **85%**（SQL 操作需覆盖所有条件分支）
- `server/utils/llm.ts` 行覆盖率 >= **90%**（retry、timeout、JSON解析 全路径覆盖）

---

## 10. 集成测试详细方案

### 10.1 Server 端集成测试

#### 10.1.1 BaseAgent.run() 全链路测试

**文件**: `server/agents/base.integration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDB, closeDB } from "../db/index.js";

// Mock LLM 层，不 mock DB
vi.mock("../utils/llm.js", () => ({
  callLLM: vi.fn(),
  extractJSON: vi.fn(),
}));

import { callLLM, extractJSON } from "../utils/llm.js";
import type { AgentRunContext } from "./base.js";

// 创建一个具体的测试 Agent 子类
class TestAgent {
  readonly name = "test-agent";
  readonly description = "Test agent for integration tests";

  // 继承 BaseAgent 并实现抽象方法
  // ... (实际测试中 import BaseAgent 并 extends)
}

describe("BaseAgent.run() 集成测试", () => {
  beforeEach(() => {
    // 使用内存 DB 或清理测试数据
    vi.clearAllMocks();
  });

  afterEach(() => {
    closeDB();
  });

  it("正常执行：LLM返回 -> JSON解析 -> DB写入 findings + iterations", async () => {
    const mockResponse = {
      score: 8,
      summary: "Good quality code",
      findings: [{ severity: "medium", category: "style", description: "test", priority: 3 }],
      iterations: [{ action: "Refactor X", effort: "small", impact: "high" }],
    };
    (callLLM as any).mockResolvedValue("raw response");
    (extractJSON as any).mockReturnValue(mockResponse);

    // 执行 agent.run()
    // 验证: DB 中 agent_runs 表有新记录，status=done, score=8
    // 验证: findings 表有 1 条记录
    // 验证: iterations 表有 1 条记录
    // 验证: 返回值包含正确的 runId, durationMs > 0
  });

  it("LLM 调用失败：DB 记录 error 状态，异常向上传播", async () => {
    (callLLM as any).mockRejectedValue(new Error("LLM timeout"));

    // 验证: agent_runs 表 status=error, error="LLM timeout"
    // 验证: findings/iterations 表无新记录
    // 验证: 抛出异常
  });

  it("JSON 解析失败：DB 记录 error，findings/iterations 不写入", async () => {
    (callLLM as any).mockResolvedValue("not json");
    (extractJSON as any).mockImplementation(() => { throw new Error("parse failed"); });

    // 验证同上
  });

  it("findings 超过 20 条时截断", async () => {
    const findings = Array.from({ length: 25 }, (_, i) => ({
      severity: "low", category: `cat-${i}`, description: `desc-${i}`, priority: 3,
    }));
    (extractJSON as any).mockReturnValue({ score: 5, summary: "ok", findings, iterations: [] });

    // 验证: 返回值 findings.length === 20
    // 验证: DB 中 findings 表只有 20 条
  });

  it("iterations 超过 10 条时截断", async () => {
    const iterations = Array.from({ length: 15 }, (_, i) => ({
      action: `action-${i}`, effort: "small", impact: "low",
    }));
    (extractJSON as any).mockReturnValue({ score: 5, summary: "ok", findings: [], iterations });

    // 验证: 返回值 iterations.length === 10
  });
});
```

#### 10.1.2 Orchestrator 调度集成测试

**文件**: `server/agents/orchestrator.integration.test.ts`

```typescript
describe("Orchestrator 调度集成测试", () => {
  it("runAgent -- 正常执行单个 agent 并缓存结果", async () => {
    // mock 对应 agent 的 run 方法
    // 验证: state.cache 中有结果
    // 验证: state.running 在执行后为空
    // 验证: state.lastRunAt 已更新
  });

  it("runAgent -- 同名 agent 重复执行抛出错误", async () => {
    // 让第一个 agent 永远 pending
    // 同时调用第二个 runAgent(同名)
    // 验证: 抛出 "already running" 错误
  });

  it("runAgents -- 并发执行多个 agent，部分失败不影响其他", async () => {
    // mock developer 成功，tester 失败
    // 验证: 返回 1 个结果（developer）
    // 验证: 控制台有 tester 的错误日志
  });

  it("runAgents -- 全部失败时抛出聚合错误", async () => {
    // mock 所有 agent 都失败
    // 验证: 抛出 "All selected agents failed" 错误
    // 验证: 错误消息包含所有失败原因
  });

  it("runAllAgents -- 执行全部 5 个 agent", async () => {
    // 验证: 返回 5 个结果
    // 验证: 每个 agent 名称都在结果中
  });

  it("scheduleCron -- 无效表达式抛出错误", () => {
    // 验证: "Invalid cron expression" 错误
  });

  it("scheduleCron -- 重复调度覆盖旧任务", () => {
    // 调度两次
    // 验证: 只有一个活跃的 cron 任务
  });

  it("stopCron -- 停止后 getStatus 反映变化", () => {
    // 先 schedule，再 stop
    // 验证: cronActive=false, cronSchedule=null
  });

  it("getStatus -- 正确反映当前运行状态", async () => {
    // 验证: activeAgents 包含正在运行的 agent
    // 验证: lastRunAt 格式为 ISO 8601
  });
});
```

#### 10.1.3 API 路由集成测试

**文件**: `server/routes/agents.integration.test.ts`

方案：直接启动 Express app，用 fetch 发请求（零额外依赖）

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

let server: any;
let baseUrl: string;

beforeAll(async () => {
  // 动态 import app，绑定随机端口
  // baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
});

describe("GET /api/agents", () => {
  it("返回所有 agent 列表", async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.agents).toBeInstanceOf(Array);
    expect(json.agents.length).toBe(5);
    expect(json.agents[0]).toHaveProperty("name");
    expect(json.agents[0]).toHaveProperty("description");
  });
});

describe("GET /api/agents/status", () => {
  it("返回 orchestrator 状态和最新运行记录", async () => {
    const res = await fetch(`${baseUrl}/api/agents/status`);
    const json = await res.json();
    expect(json.orchestrator).toHaveProperty("cronActive");
    expect(json.orchestrator).toHaveProperty("activeAgents");
    expect(json.runs).toBeInstanceOf(Array);
  });
});

describe("POST /api/agents/run", () => {
  it("无 body 时运行默认团队 (developer+tester)", async () => {
    // mock LLM，验证返回 2 个结果
  });

  it("指定 agents 数组运行对应角色", async () => {
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents: ["product"] }),
    });
    expect(res.status).toBe(200);
  });

  it("无效 agent 名返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents: ["invalid-agent"] }),
    });
    expect(res.status).toBe(400);
  });

  it("重复 agent 名返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agents: ["developer", "developer"] }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("duplicate");
  });
});

describe("POST /api/agents/:name/run", () => {
  it("有效 agent 名返回运行结果", async () => {
    // mock LLM
    const res = await fetch(`${baseUrl}/api/agents/developer/run`, { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("无效 agent 名返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/nonexistent/run`, { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("agent 正在运行时返回 409", async () => {
    // 让 agent 持续运行中，再次请求
    // 验证 409 Conflict
  });

  it("别名解析: dev -> developer, qa -> tester", async () => {
    // 验证 /api/agents/dev/run 等价于 /api/agents/developer/run
  });
});

describe("POST /api/agents/cron/start", () => {
  it("有效 cron 表达式返回 ok", async () => {
    const res = await fetch(`${baseUrl}/api/agents/cron/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: "0 * * * *" }),
    });
    expect(res.status).toBe(200);
  });

  it("无效 cron 表达式返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/cron/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: "invalid" }),
    });
    expect(res.status).toBe(400);
  });

  it("缺少 schedule 字段返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/cron/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/agents/iterations/:id", () => {
  it("有效 id + status=done 返回 ok", async () => {
    // 先创建一条 iteration 记录，获取 id
    // PATCH 更新状态
  });

  it("无效 id 返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/iterations/abc`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(400);
  });

  it("不存在的 id 返回 404", async () => {
    const res = await fetch(`${baseUrl}/api/agents/iterations/999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(404);
  });

  it("无效 status 值返回 400", async () => {
    const res = await fetch(`${baseUrl}/api/agents/iterations/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/agents/:name/history", () => {
  it("有效 agent 名返回历史记录", async () => {
    const res = await fetch(`${baseUrl}/api/agents/developer/history`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.history).toBeInstanceOf(Array);
  });

  it("limit 参数控制返回数量", async () => {
    const res = await fetch(`${baseUrl}/api/agents/developer/history?limit=5`);
    const json = await res.json();
    expect(json.history.length).toBeLessThanOrEqual(5);
  });

  it("limit 超出范围被 clamp 到 [1, 100]", async () => {
    const res = await fetch(`${baseUrl}/api/agents/developer/history?limit=200`);
    expect(res.status).toBe(200);
    // 内部 clamp 到 100
  });
});

describe("安全性测试", () => {
  it("超大 JSON body 不导致服务崩溃", async () => {
    const bigBody = JSON.stringify({ agents: Array(10000).fill("developer") });
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bigBody,
    });
    // 应返回 400（duplicate）或被 express.json limit 拦截
    expect(res.status).toBeLessThan(500);
  });

  it("Content-Type 非 JSON 时不崩溃", async () => {
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    expect(res.status).toBeLessThan(500);
  });

  it("CORS 预检请求返回 204", async () => {
    const res = await fetch(`${baseUrl}/api/agents`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
```

#### 10.1.4 数据库层集成测试

**文件**: `server/db/db.integration.test.ts`

```typescript
describe("DB 层集成测试", () => {
  // 每个 test 使用独立的内存 DB 实例

  describe("agent_runs 生命周期", () => {
    it("createRun -> finishRun(done) -> getLatestRun 返回完整记录", () => {});
    it("createRun -> finishRun(error) -> getLatestRun 返回 error 状态", () => {});
    it("多个 agent 的 getAllLatestRuns 每个 agent 只返回最新一条", () => {});
    it("getRunHistory 按时间倒序，limit 生效", () => {});
  });

  describe("findings CRUD", () => {
    it("insertFindings 批量写入 -> getFindings 返回正确数据", () => {});
    it("getFindings(agentName) 只返回对应 agent 最新 run 的 findings", () => {});
    it("findings 按 priority + severity 排序", () => {});
    it("空 findings 数组不报错", () => {});
  });

  describe("iterations CRUD", () => {
    it("insertIterations -> getPendingIterations 返回 pending 状态的", () => {});
    it("updateIterationStatus done -> getPendingIterations 不再返回", () => {});
    it("updateIterationStatus 不存在的 id 返回 false", () => {});
    it("iterations 按 impact + effort 排序", () => {});
  });

  describe("外键约束", () => {
    it("删除 agent_run 级联删除关联的 findings 和 iterations", () => {});
    it("插入 findings 引用不存在的 run_id 抛出外键错误", () => {});
  });

  describe("并发写入", () => {
    it("多个 agent 同时写入 findings 不冲突（WAL 模式）", async () => {
      // Promise.all 同时写入 3 个 agent 的数据
      // 验证所有数据完整写入
    });
  });
});
```

#### 10.1.5 LLM 调用层集成测试

**文件**: `server/utils/llm.integration.test.ts`

```typescript
describe("callLLM 集成测试", () => {
  // 使用 msw 拦截 OpenAI SDK 的 HTTP 请求

  it("正常调用返回 response content", async () => {});
  it("第一次失败、第二次成功 -- retry 机制生效", async () => {});
  it("连续 3 次失败 -- 抛出最后一个错误", async () => {});
  it("TimeoutError 不重试，立即抛出", async () => {});
  it("退避间隔：第1次重试 2s，第2次重试 4s", async () => {});
  it("response.choices 为空时返回空字符串", async () => {});
});

describe("extractJSON", () => {
  it("纯 JSON 字符串正确解析", () => {});
  it("带 json 围栏的 JSON 正确提取", () => {});
  it("带无语言标记的围栏正确提取", () => {});
  it("JSON 前后有 markdown 文本仍能提取", () => {});
  it("无效 JSON 抛出带预览的错误信息", () => {});
  it("嵌套 JSON 中的围栏不干扰提取", () => {});
  it("空字符串抛出解析错误", () => {});
});
```

### 10.2 多 Agent 协作场景测试

#### 10.2.1 Handoff 数据传递测试

```typescript
describe("Agent Handoff 协作测试", () => {
  it("team 模式下 handoff 数据正确构建和传递", async () => {
    // 1. 运行 product agent，获取结果
    // 2. 构建 TeamHandoff 对象
    // 3. 运行 developer agent，context.handoff 包含 product 的结果
    // 4. 验证 developer 的 buildUserMessage 中包含 "Upstream Handoff" 字段
  });

  it("handoff 为空时 prompt 中无 Upstream Handoff 区域", async () => {
    // context = { mode: "single" }
    // 验证 buildUserMessage 输出不包含 "Upstream Handoff"
  });

  it("多个 upstream handoff 按顺序排列", async () => {
    // handoff = [product结果, pm结果]
    // 验证 JSON.stringify 输出按数组顺序
  });
});
```

#### 10.2.2 迭代循环（Loop）集成测试

```typescript
describe("迭代循环状态机测试", () => {
  it("完整迭代流程：PM分析 -> 辩论 -> 需求 -> 开发 -> 测试 -> 评估", async () => {
    // mock 各阶段 LLM 返回
    // 验证 LoopIteration 各字段依次填充
    // 验证 finished_at 在完成后设置
  });

  it("PM 评估 score >= 9 且无 critical gaps -> is_stunning=true -> 循环终止", async () => {
    // 验证 stop_reason === "stunning"
  });

  it("达到 max_iterations 时循环终止", async () => {
    // 验证 stop_reason === "max_iterations"
  });

  it("某阶段 LLM 调用失败 -> iteration.error 记录 -> 循环终止", async () => {
    // 验证 stop_reason === "error"
    // 验证 error 字段包含具体信息
  });

  it("开发阶段：implementer 和 reviewer 角色交替", async () => {
    // iteration 1: dev1 实现，dev2 review
    // iteration 2: dev2 实现，dev1 review
  });

  it("SSE 事件正确触发：每个阶段完成时发送对应事件", async () => {
    // 监听 SSE 事件流
    // 验证事件类型和顺序：loop:start -> iteration:start -> pm:analysis -> ...
  });
});
```

### 10.3 前端集成测试方案

#### 10.3.1 流式聊天 E2E 集成测试

```typescript
// 使用 msw 拦截 OpenAI SDK 的流式请求

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const mockStreamResponse = (chunks: string[]) => {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const sseData = `data: ${JSON.stringify({
          choices: [{ delta: { content: chunk } }],
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(sseData));
      }
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
};

describe("流式聊天集成测试", () => {
  it("用户发送消息 -> store 更新 -> 流式响应逐步追加", async () => {
    // 1. 设置 msw 拦截，返回 3 个 chunk: ["Hello", " ", "World"]
    // 2. 调用 chat 发送逻辑
    // 3. 验证 store 中 messages 变化：
    //    - user message 立即出现
    //    - assistant message 从 "" -> "Hello" -> "Hello " -> "Hello World"
    // 4. 验证 isLoading 从 true -> false
  });

  it("流式响应中途中断 -> 已收到内容保留，错误提示", async () => {
    // msw 返回部分数据后断开连接
    // 验证: 已收到的内容保留在 store 中
  });

  it("用户点击停止 -> AbortController 取消请求", async () => {
    // 验证: 请求被 abort
    // 验证: 已收到内容保留
    // 验证: isLoading 变回 false
  });

  it("快速切换聊天 -> 旧请求取消，不污染新聊天", async () => {
    // 1. 在 chat-1 发送消息，流式响应进行中
    // 2. 切换到 chat-2
    // 3. 验证: chat-1 的流式数据不会追加到 chat-2
  });

  it("RoleModule JSON 解析 -> memory 正确更新", async () => {
    // msw 返回包含 role JSON 的响应
    // 验证 RoleModule.memory 被更新
    // 验证 localStorage 中有对应数据
  });
});
```

#### 10.3.2 Store 与 Service 联动测试

```typescript
describe("Store + Service 联动", () => {
  it("updateModelList -- 成功获取模型列表后更新 store", async () => {
    // msw mock /models 端点
    // 调用 updateModelList
    // 验证 store.modelList 更新
  });

  it("updateModelList -- 当前模型不在新列表中时自动切换", async () => {
    // 返回不包含当前模型的列表
    // 验证 currentModel 被更新为列表第一个
  });

  it("updateModelList -- 请求超时 10s 后中止", async () => {
    // msw delay 15s
    // 验证 AbortError 被捕获
    // 验证 modelList 不变
  });

  it("updateModelList -- 竞态：快速连续调用只生效最后一次", async () => {
    // requestId 机制验证
    // 连续调用 3 次，只有第 3 次的结果生效
  });
});
```

### 10.4 接口契约测试

```typescript
describe("API 响应格式契约", () => {
  // 验证所有 API 端点返回值符合约定的 JSON schema

  it("GET /api/agents -- { agents: [{ name, description }] }", () => {});
  it("GET /api/agents/status -- { orchestrator: OrchestratorStatus, runs: AgentRunRow[] }", () => {});
  it("POST /api/agents/run -- { ok: true, results: AgentResult[] }", () => {});
  it("POST /api/agents/:name/run -- { ok: true, result: AgentResult }", () => {});
  it("GET /api/agents/:name/result -- { ok, result|run }", () => {});
  it("GET /api/agents/findings/all -- { ok, findings: FindingQueryRow[] }", () => {});
  it("GET /api/agents/:name/findings -- { ok, agent, findings }", () => {});
  it("GET /api/agents/:name/iterations -- { ok, agent, iterations }", () => {});
  it("GET /api/agents/:name/history -- { ok, agent, history }", () => {});
  it("PATCH /api/agents/iterations/:id -- { ok: true }", () => {});

  // 错误响应格式
  it("所有错误响应 -- { ok: false, error: string }", () => {});
  it("GET /health -- { ok: true, time: ISO8601 }", () => {});
});
```

### 10.5 测试执行建议

| 测试文件 | 类型 | 依赖 | 预期耗时 | CI 阶段 |
|----------|------|------|---------|---------|
| `base.integration.test.ts` | 集成 | vi.mock LLM，真实 DB | < 5s | PR |
| `orchestrator.integration.test.ts` | 集成 | vi.mock agents，真实调度 | < 10s | PR |
| `agents.integration.test.ts` | 集成 | 真实 Express app，mock LLM | < 15s | PR |
| `db.integration.test.ts` | 集成 | `:memory:` SQLite | < 3s | PR |
| `llm.integration.test.ts` | 集成 | msw mock HTTP | < 5s | PR |
| `streaming.integration.test.ts` | 前端集成 | msw mock Stream | < 10s | PR |
| `store-service.integration.test.ts` | 前端集成 | msw mock HTTP | < 5s | PR |
| `api-contract.test.ts` | 契约 | 真实 Express app | < 10s | PR |

**总计新增集成测试预估：约 63s，满足策略中 < 2min 的 CI 门禁要求。**

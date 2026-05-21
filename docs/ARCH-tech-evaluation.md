# 虚拟办公室 - 技术可行性评估

> 评估日期：2026-04-02
> 评估人：架构主管 (architect-lead)
> 基于需求文档与 supercell 现有代码库分析

---

## 1. 游戏引擎选型

需求核心：Q版像素风 2D 场景，骨骼动画角色，可交互办公室地图，桌面端应用。

### 1.1 React + PixiJS（推荐）

| 维度 | 评分 | 说明 |
|------|------|------|
| 性能 | A | WebGL 渲染，2D 场景下帧率稳定 60fps，支持数百个精灵同屏 |
| 生态 | A | npm 周下载量 ~120k，@pixi/react 官方 React 绑定成熟，pixi-spine 插件直接支持骨骼动画 |
| 学习成本 | B+ | API 精简，文档完善，团队有 React 基础可快速上手 |
| React 集成 | A | @pixi/react 提供声明式组件 `<Stage>` `<Sprite>` `<AnimatedSprite>`，与 React 状态管理无缝对接 |
| 包体积 | B+ | 核心 ~150KB gzip，按需加载插件 |
| 骨骼动画 | A | pixi-spine 原生支持 Spine 运行时，DragonBones 也有社区插件 pixi-dragonbones |

**结论：最佳选择。** 轻量、React 集成度最高、骨骼动画方案最完备。

### 1.2 React + Phaser

| 维度 | 评分 | 说明 |
|------|------|------|
| 性能 | A | 基于 WebGL/Canvas，成熟游戏引擎，物理引擎内置 |
| 生态 | A+ | 最大的 HTML5 游戏社区，教程和插件极丰富 |
| 学习成本 | B | 概念较重（Scene/Game/Physics），对纯前端团队有一定门槛 |
| React 集成 | C | Phaser 自有生命周期与 React 冲突严重，需 useRef 手动桥接，状态同步复杂 |
| 包体积 | C | 全量 ~500KB gzip，即使不用物理引擎也无法 tree-shake |
| 骨骼动画 | B+ | 内置 Spine 插件（需许可证），DragonBones 需社区插件且维护不活跃 |

**结论：功能过重。** 我们不需要物理引擎和复杂场景管理，且 React 集成是硬伤。

### 1.3 React + Cocos Creator

| 维度 | 评分 | 说明 |
|------|------|------|
| 性能 | A+ | 工业级引擎，原生渲染性能最强 |
| 生态 | B | 国内生态好，国际社区较小，TS 支持良好 |
| 学习成本 | C | 需学习 Cocos 编辑器、组件系统、资源管线，团队切换成本高 |
| React 集成 | D | **无法集成**。Cocos 有自己的 UI 系统和渲染管线，与 React 是完全独立的技术栈 |
| 包体积 | C | 引擎运行时 >1MB |
| 骨骼动画 | A | 原生支持 DragonBones 和 Spine |

**结论：不推荐。** 与 React 无法共存，意味着放弃现有前端代码和 React 生态，开发效率大幅下降。

### 选型结论

**React + PixiJS (@pixi/react v8)**，理由：
1. 与现有 React 19 + Zustand 技术栈无缝集成
2. 2D 像素风场景性能绰绰有余
3. pixi-spine 直接支持骨骼动画
4. 最小的架构侵入，渐进式接入

---

## 2. 骨骼动画方案

### 2.1 方案对比

| 方案 | 授权费用 | 格式 | PixiJS 支持 | 编辑器 | 适用场景 |
|------|----------|------|-------------|--------|----------|
| **Spine** | $70/年（Essential）起 | .skel/.json + .atlas | pixi-spine 官方维护，稳定 | 专业，功能强 | 商业项目首选 |
| **DragonBones** | **免费开源** | .json + .png | pixi-dragonbones 社区维护 | 免费编辑器（已停更但可用） | 预算敏感项目 |
| **Pixi-Spine** | 运行时免费，需 Spine 编辑器许可 | Spine 格式 | 原生 | - | 已有 Spine 资产时 |
| **Lottie (lottie-pixi)** | 免费 | .json (AE导出) | 社区插件 | After Effects | 简单动画/UI 动效 |

### 2.2 推荐方案：DragonBones（主） + Lottie（辅）

**理由：**
- DragonBones 编辑器虽已停止更新（2020），但功能完备，导出格式稳定
- 社区有大量免费 Q 版像素风骨骼动画素材（itch.io、OpenGameArt）
- 员工状态动画（工作中、思考中、聊天中、休息中）复杂度不高，DragonBones 足够
- Lottie 补充 UI 层动效（状态气泡、通知动画等）
- **零授权费用**

**若预算允许**，建议升级到 Spine Essential（$70/年），理由：
- 编辑器持续更新，社区活跃
- pixi-spine 由 Pixi 核心团队维护，兼容性有保障
- 网格变形等高级特性可做更丰富的表情动画

---

## 3. 桌面端方案

### 3.1 Electron vs Tauri

| 维度 | Electron | Tauri |
|------|----------|-------|
| **包体积** | ~150MB（捆绑 Chromium） | ~5-10MB（使用系统 WebView） |
| **内存占用** | 高（200-500MB 基线） | 低（50-100MB） |
| **启动速度** | 慢（2-4秒） | 快（<1秒） |
| **原生 API** | Node.js 全量能力，fs/child_process/net 直接可用 | Rust 后端，通过 IPC 调用，需写 Rust 插件 |
| **生态/插件** | 极丰富（electron-store, electron-updater 等） | 快速增长但仍较少，V2 已大幅改善 |
| **Git/Shell 集成** | 直接 `child_process.exec`，simple-git 库可复用 | 需 Tauri Shell 插件或 Rust sidecar |
| **自动更新** | electron-updater 成熟方案 | Tauri Updater 内置，轻量 |
| **跨平台** | Win/Mac/Linux | Win/Mac/Linux + iOS/Android（V2） |
| **安全性** | 较弱（Node 全能力暴露） | 较强（最小权限模型，Rust 侧隔离） |
| **学习成本** | 低（纯 JS/TS） | 中（需基础 Rust，但前端层无感） |

### 3.2 推荐：Electron（短期） → Tauri（中期迁移目标）

**理由：**

**选 Electron 启动的核心原因：**
1. 需求中"程序员模块"要求完整 git 操作和代码操作，Electron 的 Node.js 环境让 `simple-git`（现有依赖）直接可用
2. 现有 server 端代码（Express + SQLite + OpenAI SDK）可直接作为 Electron 主进程运行，零迁移成本
3. 团队纯 TS 技术栈，无需引入 Rust
4. Agent 需要调用系统命令（git、文件读写、终端），Electron 的 child_process 最直接

**Tauri 作为中期目标的原因：**
1. 当 Agent 数量增多（需求提到每角色3个实例），内存压力大，Tauri 的低内存优势明显
2. Tauri V2 的插件生态在快速完善
3. Rust sidecar 模式可以把 Agent 的 CPU 密集任务卸载到原生层

**迁移路径：**
- Phase 1：Electron 快速落地，验证核心功能
- Phase 2：将 server 端抽象为独立进程（不依赖 Electron 特有 API）
- Phase 3：切换到 Tauri，server 进程作为 sidecar 运行

---

## 4. Agent 架构

### 4.1 每角色 3 实例设计

需求要求每个角色同时维护 3 个 Agent 实例：**干活（Worker）、记忆（Memory）、聊天（Chat）**。

```
┌─────────────────────────────────────────────┐
│                   Role                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  Worker    │ │  Memory   │ │   Chat    │ │
│  │  Agent     │ │  Agent    │ │   Agent   │ │
│  │           │ │           │ │           │ │
│  │ - tools   │ │ - 总结     │ │ - 与用户  │ │
│  │ - 执行任务 │ │ - 索引     │ │   对话    │ │
│  │ - 产出代码 │ │ - 检索     │ │ - 汇报    │ │
│  │ - 调用API │ │ - 遗忘策略 │ │ - 闲聊    │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
│        └──────┬──────┘──────┬──────┘        │
│               │  共享状态总线  │               │
│               └──────────────┘               │
└─────────────────────────────────────────────┘
```

**实现方案：**

#### A. Agent 实例管理

```typescript
interface AgentInstance {
  id: string;
  roleId: string;
  type: 'worker' | 'memory' | 'chat';
  status: 'idle' | 'running' | 'waiting';
  conversationHistory: Message[];
  systemPrompt: string;
  tools: ToolDefinition[];
}

class RoleManager {
  private instances: Map<string, AgentInstance> = new Map();

  // 每个角色创建时自动生成 3 个实例
  createRole(config: RoleConfig): void {
    for (const type of ['worker', 'memory', 'chat'] as const) {
      this.instances.set(`${config.id}-${type}`, {
        id: `${config.id}-${type}`,
        roleId: config.id,
        type,
        status: 'idle',
        conversationHistory: [],
        systemPrompt: this.buildPrompt(config, type),
        tools: this.getToolsForType(config, type),
      });
    }
  }
}
```

#### B. 实例间通信

使用 EventEmitter 模式 + 共享状态总线：

```typescript
class RoleStateBus {
  // Worker 完成任务 → 通知 Memory 存档
  // Chat 收到用户指令 → 转发给 Worker
  // Memory 提取相关记忆 → 注入 Worker/Chat 的 context

  private bus = new EventEmitter();

  emit(roleId: string, event: RoleEvent): void;
  on(roleId: string, handler: (event: RoleEvent) => void): void;
}
```

#### C. 并发控制

- 3 个实例可并行运行（各自独立的 LLM 调用）
- 使用 Semaphore 控制全局并发 LLM 请求数（避免过载）
- Memory Agent 采用异步后台模式，不阻塞 Worker 和 Chat

### 4.2 提示词管理

```
prompts/
├── base/
│   ├── identity.md          # 角色身份模板
│   ├── environment.md       # 环境感知模板
│   └── collaboration.md     # 协作规则模板
├── roles/
│   ├── developer.md
│   ├── designer.md
│   ├── pm.md
│   └── leader.md
├── instances/
│   ├── worker.md            # Worker 实例专属指令
│   ├── memory.md            # Memory 实例专属指令
│   └── chat.md              # Chat 实例专属指令
└── modules/
    ├── git.md               # Git 操作 tools 说明
    ├── office.md            # 办公软件 tools 说明
    └── management.md        # 管理操作 tools 说明
```

**提示词组装流程（参考 Claude 架构）：**

```
最终 System Prompt =
  base/identity（角色身份）
  + base/environment（当前环境状态）
  + roles/{role}（角色专属知识）
  + instances/{type}（实例职责）
  + modules/{active_modules}（当前激活的 tools 说明）
  + memory_context（Memory Agent 提供的相关记忆片段）
```

### 4.3 Tools 动态注入

**核心问题：** 需求提到参考 Claude 处理 tools 导致提示词爆炸问题。

**方案：分层 + 按需加载**

```typescript
interface ToolRegistry {
  // 所有可用 tools
  allTools: Map<string, ToolDefinition>;

  // 角色模板定义的默认 tools
  roleDefaults: Map<string, string[]>;

  // 根据当前任务上下文，动态选择需要注入的 tools
  resolveTools(roleId: string, taskContext: TaskContext): ToolDefinition[] {
    const base = this.roleDefaults.get(roleId) ?? [];
    const contextual = this.inferToolsFromTask(taskContext);
    // 合并去重，控制总数不超过 20 个
    return dedup([...base, ...contextual]).slice(0, 20);
  }
}
```

**控制提示词膨胀的策略：**
1. **Tools 分层**：核心 tools（始终注入） + 扩展 tools（按需注入）
2. **工具描述压缩**：精简 tool description，只保留必要的参数说明
3. **Two-stage 模式**：先让 Agent 声明需要哪些工具，再注入对应工具重新调用
4. **工具组合包**：预定义"编程包"、"设计包"、"管理包"，一键启用一组相关工具

---

## 5. 性能策略

### 5.1 大量 Agent 同时活跃时的优化

假设场景：10 个角色 x 3 实例 = 30 个 Agent 实例可能同时活跃。

#### A. LLM 请求并发控制

```typescript
class LLMPool {
  private semaphore: Semaphore;
  private queue: PriorityQueue<LLMRequest>;

  constructor(maxConcurrent: number = 5) {
    this.semaphore = new Semaphore(maxConcurrent);
  }

  // 优先级：Worker > Chat > Memory
  async request(req: LLMRequest): Promise<LLMResponse> {
    await this.semaphore.acquire(req.priority);
    try {
      return await this.callLLM(req);
    } finally {
      this.semaphore.release();
    }
  }
}
```

#### B. 前端渲染优化

| 策略 | 说明 |
|------|------|
| **PixiJS 场景分层** | 静态背景层（不重绘） + 角色动画层（60fps） + UI 覆盖层（React DOM） |
| **视口裁剪** | 只渲染可见区域内的角色，离屏角色暂停动画 |
| **动画帧率控制** | 非焦点角色降到 15fps，焦点角色保持 30-60fps |
| **React 渲染隔离** | PixiJS Canvas 与 React DOM 分离，游戏渲染不触发 React reconciliation |
| **状态订阅精细化** | 每个 UI 组件只订阅自己关心的 Agent 状态切片，利用现有 `useSelector` + `useShallow` |

#### C. 内存管理

| 策略 | 说明 |
|------|------|
| **对话历史滑动窗口** | 每个 Agent 实例保留最近 N 条消息，旧消息由 Memory Agent 总结后归档 |
| **Agent 休眠** | 空闲超过阈值的 Agent 释放对话历史，保留 summary + prompt |
| **纹理图集** | 像素风角色使用 SpriteSheet，一张图集包含所有状态帧，减少 GPU 纹理切换 |
| **SQLite 异步化** | 使用 better-sqlite3 的 Worker 线程模式，避免阻塞主进程事件循环 |

#### D. 后端架构

```
Electron 主进程
├── Agent Orchestrator（调度 30+ Agent 实例）
├── LLM Pool（并发控制 + 请求队列）
├── Memory Store（SQLite + 向量检索）
└── Tool Executor（沙箱执行 git/shell 命令）

Renderer 进程
├── React UI Layer（Zustand 状态管理）
├── PixiJS Game Layer（办公室场景渲染）
└── IPC Bridge（与主进程通信）
```

---

## 6. 现有代码评估

### 6.1 可复用部分

| 模块 | 文件 | 复用程度 | 说明 |
|------|------|----------|------|
| **createStore 封装** | `src/createStore/index.ts` | **高** | Zustand + Immer + persist + useSelector/useSelectorWatch 封装质量高，可直接用于 Agent 状态管理 |
| **OpenAI SDK 集成** | `src/service/index.ts` | **高** | 基于 OpenAI SDK 的客户端封装，可复用于前端直连 LLM 场景 |
| **LLM 调用工具** | `server/utils/llm.ts` | **高** | callLLM + extractJSON + 重试机制，可直接用于 Agent 后端调用 |
| **数据库层** | `server/db/index.ts` | **中** | better-sqlite3 封装和 schema 设计可参考，但需大幅扩展（Agent 状态、记忆存储） |
| **Agent 基类** | `server/agents/base.ts` | **中** | BaseAgent 抽象（run/buildSystemPrompt/buildUserMessage）架构合理，但需要扩展支持 3 实例模型和 tools 注入 |
| **编排器** | `server/agents/orchestrator.ts` | **中** | 并发运行 + cron 调度可参考，但需重构为支持角色-实例的二级管理 |
| **流式对话** | `src/App.tsx` (L80-104) | **中** | SSE streaming 逻辑可抽取为独立 hook |
| **代码读取器** | `server/utils/codeReader.ts` | **高** | 文件读取/列表工具可直接用于"程序员模块" |
| **路由层** | `server/routes/agents.ts` | **低** | 当前 REST API 设计面向简单审查，虚拟办公室需要 WebSocket 实时通信 |

### 6.2 需要重构的部分

| 模块 | 问题 | 重构方向 |
|------|------|----------|
| **前端 LLM 直连** | `dangerouslyAllowBrowser: true` 暴露 API Key | 所有 LLM 调用走 Electron 主进程 IPC，前端不直接调用 |
| **单一聊天 App** | App.tsx 是一个聊天界面 | 需要拆分为：游戏场景 + 工作空间 + 聊天面板 三大视图 |
| **角色系统** | roleModule 是简单的 prompt 模板 | 需要扩展为完整的角色定义系统（身份/技能/工具/记忆） |
| **状态管理** | store 只管聊天状态 | 需要新增：AgentStore、WorkspaceStore、GameStore |
| **记忆系统** | localStorage 字符串存储 | 需要 SQLite + 向量检索（语义搜索相关记忆） |
| **通信架构** | HTTP REST + SSE | Electron 场景下改为 IPC + EventEmitter，跨 Agent 通信 |

### 6.3 需要新增的部分

| 模块 | 说明 |
|------|------|
| PixiJS 游戏层 | 办公室场景、角色渲染、交互系统 |
| 角色定义系统 | 名称/简介/职位/技能树/工具配置/模板 |
| 工作空间系统 | 每个 Agent 的独立笔记/代码仓库/记忆空间 |
| Tools 注册中心 | 动态 tool 管理、注入、权限控制 |
| 记忆引擎 | 向量存储 + 总结 + 遗忘策略 |
| 搜索系统 | 跨工作空间全文搜索 |
| Electron 壳 | 主进程/渲染进程分离、IPC 通信层 |

---

## 7. 技术风险清单

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|------|------|----------|
| R1 | **LLM 延迟累积** — 30 个 Agent 实例并发请求，本地 LLM 响应变慢 | **高** | 用户体验卡顿，Agent "活跃感"丧失 | 请求队列 + 优先级调度 + 并发上限；Memory Agent 异步处理；考虑远程 API 混用 |
| R2 | **提示词膨胀** — 角色身份 + 环境 + 记忆 + tools 导致 token 超限 | **高** | Agent 行为质量下降或请求失败 | 分层提示词 + 动态裁剪 + 记忆摘要压缩；控制单次 prompt < 4K tokens |
| R3 | **本地 LLM 能力瓶颈** — 7B 模型 tool calling 和复杂推理能力有限 | **高** | Agent 无法正确使用 tools，任务执行失败率高 | 简化 tool schema；增加 few-shot 示例；支持混用云端大模型（关键任务用 Claude/GPT-4） |
| R4 | **Electron 内存压力** — 多 Agent + PixiJS + SQLite 内存占用过大 | **中** | 低配机器体验差 | Agent 休眠机制 + 对话历史滑动窗口 + 纹理图集优化 |
| R5 | **DragonBones 停更风险** — 编辑器已无维护 | **低** | 未来可能出现兼容性问题 | 素材制作完成后锁定版本；预留 Spine 迁移路径 |
| R6 | **Agent 行为不可控** — LLM 输出不稳定导致 tool 调用出错 | **中** | 产生脏数据、误操作 | Tool 执行沙箱 + 操作审计日志 + 危险操作需用户确认 |
| R7 | **状态同步复杂度** — 3 实例间状态同步 + 前后端状态同步 | **中** | 数据不一致、UI 显示错乱 | 单一状态源（SQLite）+ EventEmitter 通知 + 乐观更新 |
| R8 | **开发周期长** — 游戏引擎 + Agent 架构 + 桌面端，技术跨度大 | **中** | 延期交付 | 分 Phase 增量交付；Phase 1 不含游戏层，先做命令行/简单 UI 版本 |

---

## 附录 A：推荐技术栈汇总

| 层次 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.x（现有） |
| 状态管理 | Zustand + Immer | 5.x（现有） |
| 游戏引擎 | PixiJS + @pixi/react | 8.x |
| 骨骼动画 | DragonBones（免费）/ Spine（付费） | - |
| 样式 | Tailwind CSS | 4.x（现有） |
| 桌面端 | Electron | 33.x |
| 后端运行时 | Node.js (Electron 主进程) | 22.x |
| 数据库 | better-sqlite3 | 11.x（现有） |
| 向量检索 | sqlite-vss | 0.1.x（现有依赖） |
| LLM SDK | OpenAI SDK | 6.x（现有） |
| 构建工具 | Vite | 7.x（现有） |
| 语言 | TypeScript strict | 5.9（现有） |

## 附录 B：建议分阶段路线

- **Phase 1（MVP）**：Electron 壳 + 现有聊天改造为多 Agent 面板 + 单实例 Agent（无游戏层）
- **Phase 2（核心）**：PixiJS 办公室场景 + 角色骨骼动画 + 3 实例 Agent 架构 + 工作空间
- **Phase 3（完善）**：Tools 动态注入 + 记忆引擎 + 搜索系统 + 角色模板市场
- **Phase 4（优化）**：性能调优 + Tauri 迁移评估 + 移动端适配

---

## 交叉审核意见

> 审核人：架构审核 (architect-review)
> 审核日期：2026-04-02
> 基于原始需求文档 + supercell 现有代码库独立分析

---

### 一、游戏引擎选型审核

**结论：同意 React + PixiJS 选型，补充以下遗漏考量。**

| # | 遗漏点 | 风险等级 | 说明 |
|---|--------|----------|------|
| G1 | **@pixi/react v8 成熟度** | 中 | @pixi/react v8 是较新的绑定层（PixiJS v8 于 2024 年发布大版本重写），React 19 + @pixi/react v8 的组合在生产环境中的验证案例有限。建议：锁定 @pixi/react 具体版本号，项目初期写一个渲染压力测试 Demo（100+ 角色 + 骨骼动画同屏），尽早暴露兼容性问题。 |
| G2 | **Electron 多 WebGL 上下文** | 中 | Electron 渲染进程中如果同时存在 PixiJS Canvas（WebGL）和其他 WebGL 内容（如代码编辑器的 minimap），可能导致 GPU 内存压力和上下文切换开销。建议：确保全应用只有一个 WebGL Canvas（PixiJS 独占），UI 层严格走 React DOM。 |
| G3 | **pixi-dragonbones 社区插件风险** | 中 | 文档推荐 DragonBones + pixi-dragonbones，但这个社区插件的维护活跃度需要与 DragonBones 编辑器停更风险叠加评估。如果 pixi-dragonbones 也不活跃，意味着 PixiJS v8 升级时可能无人适配。**建议在 Phase 1 就验证 pixi-dragonbones 在 PixiJS v8 下是否正常工作**，如果不行则直接走 Spine。 |
| G4 | **PixiJS 游戏层可测试性** | 低 | PixiJS 渲染层的自动化测试比 DOM 困难得多（无法用 Testing Library）。文档未提及游戏层的测试策略。建议：游戏逻辑（角色状态机、交互判定）与渲染层分离，逻辑层可独立单元测试。 |

**未提及但无需纳入的方案：** Three.js / react-three-fiber（3D 引擎，对 2D 像素风场景过重）、Konva（无骨骼动画支持）。评估覆盖面充分。

---

### 二、3 实例 Agent 架构审核

**结论：架构方向合理，但通信开销和资源消耗被显著低估。这是本次审核发现的最大风险。**

#### 2.1 LLM 调用量爆炸（新增高风险）

文档预估 30 个 Agent 实例并发，但未量化实际 LLM 调用频率：

- **Worker Agent**：每次任务执行 1-N 轮 LLM 调用（tool use 可能多轮）
- **Memory Agent**：Worker 每完成一个任务就需要 1 次总结调用 + 可能的索引更新调用
- **Chat Agent**：用户每条消息 1 次调用

**最坏情况估算：** 10 角色同时活跃，每角色 Worker 平均 3 轮/任务，Memory 1 轮/任务总结，Chat 按用户交互频率 → **单个任务周期内可能产生 40-50 次 LLM 调用**。

本地 7B 模型（如 qwen2.5-7b）在消费级硬件上的吞吐量约 **20-40 tokens/s**，单次请求（2K input + 1K output）耗时约 25-50 秒。Semaphore 限制 5 并发意味着 30 个排队请求的尾部延迟可达 **5-10 分钟**。

**建议：**
1. **Memory Agent 不应该是 LLM Agent** — 记忆的存储/检索/总结可以用确定性算法（embedding 向量 + 截断规则 + 固定模板总结），只有"遗忘决策"才需要 LLM。这样直接砍掉 1/3 的 LLM 调用量。
2. 增加 LLM 请求超时 + 降级策略：超过 N 秒未响应的低优先级请求直接丢弃或返回缓存结果。
3. Phase 1 先做单实例 Agent（只有 Worker），验证核心功能后再引入 Memory/Chat 实例。

#### 2.2 EventEmitter 状态总线的局限性

EventEmitter 适合进程内通信，但存在以下问题：

| 问题 | 说明 |
|------|------|
| **无持久化** | 进程崩溃或重启后，所有未处理的事件丢失。Agent 任务中断后无法恢复。 |
| **无背压** | 如果 Memory Agent 处理慢（等待 LLM），Worker 持续发事件会导致内存中事件堆积。 |
| **调试困难** | EventEmitter 的事件流难以追踪和回放。30 个 Agent 的事件交织后，问题排查极其困难。 |

**建议：** 用 SQLite 作为事件日志（已有 better-sqlite3），EventEmitter 仅作为通知层。事件先写入 DB，再通知消费者。这样天然具备持久化、可回放、可审计。

#### 2.3 实例间上下文共享的 Token 成本

文档提到 "Memory Agent 提供相关记忆片段注入 Worker/Chat 的 context"，但未估算这部分 token 开销。如果每次 Worker 调用都需要注入 500-1K tokens 的记忆上下文，加上角色身份 + 环境 + tools 描述，单次 prompt 很容易突破 4K tokens 的目标上限。

**建议：** 明确定义各层 prompt 的 token 预算分配：
- 角色身份 + 实例职责：≤ 500 tokens
- 环境状态：≤ 200 tokens
- Tools 描述：≤ 1000 tokens（20 个 tools × 50 tokens/tool）
- 记忆上下文：≤ 500 tokens
- 任务指令 + 用户输入：≤ 1000 tokens
- **总计：≤ 3200 tokens**，留 800 tokens buffer

---

### 三、性能策略审核

**结论：覆盖了主要方向，但有几个具体技术点存在事实性错误或遗漏。**

#### 3.1 better-sqlite3 Worker 线程模式（事实纠正）

文档提到 "使用 better-sqlite3 的 Worker 线程模式，避免阻塞主进程事件循环"。

**纠正：** better-sqlite3 是**同步 API 设计**，不提供原生的 Worker 线程模式。要实现异步化需要：
- 方案 A：手动将 better-sqlite3 放入 Node.js Worker Thread，通过 MessagePort 通信（需自行封装）
- 方案 B：使用 `better-sqlite3-multiple-ciphers` 或其他异步 SQLite 绑定（如 `sql.js`）
- 方案 C：在 Electron 中用单独的隐藏渲染进程或 utility process 跑 SQLite

**建议：** Phase 1 直接用同步 better-sqlite3（在 Electron 主进程中，单次查询通常 < 1ms，不会明显阻塞）。等到真正出现性能瓶颈时再考虑 Worker Thread 方案。过早优化。

#### 3.2 sqlite-vss 向量检索的平台风险（新增风险）

文档将 sqlite-vss 列为向量检索方案（附录 A），且现有 package.json 已有依赖。但需注意：

- sqlite-vss 是 **实验性项目**（作者自述 "not production ready"）
- 在 **macOS ARM (Apple Silicon)** 上存在已知的编译和加载问题
- 与 better-sqlite3 的版本兼容性需要额外验证
- Electron 打包时 native addon 的跨平台分发是额外的复杂度

**建议：** 评估替代方案：
1. **自行实现简单的余弦相似度搜索**（记忆条目数量有限时，暴力搜索够用）
2. **使用 LLM 自身做语义检索**（将候选记忆列表发给 LLM，让它选择相关的）
3. 如果确实需要向量数据库，考虑 **sqlite-vec**（sqlite-vss 作者的新项目，更稳定）

#### 3.3 遗漏的性能瓶颈

| # | 瓶颈 | 说明 |
|---|------|------|
| P1 | **SQLite WAL 模式下的并发写入** | 30 个 Agent 同时写入 SQLite（状态更新、记忆存档），WAL 模式下写入仍是串行的（一个 writer 多个 reader）。高频写入场景下可能成为瓶颈。建议：批量写入 + 写入合并。 |
| P2 | **Electron IPC 序列化开销** | 主进程 ↔ 渲染进程的 IPC 通信需要 JSON 序列化/反序列化。如果 Agent 状态更新频繁（30 个 Agent × 每秒 N 次状态变更），IPC 吞吐量可能成为瓶颈。建议：状态更新节流（throttle），只推送变更的 delta。 |
| P3 | **PixiJS + React 协调开销** | @pixi/react 的声明式渲染会在 React reconciliation 中处理 PixiJS 对象更新。大量角色频繁状态变化时，React 的 diff 开销不可忽略。建议：关键动画路径（如角色移动）直接用 PixiJS 命令式 API，只有 UI 交互层用声明式。 |

---

### 四、其他补充风险

| # | 风险 | 等级 | 说明 | 建议 |
|---|------|------|------|------|
| R9 | **Electron → Tauri 迁移成本被低估** | 中 | 文档描述的 3 步迁移路径看似平滑，但 "将 server 端抽象为独立进程" 实质上是一次大规模重构。现有代码大量使用 Node.js 原生 API（fs、child_process、better-sqlite3 native addon），迁移到 Tauri sidecar 意味着这些都需要重写或通过 Rust FFI 桥接。建议：将 Tauri 定位为 "可选的长期优化" 而非 "中期目标"，避免架构设计过度面向迁移。 |
| R10 | **离线/在线模式切换** | 中 | 需求暗示支持本地 LLM，但风险 R3 建议混用云端大模型。文档未说明：当云端 API 不可用时如何降级？Agent 任务是否能在纯离线模式下完整运行？建议：明确定义离线模式的功能边界（哪些 Agent 能力仅在线可用）。 |
| R11 | **开发体验（DX）** | 低 | PixiJS + Electron + React 三层叠加后，热重载（HMR）体验可能退化。Vite 的 HMR 在 Electron 渲染进程中可以工作，但 PixiJS 场景状态无法保持（HMR 后需要重新初始化）。建议：Phase 1 确认开发工作流的可行性。 |

---

### 五、总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 选型合理性 | **A-** | PixiJS + DragonBones + Electron 的选型组合是当前约束条件下的最优解，无过度设计 |
| 风险识别 | **B+** | 覆盖了主要风险，但 LLM 调用量爆炸（本审核 2.1 节）和 better-sqlite3 异步化（3.1 节）存在遗漏/偏差 |
| 现有代码评估 | **A** | 对每个模块的复用程度判断准确，重构方向清晰 |
| 实施路线 | **B+** | 分阶段合理，但 Phase 2 跨度太大（PixiJS + 3 实例 Agent + 工作空间同时推进），建议拆分为 Phase 2a（PixiJS 场景）和 Phase 2b（3 实例 Agent） |
| 量化分析 | **B-** | 缺乏具体的性能数字（LLM 吞吐量估算、内存占用预估、SQLite 写入频率），建议补充 benchmark 数据 |

**最关键的一条建议：** 在 Phase 1 用单实例 Agent + 简单内存（非 LLM 驱动）验证核心交互循环。3 实例架构是这个项目最大的复杂度来源，应该在核心功能验证后再引入，而非一开始就设计到位。

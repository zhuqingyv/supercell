# PRD-tech: 技术选型与难点分析

## 1. 技术栈总览

### 确定的技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 运行时 | Bun | 替代 Node.js，更快的启动和执行 |
| 语言 | TypeScript (strict) | 全栈统一 |
| 前端框架 | React 19 | 已有基础，继续使用 |
| 构建工具 | Vite 7 | 已有配置 |
| 样式 | Tailwind CSS v4 | 已有配置 |
| 状态管理 | Zustand 5 + Immer | 已有封装 (createLocalStore) |
| 后端 | Express 5 | 已有基础 |
| 数据库 | SQLite (better-sqlite3) | 已有基础，需扩展 schema |
| LLM 接入 | OpenAI SDK | 已有封装，兼容本地 LLM |
| Git 操作 | simple-git | 已有依赖 |
| 桌面端 | 待定（Electron / Tauri） | 需要调研 |

### 待选型的技术

| 需求 | 候选方案 | 需调研 |
|------|----------|--------|
| 游戏引擎/渲染层 | PixiJS / Phaser / Cocos Creator | 是 |
| 骨骼动画 | DragonBones / Spine Runtime | 是 |
| 桌面封装 | Electron / Tauri | 是 |
| 向量检索 | sqlite-vss (已引入) / 自建 | 部分 |

## 2. 游戏引擎选型分析

### 2.1 候选方案对比

| 维度 | PixiJS | Phaser | Cocos Creator |
|------|--------|--------|---------------|
| 定位 | 2D 渲染库 | 2D 游戏框架 | 完整游戏引擎 |
| 包大小 | ~150KB (gzip) | ~500KB (gzip) | 1-2MB+ |
| React 集成 | 优秀 (react-pixi) | 需要封装 | 困难 |
| 像素风支持 | 原生支持 | 原生支持 | 支持 |
| 骨骼动画 | 插件支持 | 内置 | 内置 |
| 等距视角 | 需手动实现 | 插件支持 | 内置 tilemap |
| 学习成本 | 低 | 中 | 高 |
| 性能 | 高 (WebGL) | 高 (WebGL) | 高 (WebGL) |
| 生态 | 活跃 | 活跃 | 中等 |
| 许可证 | MIT | MIT | 部分开源 |

### 2.2 推荐方案：PixiJS

**推荐理由**：
1. **React 集成最佳**: 有成熟的 `@pixi/react` 库，可以在 React 组件树中直接使用 PixiJS
2. **轻量灵活**: 我们不需要完整游戏引擎，只需要 2D 渲染 + 动画
3. **项目定位**: Supercell 是"带游戏化元素的办公工具"，不是"游戏"，不需要物理引擎、碰撞检测等
4. **渐进集成**: 可以逐步引入，不需要重写整个前端架构
5. **社区资源丰富**: 大量像素风渲染示例和教程

**集成方式**：

```
React App
├── UI 层 (React + Tailwind)
│   ├── 侧边栏、弹窗、表单等
│   └── 覆盖在游戏画布之上
│
└── 游戏层 (PixiJS)
    ├── 办公室场景渲染
    ├── 角色动画
    └── 交互检测
```

```typescript
// @pixi/react 集成示例
import { Stage, Container, Sprite, AnimatedSprite } from '@pixi/react';

function OfficeScene() {
  return (
    <Stage width={1280} height={720} options={{ backgroundColor: 0xE8D5B7 }}>
      <Container>
        {/* 地板和墙壁 tilemap */}
        <OfficeFloor />
        {/* 家具 */}
        <Furniture items={desks} />
        {/* 员工角色 */}
        {employees.map(emp => (
          <EmployeeSprite key={emp.id} employee={emp} />
        ))}
      </Container>
    </Stage>
  );
}
```

### 2.3 Phaser 作为备选

如果后续需要更复杂的游戏逻辑（如寻路、物理碰撞），可迁移到 Phaser：
- Phaser 4 正在开发中，对模块化支持更好
- 与 React 集成需要更多胶水代码
- 性能与 PixiJS 相当

### 2.4 Cocos Creator 不推荐

- 与 React 生态集成困难，几乎需要两套技术栈
- 学习曲线陡峭，对团队效率不利
- 过重，大部分功能用不到

## 3. 关键技术难点

### 3.1 难点一：Tools 导致的提示词爆炸

**问题**: 员工绑定多个模块后，tools 列表可能 20-30 个，每个 tool 定义约 100-300 tokens，仅 tools 就占用 3000-9000 tokens。

**解决方案** (详见 PRD-prompts.md):
- 分层 Tool Routing：先意图分类，再加载对应模块的 tools
- Tool 动态裁剪：按任务相关性只加载 Top-K tools
- Tool description 压缩：精简描述，避免冗余
- 缓存编译：相同模块组合的 tool schema 编译一次，缓存复用

**参考**: Claude Code 的做法是通过 "deferred tools" 机制，只在需要时加载特定工具集。

**实现优先级**: 高。直接影响 LLM 调用效率和准确性。

### 3.2 难点二：前端性能优化

**问题**: 办公室场景 + 多个角色动画 + React UI 同时运行，容易卡顿。

**解决方案**:

| 策略 | 说明 |
|------|------|
| 渲染分层 | PixiJS 独立 canvas，React UI 在其上层，互不干扰 |
| 按需渲染 | 角色不在可视区域时暂停动画 |
| 精灵图集 | 所有角色图片打包为一个 spritesheet，减少 draw call |
| 对象池 | 频繁创建/销毁的粒子效果等使用对象池 |
| Web Worker | 记忆整理等计算密集操作放到 Worker |
| 虚拟化 | 聊天记录长列表使用虚拟滚动 |
| React Compiler | 已配置 (babel-plugin-react-compiler)，减少不必要 re-render |

**性能预算**:
- 同屏 20 个角色，每个角色 4-8 帧动画 → ~160 sprites
- PixiJS 处理上千个 sprites 毫无压力
- 瓶颈在 React 侧的频繁状态更新（需要控制更新频率）

**实现优先级**: 中。MVP 阶段角色数量有限，后续优化。

### 3.3 难点三：Agent 协作活跃度

**问题**: 如何让 Agent 不只是被动响应，而是像真人一样主动协作？

**解决方案**:

**事件驱动 + 定时触发的混合机制**：

```
┌──────────────┐
│  Event Bus   │  ← 任务完成、代码变更、消息收到等事件
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Activity    │  ← 判断哪些员工应该响应
│  Router      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Instance    │  ← 激活对应员工的对应实例
│  Manager     │
└──────────────┘
```

**具体触发场景**：

| 触发器 | 行为 |
|--------|------|
| Developer 提交代码 | Tester 自动开始 review |
| Product 写完需求 | Developer 主动评估技术方案 |
| 用户修改了文件 | 相关 Developer 检查变更影响 |
| 定时（每 30 分钟） | 空闲员工主动检查任务队列 |
| Leader 发布任务 | 相关角色主动认领 |
| 员工发现问题 | 主动向 Leader 汇报 |

**活跃度参数**：
- `initiative` 性格参数控制主动行为频率
- 高主动性员工更频繁地自我检查和汇报
- 低主动性员工只响应明确指令

**实现优先级**: 高。这是产品核心差异化。

### 3.4 难点四：Agent 感知系统

**问题**: Agent 需要准确感知自己的角色、环境、任务、协作者。

**解决方案**:

**上下文构建流水线**：

```typescript
class ContextBuilder {
  async build(employee: Employee, instance: InstanceType): Promise<string> {
    const [identity, env, memory, task, tools] = await Promise.all([
      this.buildIdentity(employee),
      this.buildEnvironment(employee),
      this.buildMemory(employee, instance),
      this.buildTask(employee, instance),
      this.buildTools(employee, instance),
    ]);

    return this.assemble([identity, env, memory, task, tools], {
      maxTokens: getModelContextWindow(employee.model) * 0.6,
    });
  }

  // 按优先级裁剪各区段，确保总量不超预算
  private assemble(sections: Section[], opts: { maxTokens: number }): string {
    // ... token 计数和裁剪逻辑
  }
}
```

**感知更新频率**：

| 感知维度 | 更新频率 | 来源 |
|----------|----------|------|
| 自身角色 | 创建时 + 用户修改时 | Employee 配置 |
| 环境状态 | 每次实例启动时 | Office 状态 + 项目状态 |
| 记忆 | 每次实例启动时 | Memory Store |
| 任务状态 | 实时 | Task Manager |
| 同事状态 | 每 5 分钟或事件触发 | Employee Manager |

**实现优先级**: 高。感知准确性直接影响 AI 输出质量。

### 3.5 难点五：记忆维护

**问题**: 如何让 Agent 有效维护和使用自己的记忆？

**解决方案** (详见 PRD-workspace.md):

- 三层记忆架构（短期/工作/长期）
- MemoryOrganizer 实例专职记忆整理
- 基于 confidence 的记忆衰减机制
- FTS + 可选向量检索的记忆查询
- Token 预算内的记忆注入策略

**关键技术点**：
- Embedding 生成：使用本地小型 embedding 模型（如 nomic-embed-text）
- 相似度检索：sqlite-vss 支持近似最近邻搜索
- 记忆压缩：定期将多条相关记忆合并为一条摘要

**实现优先级**: 中。MVP 可以先用简单的关键词匹配，后续引入向量检索。

## 4. 架构演进路径

### 4.1 Phase 1: 基础架构 (当前 → MVP)

```
当前架构:
React Chat UI ←→ Express Agent API ←→ LLM

目标架构:
React + PixiJS Office UI ←→ Express Employee API ←→ LLM
                                    ↕
                               SQLite (扩展 schema)
```

关键改动：
- 前端：引入 PixiJS，新增办公室场景组件
- 后端：BaseAgent → Employee 基类，新增实例管理
- 数据库：新增 employees, workspaces, memories 表
- 保留现有聊天功能作为员工 Communicator 的基础

### 4.2 Phase 2: 模块系统

- 实现程序员模块（git + 代码操作 tools）
- 实现管理模块（员工管理 tools）
- 实现办公软件模块（笔记、搜索 tools）
- Tool 动态注入和路由

### 4.3 Phase 3: 记忆与协作

- 三层记忆系统
- MemoryOrganizer 实例
- 员工间通信协议
- 事件驱动的活跃度系统

### 4.4 Phase 4: 桌面端打包

- 选择 Tauri (推荐，更轻量) 或 Electron
- 文件系统权限适配
- 本地 LLM 集成（直接调用 llama.cpp 等）
- 自动更新机制

## 5. 依赖变更预估

### 新增依赖

| 包名 | 用途 | 预估大小 |
|------|------|----------|
| `pixi.js` | 2D 渲染引擎 | ~150KB gzip |
| `@pixi/react` | React 集成 | ~10KB gzip |
| `dragonbones-pixi` | 骨骼动画运行时 | ~50KB gzip |
| `@tauri-apps/cli` (dev) | 桌面端打包 | dev only |
| `tiktoken` | Token 计数 | ~50KB gzip |

### 可能移除的依赖

| 包名 | 原因 |
|------|------|
| `@slack/bolt` / `@slack/events-api` | 转为可选模块，不作为核心依赖 |
| `@gitbeaker/rest` | 转为可选模块 |
| `ffmpeg-static` / `fluent-ffmpeg` | 当前无使用场景 |
| `kill-port-process` | 开发工具，不需要 |

## 6. 开发环境与工具链

### 6.1 包管理器迁移

从 npm/yarn 迁移到 bun：
- `bun install` 替代 `npm install`
- `bun run dev` 替代 `npm run dev`
- `bunx` 替代 `npx`
- 保留 `package.json` 兼容性

### 6.2 测试策略

| 层 | 工具 | 覆盖内容 |
|----|------|----------|
| 单元测试 | Vitest (已有) | Store, Utils, Prompt Builder |
| 组件测试 | Testing Library (已有) | React UI 组件 |
| 集成测试 | Vitest + supertest | API Routes + Agent 执行 |
| 渲染测试 | PixiJS test utils | 办公室场景渲染 |
| E2E | Playwright (未来) | 完整用户流程 |

### 6.3 项目目录结构演进

```
supercell/
├── docs/              # 需求文档 (本次产出)
├── src/               # 前端源码
│   ├── App.tsx        # 主入口 → 路由到办公室或聊天
│   ├── office/        # 新增：虚拟办公室场景
│   │   ├── OfficeScene.tsx
│   │   ├── EmployeeSprite.tsx
│   │   ├── Furniture.tsx
│   │   └── assets/    # 像素素材
│   ├── uikit/         # 已有：UI 组件
│   ├── store/         # 已有：状态管理 → 扩展
│   ├── service/       # 已有：API 服务
│   └── createStore/   # 已有：Store 工具
├── server/            # 后端源码
│   ├── agents/        # 已有 → 演进为 employees
│   ├── modules/       # 新增：功能模块系统
│   ├── memory/        # 新增：记忆管理
│   ├── routes/        # 已有 → 扩展
│   ├── db/            # 已有 → 扩展 schema
│   └── utils/         # 已有
├── assets/            # 新增：全局资源
│   ├── sprites/       # 像素精灵图
│   └── animations/    # 骨骼动画文件
└── package.json
```

## 审核意见

> 审核人：pm-review
> 审核日期：2026-04-02

### 1. 与原始需求一致性

| # | 原始需求 | PRD覆盖 | 结论 |
|---|---------|---------|------|
| T1 | "桌面端，采用React + bun + ts + Cocos或Phaser或PixiJs" | 推荐 PixiJS，对比了 Phaser 和 Cocos，合理 | 覆盖 |
| T2 | "参考claude如何处理tools导致提示词爆炸问题" | 3.1 详细分析了 Tools 爆炸 | 覆盖 |
| T3 | "如何优化前端性能问题" | 3.2 详细列出性能优化策略 | 覆盖 |
| T4 | "如何让Agent能通力协作并且真的活跃起来" | 3.3 定义了事件驱动+定时触发机制 | 覆盖 |
| T5 | "如何让Agent感知到自己的角色，工作环境，任务" | 3.4 定义了感知系统和上下文构建流水线 | 覆盖 |
| T6 | "如何让Agent很好维护自己的记忆" | 3.5 引用 PRD-workspace，定义了关键技术点 | 覆盖 |
| T7 | "需要调研是否有免费的骨骼动画平台" | 虽未在此文档展开，但 PRD-visual 和 DESIGN-visual-style 和 ARCH 评估都覆盖了 | 间接覆盖 |

**原始需求提到的 5 个技术难点全部覆盖。**

### 2. 与架构评估的对齐

PRD-tech 和 ARCH-tech-evaluation.md 是两个团队独立产出，需检查一致性：

| 维度 | PRD-tech | ARCH 评估 | 一致性 |
|------|----------|-----------|--------|
| 游戏引擎 | PixiJS | PixiJS | 一致 |
| 骨骼动画 | DragonBones | DragonBones（主）+ Lottie（辅） | 基本一致，ARCH 补充了 Lottie |
| 桌面端 | "待定（Electron/Tauri）" | Electron（短期）→ Tauri（中期） | PRD 未做决定，ARCH 已给明确建议 |
| 演进路径 | 4阶段（基础/模块/记忆协作/桌面端） | 4阶段（MVP无游戏层/PixiJS+3实例/Tools+记忆/优化+Tauri） | **有分歧**：PRD Phase 1 含 PixiJS，ARCH Phase 1 不含 |
| bun 替代 npm | 6.1 明确迁移到 bun | ARCH 未提及 bun | PRD 独有 |

**关键分歧：Phase 1 是否包含 PixiJS？**
- PRD-tech Phase 1 目标架构包含 "React + PixiJS Office UI"
- ARCH 评估 Phase 1 建议"无游戏层，先做多 Agent 面板"
- 架构审核也建议 Phase 2 拆分为 2a（PixiJS）+ 2b（3实例）
- **产品建议：采纳架构意见，Phase 1 不含 PixiJS，先验证核心 Agent 交互。** 游戏化界面是锦上添花，Agent 工作能力是根基。

### 3. 用户场景补充

**场景：技术选型验证（PoC）**
- 在 Phase 1 之前是否需要 PoC 阶段？
- 架构审核建议"Phase 1 就验证 pixi-dragonbones 在 PixiJS v8 下是否正常工作"
- 建议：增加 Phase 0（1-2周），验证：(1) PixiJS v8 + @pixi/react + DragonBones 集成；(2) 本地 7B 模型的 tool calling 可靠性；(3) Electron + PixiJS 的 WebGL 性能

**场景：开发环境搭建**
- 新开发者 clone 项目后，需要安装什么？bun？本地 LLM？DragonBones 编辑器？
- 建议：补充"开发环境要求"清单

### 4. 边界Case

| # | 边界场景 | 建议 |
|---|---------|------|
| T-E1 | bun 与 Electron 的兼容性 | Electron 主进程运行 Node.js，不是 bun。如果用 bun 做包管理但运行时是 Node.js，native addon（better-sqlite3）的编译是否一致？需验证 |
| T-E2 | 本地 LLM 不支持 function calling | 许多小模型不支持 OpenAI 格式的 function calling。当 tool calling 不可用时如何降级？是否用 prompt 内的 JSON 指令替代？ |
| T-E3 | PixiJS v8 + React 19 的 Concurrent Mode | React 19 的 concurrent features 可能导致 PixiJS Canvas 在 suspense boundary 中被卸载重载。需验证 |
| T-E4 | 依赖移除的影响 | 5.2 建议移除 @slack/bolt 等，但这些可能是原始需求中"其他模块"的基础。移除前需确认是否还需要 Slack 集成能力 |

### 5. 关键建议汇总

1. **采纳架构的 Phase 分拆建议**：Phase 1 不含 PixiJS，专注 Agent 核心能力。Phase 2a 引入 PixiJS，Phase 2b 引入三实例。
2. **bun 定位需明确**：包管理器用 bun（替代 npm），运行时仍为 Node.js（Electron 约束）。不要在文档中暗示 bun 替代 Node.js。
3. **增加 Phase 0 技术验证**：1-2 周 PoC，验证三个关键集成点。
4. **桌面端方案采纳 ARCH 建议**：Electron 优先，Tauri 作为长期可选。

### 6. 总体评价

技术选型分析充分，5大难点的解决方案各有针对性。与架构评估基本一致但存在 Phase 分拆和桌面端决策的分歧。主要建议：(1) Phase 路径与架构对齐；(2) bun 定位明确化；(3) 增加 PoC 阶段；(4) 验证 bun + Electron + native addon 兼容性。

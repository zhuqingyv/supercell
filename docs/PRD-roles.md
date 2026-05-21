# PRD-roles: 角色系统详细设计

## 1. 角色数据模型

每个角色（员工）由以下核心属性定义：

```typescript
interface Employee {
  id: string;                    // 唯一标识
  name: string;                  // 员工名称（用户自定义）
  title: string;                 // 职位名称
  avatar: PixelAvatar;           // 像素头像配置
  bio: string;                   // 个人简介（影响 AI 人设）
  role: RoleType;                // 角色类型（决定可用模块）
  modules: ModuleBinding[];      // 已绑定的功能模块
  personality: PersonalityConfig; // 性格配置（影响提示词）
  status: EmployeeStatus;        // 当前状态
  workspace: WorkspaceRef;       // 工作空间引用
  memory: MemoryStore;           // 记忆存储
  createdAt: number;
  lastActiveAt: number;
}
```

### 角色类型 (RoleType)

| 类型 | 说明 | 默认可用模块 |
|------|------|-------------|
| `leader` | 领导角色 | 管理模块、办公软件 |
| `designer` | 设计角色 | 办公软件 |
| `product` | 产品角色 | 办公软件 |
| `developer` | 开发角色 | 程序员模块、办公软件 |
| `tester` | 测试角色 | 程序员模块、办公软件 |
| `custom` | 自定义角色 | 用户配置 |

### 员工状态 (EmployeeStatus)

```typescript
type EmployeeStatus =
  | 'idle'         // 空闲
  | 'working'      // 干活中
  | 'thinking'     // 思考/整理记忆中
  | 'chatting'     // 聊天中
  | 'offline'      // 离线/休息
  | 'error';       // 异常状态
```

## 2. 三实例机制

每个员工内部最多由 **3 个 Agent 实例** 并行维护，实现同时执行不同类型的任务。

### 实例类型

| 实例 | 职责 | 触发条件 | 优先级 |
|------|------|----------|--------|
| **Worker** | 执行实际工作任务（写代码、做设计等） | 收到工作任务时 | 最高 |
| **MemoryOrganizer** | 整理和归纳工作记忆 | 工作完成后 / 空闲时定期触发 | 中 |
| **Communicator** | 与用户或其他员工聊天 | 用户点击聊天 / 收到消息时 | 按需 |

### 实例生命周期

```
                    ┌──────────────────────────────┐
                    │        Employee Entity        │
                    │                                │
                    │  ┌─────────┐  ┌────────────┐  │
  Task Assigned ──> │  │ Worker  │  │  Memory    │  │ <── 定时/空闲触发
                    │  │ Instance│  │ Organizer  │  │
                    │  └─────────┘  └────────────┘  │
                    │       ┌────────────┐          │
  User Click ────> │       │Communicator│          │ <── 收到消息
                    │       └────────────┘          │
                    └──────────────────────────────┘
```

### 实例资源管理

- 每个实例独立持有一个 LLM 会话上下文
- Worker 和 MemoryOrganizer 共享同一个 memory store（有读写锁）
- Communicator 只读 memory，不直接写入
- 当 LLM 资源受限时，优先保证 Worker 实例运行
- 实例闲置超过设定时间后自动释放 LLM 会话

### 实例间通信

```typescript
interface InstanceMessage {
  from: 'worker' | 'memory_organizer' | 'communicator';
  to: 'worker' | 'memory_organizer' | 'communicator';
  type: 'task_complete' | 'memory_updated' | 'user_request' | 'status_change';
  payload: unknown;
}
```

- Worker 完成任务后通知 MemoryOrganizer 整理本次工作记录
- Communicator 收到用户关于工作进度的询问时，从 Worker 拉取当前状态
- MemoryOrganizer 整理完成后通知 Worker 和 Communicator 更新上下文

## 3. 角色创建流程

### 从模版创建
1. 用户在管理面板选择"创建员工"
2. 展示可用的角色模版列表（按职位分类）
3. 用户选择模版后，自定义名称和个人简介
4. 系统自动绑定模版对应的模块
5. 初始化工作空间和记忆存储
6. 员工出现在虚拟办公室中

### 自定义创建
1. 用户选择"自定义角色"
2. 依次配置：名称、职位、简介、性格倾向
3. 手动选择要绑定的功能模块
4. 编写或选择基础提示词模版
5. 完成创建

### 解雇流程
1. 用户在管理面板选择员工
2. 点击"解雇"，弹出确认对话框
3. 确认后：
   - 停止该员工所有实例
   - 归档工作空间数据（不立即删除）
   - 从虚拟办公室移除
   - 30 天后自动清理归档数据（或用户手动删除）

## 4. 性格配置系统

性格配置直接影响员工的提示词生成和行为模式。

```typescript
interface PersonalityConfig {
  // 基础性格维度（0-100）
  formality: number;      // 正式程度：0=随意 100=严肃
  verbosity: number;      // 详细程度：0=简洁 100=详尽
  initiative: number;     // 主动性：0=被动等指令 100=积极主动
  creativity: number;     // 创造性：0=保守严谨 100=大胆创新

  // 工作风格
  workStyle: 'methodical' | 'agile' | 'exploratory';

  // 自定义人设补充（直接注入提示词）
  customPrompt?: string;
}
```

### 性格对行为的影响

| 维度 | 低值表现 | 高值表现 |
|------|----------|----------|
| formality | 使用口语化表达，偶尔开玩笑 | 使用专业术语，结构化输出 |
| verbosity | 只给结论和关键信息 | 详细解释推理过程 |
| initiative | 严格按指令执行 | 主动发现问题并提出建议 |
| creativity | 遵循最佳实践和常规方案 | 提出非常规解决方案 |

## 5. 员工间协作

### 协作场景
- **Leader 分配任务**: Leader 角色可以将任务拆解后分配给其他员工
- **Developer + Tester**: 开发完成后自动触发测试员 review
- **Product + Designer**: 产品需求确认后触发设计师出方案
- **任意角色间消息**: 员工可以互相发消息讨论

### 协作通信协议

```typescript
interface TeamMessage {
  id: string;
  from: string;         // 发送者 employee id
  to: string | '*';     // 接收者 id 或广播
  type: 'task_assign' | 'task_result' | 'discussion' | 'review_request';
  content: string;
  attachments?: Attachment[];  // 代码片段、文件引用等
  timestamp: number;
}
```

## 6. 与现有代码的映射

| 现有代码 | 演进方向 |
|----------|----------|
| `server/agents/base.ts` BaseAgent | 演进为 Employee 基类，增加三实例管理 |
| `server/agents/orchestrator.ts` | 演进为员工编排器，管理创建/销毁/协作 |
| `server/agents/developer.ts` 等 | 演进为角色模版，而非硬编码角色 |
| `src/store/index.ts` Chat store | 扩展为包含员工列表、工作空间状态 |
| `server/db/index.ts` SQLite | 增加 employees/workspaces/memories 表 |

## 审核意见

> 审核人：pm-review
> 审核日期：2026-04-02

### 1. 与原始需求一致性

| # | 检查点 | 结论 |
|---|--------|------|
| R1 | "每个角色包含名称、个人简介、职位信息" | Employee 数据模型已覆盖 name/bio/title |
| R2 | "内部由最多三个Agent实例维护：干活/整理记忆/聊天" | 三实例机制完整覆盖 Worker/MemoryOrganizer/Communicator |
| R3 | "领导角色，设计角色，产品角色，开发角色等" | RoleType 覆盖了 leader/designer/product/developer/tester + custom |

**一致性良好。**

### 2. 用户场景补充

**场景：员工状态异常恢复**
- Worker 实例在执行 git push 时 LLM 超时/崩溃，如何恢复？
- 当前 EmployeeStatus 有 `error` 状态，但缺少恢复流程定义：谁来重试？用户手动？自动？
- 建议：增加"异常恢复策略"小节，定义 error -> idle 的转换条件和重试机制

**场景：员工能力升级**
- 原始需求强调"养成"，但角色数据模型没有"成长"相关字段
- 建议考虑：经验值（完成任务累计）、能力等级（影响可绑定的模块数量或质量）
- 这是"养成游戏感"的核心机制，当前完全缺失

**场景：同一员工跨项目**
- Employee 绑定 `workspace: WorkspaceRef`（单数），但长期目标要求多项目支持
- 建议：workspace 应为数组或映射关系（一个员工可有多个项目的工作空间）

### 3. 边界Case

| # | 边界场景 | 建议 |
|---|---------|------|
| R-E1 | 三实例同时请求 LLM 导致排队 | 需与架构对齐（ARCH 建议 Phase 1 只做单实例）。产品需定义：三实例的优先级调度对用户可见吗？还是透明处理？ |
| R-E2 | 解雇流程中 Worker 正在执行关键操作（git commit 进行中） | 解雇是否应该等待当前任务完成？还是强制中断？当前流程只说"停止所有实例"，需细化 |
| R-E3 | 员工名称冲突 | 两个员工可以同名吗？如果可以，UI 如何区分？ |
| R-E4 | 自定义角色没有绑定任何模块 | 是否允许？一个没有任何 tool 的员工能做什么？ |
| R-E5 | Communicator 收到用户工作指令但 Worker 满负荷 | 聊天实例告诉用户"我现在在忙"？还是创建排队任务？ |

### 4. 跨文档一致性

- PRD-roles 定义的 EmployeeStatus 有 6 种状态（idle/working/thinking/chatting/offline/error），但 DESIGN-states.md 定义了 11 种状态（含 coding/designing/testing/writing/reviewing/meeting/break/memorizing）。**严重不一致**。建议：PRD-roles 的 EmployeeStatus 应与 DESIGN-states.md 的状态机对齐，将 `working` 拆分为子状态。
- PRD-roles 第5节的 TeamMessage 协议与 PRD-modules 第3节的管理模块 `send_message` tool 有功能重叠，需明确：员工间通信是通过 TeamMessage 协议还是通过 tool 调用？
- 性格配置 PersonalityConfig 与 PRD-prompts 第2.2节的身份定义区段对应良好

### 5. 总体评价

角色系统设计详尽，三实例机制和性格配置系统是亮点。主要问题：(1) 状态定义与设计文档不一致；(2) 缺少"养成/成长"机制（与产品核心定位"养成游戏"不匹配）；(3) 异常恢复流程缺失。建议优先修复状态一致性问题。

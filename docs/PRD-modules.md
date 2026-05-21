# PRD-modules: 功能模块详细设计

## 1. 模块系统架构

模块是员工能力的来源。每个模块提供一组 tools（工具），通过动态注入到员工的提示词中，使员工具备对应能力。

```
┌─────────────────────────────────────────┐
│              Module Registry             │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ 程序员   │ │ 管理     │ │ 办公    │ │
│  │ 模块     │ │ 模块     │ │ 软件    │ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │       │
│  ┌────▼─────┐ ┌────▼─────┐ ┌───▼────┐ │
│  │ Tools[]  │ │ Tools[]  │ │Tools[] │ │
│  └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────┘
         │
         ▼  动态注入
┌─────────────────────┐
│  Employee Prompt     │
│  System + Tools      │
└─────────────────────┘
```

### 模块数据模型

```typescript
interface Module {
  id: string;
  name: string;
  description: string;
  category: 'function' | 'role';   // 功能模块 or 角色引导模块
  tools: ToolDefinition[];
  requiredPermissions: Permission[];
  config?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: unknown) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output: string;
  artifacts?: Artifact[];  // 生成的文件、代码片段等
}
```

## 2. 程序员模块

程序员模块提供完整的 git 和代码操作能力，是开发角色的核心模块。

### 2.1 Git 操作 Tools

| Tool 名称 | 功能 | 参数 |
|-----------|------|------|
| `git_status` | 查看仓库状态 | `{ path: string }` |
| `git_diff` | 查看变更差异 | `{ path: string, staged?: boolean }` |
| `git_log` | 查看提交历史 | `{ path: string, limit?: number }` |
| `git_add` | 暂存文件 | `{ path: string, files: string[] }` |
| `git_commit` | 提交变更 | `{ path: string, message: string }` |
| `git_branch` | 分支操作 | `{ path: string, action: 'list' \| 'create' \| 'switch', name?: string }` |
| `git_pull` | 拉取远程 | `{ path: string, remote?: string }` |
| `git_push` | 推送远程 | `{ path: string, remote?: string }` |

### 2.2 代码操作 Tools

| Tool 名称 | 功能 | 参数 |
|-----------|------|------|
| `read_file` | 读取文件内容 | `{ path: string, lines?: { start: number, end: number } }` |
| `write_file` | 写入文件 | `{ path: string, content: string }` |
| `edit_file` | 编辑文件（diff 模式） | `{ path: string, edits: Edit[] }` |
| `search_code` | 搜索代码 | `{ pattern: string, path?: string, regex?: boolean }` |
| `list_files` | 列出目录文件 | `{ path: string, pattern?: string, recursive?: boolean }` |
| `run_command` | 执行终端命令 | `{ command: string, cwd?: string, timeout?: number }` |
| `run_tests` | 运行测试 | `{ path: string, pattern?: string }` |

### 2.3 安全约束

- `run_command` 需要用户在创建员工时授权可执行的命令白名单
- 破坏性 git 操作（force push, reset --hard）需要二次确认
- 文件写入限制在指定项目目录内，禁止写入系统路径
- 所有操作记录到审计日志

### 2.4 实现参考

当前项目已有 `simple-git` 依赖，可直接基于此封装：

```typescript
// 基于现有 package.json 中的 simple-git
import simpleGit from 'simple-git';

class GitToolHandler {
  private git;

  constructor(workdir: string) {
    this.git = simpleGit(workdir);
  }

  async status() {
    return this.git.status();
  }

  async diff(staged = false) {
    return staged ? this.git.diff(['--staged']) : this.git.diff();
  }
  // ...
}
```

## 3. 管理模块

管理模块提供人员管理能力，通常绑定给 Leader 角色。

### 3.1 员工管理 Tools

| Tool 名称 | 功能 | 参数 |
|-----------|------|------|
| `create_employee` | 创建新员工 | `{ name, title, role, bio, template? }` |
| `fire_employee` | 解雇员工 | `{ employeeId, reason }` |
| `assign_task` | 分配任务 | `{ employeeId, task: TaskDef }` |
| `check_status` | 查看员工状态 | `{ employeeId? }` (不传则查看全部) |
| `send_message` | 给员工发消息 | `{ employeeId, message }` |
| `review_work` | 审查员工工作 | `{ employeeId, taskId }` |

### 3.2 任务管理 Tools

| Tool 名称 | 功能 | 参数 |
|-----------|------|------|
| `create_task` | 创建任务 | `{ title, description, assignee?, priority }` |
| `update_task` | 更新任务状态 | `{ taskId, status, notes? }` |
| `list_tasks` | 列出任务 | `{ status?, assignee? }` |
| `task_breakdown` | 任务拆解 | `{ taskId, subtasks: SubTask[] }` |

### 3.3 权限控制

- 只有 `leader` 类型角色可绑定管理模块
- 创建/解雇员工操作需要用户确认
- Leader 的 AI 可以建议创建/解雇，但最终决定权在用户

## 4. 办公软件模块

办公软件模块是 AI 视角下的虚拟工具集合，通过 tools 注入实现。

### 4.1 核心理念

对 AI 来说，"使用办公软件"就是调用一组 tools。我们通过界面渲染让用户看到员工在"用"这些软件。

### 4.2 内置办公 Tools

| Tool 名称 | 对应"软件" | 功能 |
|-----------|-----------|------|
| `write_note` | 笔记本 | 写/更新工作笔记 |
| `read_notes` | 笔记本 | 读取已有笔记 |
| `create_doc` | 文档编辑器 | 创建结构化文档 |
| `search_workspace` | 搜索 | 搜索工作空间内容 |
| `send_chat` | 聊天软件 | 给同事发消息 |
| `read_chat` | 聊天软件 | 读取聊天记录 |
| `calendar_event` | 日历 | 创建/查看日程 |
| `share_file` | 文件共享 | 与同事共享文件 |

### 4.3 虚拟界面映射

当 AI 调用某个 tool 时，前端对应展示虚拟界面动效：

| Tool 调用 | 视觉表现 |
|-----------|----------|
| `write_note` | 员工面前出现笔记本，打字动画 |
| `send_chat` | 员工头上出现聊天气泡 |
| `search_workspace` | 员工电脑屏幕显示搜索界面 |
| `create_doc` | 员工面前出现文档图标 |

## 5. 扩展模块接入 (Claude Tools 参考)

参考 Claude 的 tools 机制，支持将外部 tools 作为模块接入。

### 5.1 模块注册协议

```typescript
interface ExternalModule {
  name: string;
  version: string;
  tools: ExternalToolDef[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

interface ExternalToolDef {
  name: string;
  description: string;
  input_schema: JSONSchema;
  // 执行方式
  executor: 'http' | 'command' | 'function';
  config: HttpConfig | CommandConfig | FunctionConfig;
}
```

### 5.2 接入示例

以 Slack 集成为例（当前项目已有 `@slack/bolt` 依赖）：

```typescript
const slackModule: ExternalModule = {
  name: 'slack',
  version: '1.0.0',
  tools: [
    {
      name: 'slack_send',
      description: '向 Slack 频道发送消息',
      input_schema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['channel', 'message'],
      },
      executor: 'function',
      config: { handler: slackSendHandler },
    },
    // slack_read, slack_search 等
  ],
};
```

### 5.3 模块热加载

- 模块在运行时动态加载，不需要重启应用
- 加载后自动注入到员工的 tool 列表
- 卸载时自动从员工提示词中移除

## 6. 角色引导模块

角色引导模块不提供 tools，而是提供预设的提示词片段和行为规范。

### 6.1 内置角色模版

| 模版名称 | 职位 | 核心提示词要点 |
|----------|------|---------------|
| 技术领导 | leader | 全局视野、任务拆解、风险评估、决策能力 |
| UI设计师 | designer | 用户体验优先、视觉规范、可用性分析 |
| 产品经理 | product | 需求分析、用户画像、优先级排序、竞品分析 |
| 全栈开发 | developer | 代码质量、架构设计、性能优化、安全意识 |
| QA工程师 | tester | 测试覆盖、边界分析、回归测试、Bug 复现 |

### 6.2 模版与功能模块的组合

```
角色模版 = 角色引导模块(提示词) + 功能模块(tools)

例如：
全栈开发 = 开发者引导模版 + 程序员模块 + 办公软件模块
技术领导 = 领导引导模版 + 管理模块 + 程序员模块(只读) + 办公软件模块
```

## 审核意见

> 审核人：pm-review
> 审核日期：2026-04-02

### 1. 与原始需求一致性

| # | 原始需求 | PRD覆盖 | 结论 |
|---|---------|---------|------|
| M1 | "程序员模块：完整的git、代码操作" | 2.1/2.2 详细定义了 git + 代码 tools | 完整覆盖 |
| M2 | "管理模块：创建和解雇员工模块" | 3.1 覆盖了 create/fire/assign/check/send/review | 完整覆盖 |
| M3 | "办公软件模块：AI眼中的虚拟办公软件" | 4.1-4.3 定义了"tool调用=使用软件"的核心理念 | 覆盖，且有创意 |
| M4 | "其他模块：参考claude源码，看能否将其他tools作为模块接入" | 5.1-5.3 定义了 ExternalModule 注册协议和热加载 | 覆盖 |
| M5 | "基于功能模块和角色模块集成的模版" | 6.2 定义了模版=引导模块+功能模块的组合 | 覆盖 |

**与原始需求高度一致。**

### 2. 用户场景补充

**场景：Tool 执行失败**
- `run_command` 执行了一个耗时长的命令（如 `npm install`），超时了怎么办？
- `git_push` 遇到冲突怎么办？员工是否有能力自主解决 merge conflict？
- 建议：每个 tool 补充"失败处理策略"（重试/降级/上报用户）

**场景：权限升级**
- 安全约束 2.3 提到命令白名单，但未说明用户如何管理白名单
- 用户是否能实时看到员工正在请求执行什么命令？类似"sudo 确认"
- 建议：增加"权限管理 UI"场景描述

**场景：模块冲突**
- 如果一个自定义角色同时绑定了程序员模块和管理模块，tool 名称冲突怎么办？
- 比如两个外部模块都定义了 `search` tool

### 3. 边界Case

| # | 边界场景 | 建议 |
|---|---------|------|
| M-E1 | `run_command` 命令执行了恶意操作（rm -rf） | 白名单机制如何防止命令注入？如 `git commit -m "$(rm -rf /)"` |
| M-E2 | `write_file` 写入了一个巨大文件（100MB+） | 需定义文件大小限制 |
| M-E3 | 外部模块 setup() 失败或抛异常 | 热加载失败如何降级？是否影响已加载的其他模块？ |
| M-E4 | 员工同时通过 `send_chat` 和 Communicator 实例发消息 | tool 调用和实例行为的边界在哪？ |
| M-E5 | `calendar_event` 创建的日程到时间了 | 日历事件如何触发提醒？是否与事件驱动系统（PRD-tech 3.3）联动？ |

### 4. 跨文档一致性

- 程序员模块的 `read_file`/`write_file`/`search_code` 与现有代码 `server/utils/codeReader.ts` 的功能对应，架构评估也标注了"高复用"
- 办公软件模块的虚拟界面映射（4.3）需与 PRD-visual 的交互设计对齐——当前 PRD-visual 5.2 的交互流程中"点击电脑→查看聊天"，但办公软件模块暗示电脑屏幕可能显示多种虚拟软件界面，不只是聊天
- 管理模块的 `create_employee` tool 让 Leader AI 可以自主创建员工，但 PRD-roles 第3节说创建需要用户确认。这个"用户确认"在 tool 层面如何实现？建议明确：tool 返回 `pending_confirmation` 状态，前端弹窗让用户确认

### 5. 遗漏功能点

- **版本控制/回滚**：程序员模块有 git_commit 但没有 git_revert/git_stash，实际开发中经常需要
- **文件对比**：code review 场景需要 diff 两个版本的文件，当前只有 git_diff
- **搜索结果分页**：search_code 和 search_workspace 未定义结果数量限制

### 6. 总体评价

模块系统设计完整，tool 定义清晰，安全约束考虑到位。扩展模块协议设计良好。主要不足：(1) tool 失败处理策略缺失；(2) 权限管理的用户侧体验未定义；(3) 需与视觉交互文档对齐"虚拟屏幕"显示内容。

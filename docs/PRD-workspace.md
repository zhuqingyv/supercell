# PRD-workspace: 工作空间与记忆系统

## 1. 工作空间概述

每个员工拥有独立的工作空间，是其所有工作痕迹和知识的存储中心。

```
Employee Workspace
├── notes/           # 项目笔记
├── memory/          # 个人记忆
│   ├── facts.md     # 事实性记忆（项目结构、技术栈等）
│   ├── methods.md   # 经验方法论
│   └── relations.md # 人际/协作记忆
├── tasks/           # 任务记录
├── chat-logs/       # 聊天记录归档
└── artifacts/       # 工作产出物（代码片段、文档等）
```

## 2. 项目笔记系统

### 2.1 笔记类型

| 类型 | 说明 | 自动/手动 |
|------|------|----------|
| 项目注意事项 | 项目特有的规范和注意点 | 员工自主记录 |
| 会议纪要 | 与用户或其他员工的讨论结论 | 自动从对话中提取 |
| 技术调研 | 技术选型、方案对比 | 员工工作产出 |
| 问题记录 | 遇到的坑和解决方案 | 员工自主记录 |

### 2.2 笔记数据结构

```typescript
interface Note {
  id: string;
  employeeId: string;
  title: string;
  content: string;         // Markdown 格式
  tags: string[];
  projectRef?: string;     // 关联的项目路径
  source: 'manual' | 'auto_extract' | 'task_output';
  createdAt: number;
  updatedAt: number;
}
```

### 2.3 自动提取机制

当员工完成一项工作任务时，MemoryOrganizer 实例自动执行：
1. 分析本次工作的对话记录和产出
2. 提取关键信息点（决策、发现、解决方案）
3. 生成结构化笔记
4. 打标签并存入工作空间

## 3. 个人记忆系统

记忆系统是区别"虚拟员工"和"一次性 AI 对话"的核心能力。

### 3.1 记忆层次

```
┌──────────────────────────────────┐
│         短期记忆 (Short-term)     │  ← 当前会话上下文
│   当前对话 + 当前任务上下文        │
├──────────────────────────────────┤
│         工作记忆 (Working)        │  ← 当前项目相关
│   项目结构、当前分支、近期改动      │
├──────────────────────────────────┤
│         长期记忆 (Long-term)      │  ← 跨项目积累
│   经验方法论、用户偏好、最佳实践    │
└──────────────────────────────────┘
```

### 3.2 短期记忆

- 即 LLM 的对话上下文窗口
- 每次交互自动维护
- 受限于模型上下文长度
- 会话结束后由 MemoryOrganizer 提炼为工作记忆或长期记忆

### 3.3 工作记忆

与当前项目强相关的信息，存储在工作空间中。

```typescript
interface WorkingMemory {
  projectPath: string;
  // 项目结构快照
  structure: {
    key_files: string[];       // 关键文件列表
    tech_stack: string[];      // 技术栈
    conventions: string[];     // 编码规范
  };
  // 近期上下文
  recentChanges: string[];     // 最近的代码变更摘要
  openIssues: string[];        // 待解决问题
  // 协作上下文
  teamContext: {
    otherEmployees: string[];  // 在同项目工作的其他员工
    recentDiscussions: string[]; // 近期讨论要点
  };
}
```

### 3.4 长期记忆

跨项目积累的通用知识和经验。

```typescript
interface LongTermMemory {
  // 事实性记忆
  facts: FactEntry[];
  // 经验方法论
  methodologies: MethodEntry[];
  // 用户偏好
  userPreferences: PreferenceEntry[];
}

interface FactEntry {
  id: string;
  category: string;        // 'tech' | 'project' | 'tool' | 'person'
  content: string;
  confidence: number;      // 0-1 可信度
  source: string;          // 来源（哪次对话/任务）
  lastVerified: number;    // 最后验证时间
}

interface MethodEntry {
  id: string;
  title: string;
  scenario: string;        // 适用场景
  approach: string;        // 方法描述
  effectiveness: number;   // 0-1 有效性评分
  timesUsed: number;       // 使用次数
  lastUsed: number;
}

interface PreferenceEntry {
  id: string;
  key: string;             // 如 'code_style', 'commit_message', 'review_depth'
  value: string;
  observedFrom: string;    // 从哪里观察到的
}
```

## 4. 记忆管理策略

### 4.1 记忆写入

MemoryOrganizer 实例在以下时机执行记忆整理：

| 触发条件 | 动作 |
|----------|------|
| Worker 完成一个任务 | 提炼任务中的新知识 → 写入工作记忆 |
| 一轮对话结束 | 提取关键信息和偏好 → 更新长期记忆 |
| 定时触发（空闲时） | 回顾近期工作记忆 → 归纳为长期记忆 |
| 用户明确要求"记住这个" | 直接写入长期记忆 |

### 4.2 记忆读取与注入

每次 Worker 或 Communicator 开始新任务/对话时：

1. 加载与当前项目相关的工作记忆
2. 从长期记忆中检索相关条目（基于任务/对话关键词）
3. 压缩为提示词可用的格式
4. 注入到 system prompt 的记忆区段

### 4.3 记忆衰减与清理

- 长期记忆条目有 `confidence` 字段
- 长时间未被使用或验证的记忆，confidence 逐渐降低
- confidence 低于阈值的记忆标记为"待验证"
- 员工空闲时，MemoryOrganizer 会主动验证低置信度记忆
- 矛盾的记忆由 MemoryOrganizer 裁决，保留最新/最可信的

### 4.4 记忆容量控制

为避免记忆过大导致 token 浪费：

| 记忆类型 | 容量限制 | 超出策略 |
|----------|----------|----------|
| 工作记忆 | 每项目 50 条 | LRU 淘汰 + 压缩合并 |
| 长期记忆 facts | 200 条 | 按 confidence 淘汰 |
| 长期记忆 methods | 100 条 | 按 effectiveness 淘汰 |
| 用户偏好 | 50 条 | 按时间淘汰 |

## 5. 存储实现

### 5.1 数据库设计

基于现有的 SQLite (better-sqlite3) 扩展：

```sql
-- 工作空间
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  project_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 笔记
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,              -- JSON array
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 记忆条目
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  layer TEXT NOT NULL,    -- 'working' | 'long_term'
  category TEXT NOT NULL, -- 'fact' | 'method' | 'preference'
  title TEXT,
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  times_used INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  project_path TEXT,      -- NULL for long-term cross-project memories
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 全文搜索索引
CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, tags);
CREATE VIRTUAL TABLE memories_fts USING fts5(title, content, category);
```

### 5.2 向量检索 (可选增强)

当前项目已引入 `sqlite-vss` 依赖，可用于语义搜索：

```sql
-- 记忆向量索引
CREATE VIRTUAL TABLE memory_vectors USING vss0(
  embedding(384)   -- 使用小型 embedding 模型
);
```

- 写入记忆时，同时生成 embedding 存入向量索引
- 检索时先做语义搜索找到相关记忆，再读取完整内容
- 降级方案：向量搜索不可用时退化为关键词 FTS 搜索

## 6. 用户交互

### 6.1 查看工作空间

用户在虚拟办公室中点击员工卡片，进入该员工的工作空间视图：

- 左侧：笔记列表 + 搜索
- 中间：笔记/文档内容展示
- 右侧：员工状态 + 快捷操作

### 6.2 搜索功能

用户可搜索员工工作空间中的任何痕迹：

- 笔记内容
- 代码仓库中的文件和代码
- 聊天记录
- 任务记录

搜索通过 FTS + 可选向量检索实现，结果按相关度排序。

### 6.3 查看员工电脑

用户点击员工的电脑图标，可看到员工的"虚拟屏幕"：

- 当前打开的工作聊天软件（与其他员工的对话）
- 正在编辑的文件
- 终端输出（如果在执行命令）
- 相当于"偷看员工屏幕"的体验

## 审核意见

> 审核人：pm-review
> 审核日期：2026-04-02

### 1. 与原始需求一致性

| # | 原始需求 | PRD覆盖 | 结论 |
|---|---------|---------|------|
| W1 | "工作空间需要员工自己进行维护" | MemoryOrganizer 自动整理 + 员工自主记录 | 覆盖 |
| W2 | "包括各种项目注意事项和笔记" | 笔记系统 2.1-2.3 | 覆盖 |
| W3 | "员工自己的记忆，包含个人保存的通用经验和方法论" | 长期记忆 3.4（facts + methodologies + userPreferences） | 覆盖 |
| W4 | "搜索功能能搜索他工作空间里面的任何痕迹：笔记，代码仓库等" | 搜索功能 6.2 | 覆盖 |
| W5 | "点击用户卡片就能进入到员工工作空间" | 用户交互 6.1 | 覆盖 |
| W6 | "用户点击他的电脑就能看到他的工作聊天软件" | 查看员工电脑 6.3 | 覆盖 |

**与原始需求高度一致。**

### 2. 架构审核意见的回应

架构审核（architect-review）提出了几个关键质疑，产品侧需要回应：

| 架构意见 | 产品回应建议 |
|---------|------------|
| "Memory Agent 不应该是 LLM Agent"（2.1节） | 认同。建议：MVP 阶段 MemoryOrganizer 用规则引擎（关键词提取 + 固定模板总结），仅"遗忘决策"和"记忆关联性判断"用 LLM |
| "sqlite-vss 实验性项目"（3.2节） | 建议：MVP 用 FTS5 全文搜索（已在 schema 中定义），向量检索标记为"可选增强"而非必需 |
| "记忆容量控制的数字依据"（2.3节） | 当前容量限制（200条facts等）缺少推导过程。建议：按 token 预算反推——如果记忆注入占 20% prompt（约800 tokens），每条记忆平均 40 tokens，则约 20 条/次注入，总库存控制在 10x = 200 条合理 |

### 3. 用户场景补充

**场景：记忆冲突**
- 员工A记住"项目用 npm"，员工B记住"项目用 bun"（用户中途切换了包管理器）
- 当前方案"矛盾的记忆由 MemoryOrganizer 裁决"过于笼统
- 建议：定义冲突发现和解决的具体流程——展示给用户？自动以最新为准？

**场景：用户查看和编辑记忆**
- 6.1-6.3 的用户交互只定义了"查看"，没有"编辑"
- 用户是否能直接修正员工的错误记忆？（如：员工记住了错误的编码规范）
- 建议：增加记忆条目的"用户修正"功能——用户编辑后 confidence 设为 1.0

**场景：新员工继承老员工记忆**
- 解雇老员工后创建同职位新员工，能否继承部分长期记忆？
- 这是"养成感"的重要组成——不至于从零开始

### 4. 边界Case

| # | 边界场景 | 建议 |
|---|---------|------|
| W-E1 | SQLite 数据库文件损坏 | 本地应用高频读写，crash 可能导致数据库损坏。WAL 模式有一定保护，但需定义恢复策略（自动备份？） |
| W-E2 | 记忆衰减导致关键信息丢失 | 用户偏好类记忆不应衰减（如"代码风格偏好"）。建议：区分"可衰减记忆"和"永久记忆" |
| W-E3 | FTS 搜索中文分词问题 | SQLite FTS5 默认分词器对中文支持有限（按字符切分），搜索"状态管理"可能匹配不到"zustand状态管理库"。建议评估 jieba 分词或 simple 分词器 |
| W-E4 | 多个员工同时写入同一项目的工作记忆 | 两个 developer 同时在同一项目工作，各自的工作记忆如何避免重复/冲突？ |
| W-E5 | 工作空间数据量增长（长期运行后） | 半年使用后，笔记+记忆+聊天记录可能达到 GB 级别。需定义归档和清理策略 |

### 5. 跨文档一致性

- workspace 目录结构（第1节）定义了 `notes/` `memory/` `tasks/` `chat-logs/` `artifacts/`，与 DESIGN-wireframes.md 第3节的工作空间 Tab（笔记/代码仓库/记忆/办公软件）**不完全对齐**——PRD 有 tasks/ 和 artifacts/ 但设计没有对应 Tab，设计有"代码仓库"和"办公软件"Tab 但 PRD workspace 目录没有对应
- 记忆 Tab 的 UI（DESIGN-wireframes 记忆Tab）显示了"分类：通用经验/方法论/踩坑/规范/协作"，但 PRD 的 FactEntry.category 定义为 'tech' | 'project' | 'tool' | 'person'——分类体系不一致
- 查看员工电脑的功能描述与 DESIGN-interaction.md 第3节一致

### 6. 是否过度设计

- 三层记忆架构（短期/工作/长期）+ 记忆衰减 + 向量检索——MVP 阶段可能过重
- 建议 MVP 简化为：短期（对话上下文）+ 长期（SQLite + FTS），不做工作记忆层，不做向量检索，不做衰减
- V1.0 再引入工作记忆和衰减机制

### 7. 总体评价

工作空间和记忆系统设计是整个产品的核心差异化，设计质量高。主要问题：(1) 与设计文档的 Tab 结构和分类体系不一致；(2) MVP 阶段可适当简化三层记忆为两层；(3) 需要补充用户编辑记忆的交互；(4) 中文 FTS 分词需技术验证。

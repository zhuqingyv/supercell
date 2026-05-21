# Supercell - 核心交互流程

## 1. 点击员工 → 查看详情

```mermaid
sequenceDiagram
    actor U as 用户
    participant O as 办公室全景
    participant C as 员工卡片面板
    participant W as 工作空间
    participant CH as 聊天记录

    U->>O: 点击办公室中的像素角色
    O->>O: 角色高亮 + 缩放动画
    O->>C: 右侧滑出员工卡片面板
    Note over C: 显示: 头像、姓名、职位、状态<br/>当前任务、最近活动、快捷入口

    alt 点击"工作空间"按钮
        U->>C: 点击工作空间
        C->>W: 路由跳转 /workspace/:id
    else 点击"聊天记录"按钮
        U->>C: 点击聊天记录
        C->>CH: 路由跳转 /chat/:id
    else 点击面板外部 / 按 Esc
        U->>C: 关闭面板
        C->>O: 面板收回，恢复办公室全景
    end
```

**细节：**
- 点击角色时，该角色执行一个"注意"动画（转身面向镜头/挥手）
- 面板滑出使用 300ms ease-out 动画
- 面板宽度：桌面端 400px，移动端全屏
- 背景使用半透明遮罩（rgba(0,0,0,0.3)）

---

## 2. 进入工作空间 → 查看各项内容

```mermaid
sequenceDiagram
    actor U as 用户
    participant W as 工作空间
    participant N as 笔记 Tab
    participant R as 代码仓库 Tab
    participant M as 记忆 Tab
    participant T as 办公软件 Tab

    U->>W: 从员工卡片点击"工作空间"
    W->>N: 默认展示笔记 Tab
    Note over N: 左: 笔记列表（时间倒序）<br/>右: 笔记内容（Markdown渲染）

    alt 切换到代码仓库
        U->>R: 点击"代码仓库" Tab
        R->>R: 加载文件树 + 最近提交
        Note over R: 左: 文件树<br/>右: 文件内容（代码高亮）<br/>底: 提交历史
    else 切换到记忆
        U->>M: 点击"记忆" Tab
        M->>M: 加载记忆分类列表
        Note over M: 左: 分类（通用经验/方法论/踩坑/规范/协作）<br/>右: 记忆条目详情 + 置信度 + 来源
    else 切换到办公软件
        U->>T: 点击"办公软件" Tab
        T->>T: 加载已安装的工具列表
        Note over T: 动态渲染虚拟办公软件界面<br/>基于 Agent 的 tools 注入
    end
```

**细节：**
- Tab 切换无页面刷新，使用客户端路由 hash（`/workspace/:id#notes`）
- 笔记内容支持 Markdown 渲染
- 代码仓库使用简化的文件浏览器（非完整 IDE）
- 记忆条目按置信度和引用次数排序

---

## 3. 点击电脑 → 查看聊天记录

```mermaid
sequenceDiagram
    actor U as 用户
    participant O as 办公室全景
    participant CH as 聊天界面

    U->>O: 点击某个工位上的电脑图标
    O->>O: 电脑屏幕亮起动画
    O->>CH: 路由跳转 /chat/:employeeId

    CH->>CH: 加载对话列表
    Note over CH: 左栏: 对话列表<br/>- 一对一对话（按最近活跃排序）<br/>- 群组对话

    U->>CH: 点击某个对话
    CH->>CH: 加载对话消息
    Note over CH: 右栏: 对话消息流<br/>- 时间线展示<br/>- 只读模式标识<br/>- 消息气泡（区分发送方）

    U->>CH: 点击返回
    CH->>O: 返回办公室全景
```

**细节：**
- 聊天界面为只读模式，用户不能参与员工对话
- 底部显示"只读模式"提示
- 对话列表显示未读消息数量
- 支持按时间范围筛选对话
- 电脑图标可点击热区最小 32x32px（等距视角下电脑较小，需保证可交互性）

---

## 4. 搜索功能流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant NAV as 顶部导航
    participant S as 搜索界面
    participant R as 搜索结果
    participant D as 目标页面

    U->>NAV: 点击搜索图标 / 按 Cmd+K
    NAV->>S: 打开搜索界面

    alt 快速搜索模式 (Cmd+K)
        S->>S: 显示居中搜索浮层
        Note over S: 输入框 + 实时建议<br/>类似 Spotlight / VS Code 命令面板
        U->>S: 输入关键词
        S->>R: 实时显示前5条结果
        U->>R: 选择某条结果
        R->>D: 直接跳转到对应页面
    else 完整搜索模式
        S->>S: 显示完整搜索页面
        U->>S: 输入关键词
        U->>S: 选择筛选条件（类型/员工）
        S->>R: 显示完整结果列表
        Note over R: 按相关度排序<br/>高亮匹配关键词<br/>显示来源（笔记/代码/记忆/对话）
        U->>R: 点击某条结果
        R->>D: 跳转到对应的工作空间/聊天记录
    end
```

**细节：**
- `Cmd+K`（Mac）/ `Ctrl+K`（Windows）触发快速搜索
- 快速搜索浮层尺寸：宽度 500px，最大高度 400px，居中显示，背景遮罩
- 搜索范围：笔记标题和内容、代码文件名和内容、记忆条目、对话内容
- 搜索结果按相关度排序，关键词高亮
- 支持筛选：按类型（笔记/代码/记忆/对话）、按员工
- 搜索防抖：300ms

---

## 5. 创建新员工流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant M as 员工管理
    participant S1 as 步骤1-模版选择
    participant S2 as 步骤2-角色配置
    participant S3 as 步骤3-模块配置
    participant S4 as 步骤4-确认创建
    participant O as 办公室

    U->>M: 点击"+ 创建新员工"
    M->>S1: 进入创建向导

    Note over S1: 展示模版卡片:<br/>领导/设计/产品/开发/测试/自定义
    U->>S1: 选择一个模版
    S1->>S2: 进入角色配置

    Note over S2: 填写:<br/>- 姓名<br/>- 职位<br/>- 个人简介<br/>- 头像选择（像素风预设）
    U->>S2: 填写角色信息
    S2->>S3: 进入模块配置

    Note over S3: 勾选功能模块:<br/>☑ 程序员模块（git/代码操作）<br/>☑ 办公软件模块<br/>☐ 管理模块<br/>每个模块显示说明和包含的工具
    U->>S3: 选择功能模块
    S3->>S4: 进入确认页

    Note over S4: 显示创建预览:<br/>像素头像 + 姓名 + 职位<br/>+ 已选模块 + 预计能力
    U->>S4: 确认创建

    S4->>S4: 创建中动画（"正在入职..."）
    S4->>O: 创建完成，新员工出现在办公室
    Note over O: 新员工入场动画:<br/>从办公室门口走到空工位
```

**细节：**
- 4步向导，有步骤指示器和进度条
- 每步都可以返回上一步修改
- 模版选择后自动填充默认值，用户可修改
- 确认创建后有"入职动画"（像素角色从门口走到工位）
- 创建时初始化3个 Agent 实例（干活、整理记忆、聊天）

---

## 6. 解雇员工流程

```mermaid
sequenceDiagram
    actor U as 用户
    participant M as 员工管理/详情
    participant D as 确认弹窗
    participant O as 办公室

    U->>M: 点击员工列表中的"解雇"按钮
    M->>D: 弹出确认弹窗

    Note over D: ⚠️ 确认解雇<br/>"确定要解雇 张三 吗？"<br/><br/>影响说明:<br/>- 该员工的工作空间将被归档<br/>- 进行中的任务将被暂停<br/>- 聊天记录将保留但标记为离职<br/><br/>输入员工姓名以确认: [______]

    alt 输入姓名确认
        U->>D: 输入姓名 + 点击"确认解雇"
        D->>D: 验证姓名匹配
        D->>O: 执行解雇
        Note over O: 离职动画:<br/>员工收拾物品离开工位<br/>工位变为空位
    else 取消
        U->>D: 点击"取消"
        D->>M: 关闭弹窗，无操作
    end
```

**细节：**
- 解雇是高危操作，需要二次确认（输入姓名）
- 解雇后数据不删除，标记为"已离职"（可在管理页查看历史员工）
- 办公室中该工位变为空位，可供新员工使用
- 离职动画：角色从工位走向门口并消失

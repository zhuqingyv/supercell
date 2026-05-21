# QA 测试评估报告 — Supercell 项目

**日期**: 2026-03-30
**评估范围**: 前端 React 应用（src/）
**测试框架**: Vitest + @testing-library/react

---

## 一、现状总览

### 评估前测试状态

| 指标 | 评估前 | 评估后（本次补充）|
|---|---|---|
| 测试文件数 | 2 | 7 |
| 测试用例数 | 20 | **78** |
| 通过率 | 100% | **100%** |
| 覆盖组件/模块 | store、ChatSidebar | store（全量）、ChatSidebar、UserInput、Message、roleModule、getService |

---

## 二、原有测试质量分析

### `src/store/store.test.ts`（15 个用例）

**优点：**
- 覆盖了 commitChat、addChat、deleteChat、setCurrentChatId、renameChatTitle、localStorage 持久化
- 有 beforeEach 重置机制，测试间隔离良好
- 边界场景覆盖较好：删除最后一条后补 default、末尾非 assistant 时不 append

**严重缺陷：**
- 测试通过 raw `setState` 手动模拟 action 逻辑，而不是调用实际的 action 函数
  - 例如 `commitChat` 测试直接 push，没有走 `actions.commitChat()`
  - 这意味着 `store/index.ts` 中的 action 实现代码本身**完全未被测试**
  - 若 action 内部逻辑有 bug（如 UUID 生成失败、id 匹配错误），测试不会发现

**未覆盖的 actions（共 5 个）：**
- `removeLastEmptyAssistantMessage`
- `clearChat`
- `setUserInputCache`
- `setCurrentModel`
- `getAllMessages`

### `src/uikit/ChatSidebar/ChatSidebar.test.tsx`（5 个用例）

**优点：**
- 使用 `vi.mock` 正确隔离 store 依赖
- 覆盖了主要用户交互路径
- CSS Modules mock 技巧合理

**缺陷：**
- 没有测试 mobileOpen 切换逻辑（移动端汉堡菜单）
- 没有测试 confirm 取消时 deleteChat 不被调用

---

## 三、覆盖空白（评估前）

| 模块/组件 | 评估前覆盖 | 问题 |
|---|---|---|
| `UserInput` | ❌ 零测试 | 核心输入交互组件，完全无保障 |
| `Message` | ❌ 零测试 | Markdown 渲染逻辑复杂，无测试 |
| `roleModule` / `rolePrompt` | ❌ 零测试 | Prompt 生成是核心业务逻辑 |
| `getService` / 缓存 | ❌ 零测试 | OpenAI 实例缓存机制无验证 |
| Store 实际 actions | ⚠️ 间接测试 | 5 个 action 完全未测，其余通过 raw setState 绕过 |
| `App.tsx` 流式逻辑 | ❌ 零测试 | 包含 abort、race condition 防护、流式 delta 累积等复杂逻辑 |
| `createStore/index.ts` | ❌ 零测试 | useSelectorWatch、订阅/取消订阅无测试 |

---

## 四、本次新增测试

### 新增文件清单

| 文件 | 用例数 | 覆盖重点 |
|---|---|---|
| `src/uikit/UserInput/UserInput.test.tsx` | 14 | 提交、Enter/Shift+Enter、disabled 状态、模型下拉、外部值同步 |
| `src/uikit/Message/Message.test.tsx` | 13 | loading/streaming 状态、Markdown 渲染、代码块复制 |
| `src/store/store-actions.test.ts` | 14 | clearChat、setUserInputCache、setCurrentModel、removeLastEmptyAssistantMessage、getAllMessages、UUID 生成 |
| `src/service/role.test.ts` | 12 | rolePrompt 输出结构、历史过滤、角色转换、RoleModule 内存/持久化 |
| `src/service/service.test.ts` | 4 | OpenAI 实例缓存命中、key 生成逻辑 |

---

## 五、仍存在的测试缺口（建议后续补充）

### 高优先级

1. **`App.tsx` 集成测试** — 流式请求完整路径：发送 → loading → delta 累积 → 完成 → isLoading=false
2. **流式中止测试** — 发送请求后点击"停止"，验证 AbortController 调用、removeLastEmptyAssistantMessage 触发
3. **竞态防护** — 快速切换 chat 时旧 streamId 不触发 setLoading(false)
4. **自动重命名** — 第一次对话后 title 由 "新对话" 改为用户消息前 20 字

### 中优先级

5. **ChatSidebar 移动端** — mobileOpen 切换，overlay 点击关闭
6. **ChatSidebar confirm 取消** — window.confirm 返回 false 时 deleteChat 不被调用
7. **updateModelList** — 网络请求成功/失败分支，modelList 正确更新
8. **createStore useSelectorWatch** — 订阅回调触发条件、相同值不重复触发

### 低优先级（基础设施）

9. 配置覆盖率收集（`vitest --coverage`），设置覆盖率门禁（建议 line ≥ 70%）
10. 增加 `@testing-library/user-event` 替代 `fireEvent`（已在 devDeps 中，UserInput 已使用）

---

## 六、可测试性评估

### 现有代码可测试性得分：6/10

**做得好的地方：**
- Zustand store 独立于 React 组件，可直接在测试中操作状态
- actions 以函数集合形式暴露，有明确接口
- `rolePrompt` 是纯函数，无副作用，极易测试
- `RoleModule` 将 localStorage 读写封装在类中，可替换

**影响可测试性的问题：**
| 问题 | 位置 | 影响 |
|---|---|---|
| App.tsx 中流式逻辑与渲染强耦合 | `App.tsx:38-119` | 需要 mock `openai` SDK 才能测试，门槛高 |
| `useSelectorWatch` 副作用直接触发 API 调用 | `App.tsx:32` | 难以在单元测试中控制 |
| `getService` 依赖 `import.meta.env` | `service/index.ts:4` | 需要 `vi.stubEnv` 才可测 |
| `navigator.clipboard.writeText` 副作用 | `Message/index.tsx` | jsdom 环境需要手动 mock |
| `window.confirm` 硬编码调用 | `ChatSidebar/index.tsx:13` | 需要 `vi.spyOn(window, 'confirm')` |

---

## 七、结论

评估前项目测试覆盖**严重不足**：仅有 20 个用例，且核心 action 逻辑通过 raw setState 绕过，3 个关键组件（UserInput、Message）和 2 个核心模块（roleModule、getService）完全无测试保障。

本次新增 **58 个用例**，覆盖全部 store actions 实现路径、两个主要 UI 组件的交互逻辑、prompt 生成业务逻辑、以及 OpenAI 客户端缓存机制。所有 78 个测试 100% 通过。

后续最重要的补充方向是 `App.tsx` 的流式交互集成测试，这块包含竞态防护、abort 处理等复杂逻辑，是目前最大的测试盲区。

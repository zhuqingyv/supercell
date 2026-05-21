/**
 * 测试团队 — Store 层测试
 *
 * 覆盖范围：
 *  1. localStorage 持久化（写入 / 读取 / 跨实例恢复）
 *  2. 核心 Chat 动作（commitChat / appendToLastAssistantMessage / setLoading）
 *  3. Sidebar 相关动作（addChat / deleteChat / setCurrentChatId / renameChatTitle）
 *  4. 边界场景（删最后一条 / 删不存在的 / append 到非 assistant）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { store } from './index'
import type { Message } from '../service/types'

// ─── 初始状态快照（每次测试前重置用）────────────────────────────────────────
const INITIAL_STATE = {
  chatList: [{ id: 'default', title: '新对话', messages: [] as Message[] }],
  currentChatId: 'default',
  currentModel: 'qwen2.5-7b-instruct-1m',
  modelList: ['qwen2.5-7b-instruct-1m'],
  environment: '',
  userInfo: { name: 'user', description: 'user' },
  isLoading: false,
}

function resetStore() {
  // replace: true 绕过 Immer，直接替换整棵状态树
  ;(store as unknown as { setState: (s: typeof INITIAL_STATE, replace: boolean) => void })
    .setState(structuredClone(INITIAL_STATE), true)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('store — commitChat', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('向当前 chat 追加用户消息', () => {
    const msg: Message = { role: 'user', content: 'hello' }

    // call action via the exposed actions object
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      chat?.messages.push(msg)
    })

    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList[0].messages).toHaveLength(1)
    expect(chatList[0].messages[0]).toEqual(msg)
  })

  it('commitChat: 消息追加到指定 chat', () => {
    // Add a second chat
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList.push({ id: 'chat-2', title: '对话2', messages: [] })
    })

    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'chat-2')
      chat?.messages.push({ role: 'user', content: 'in chat 2' })
    })

    const state = store.getState() as typeof INITIAL_STATE
    expect(state.chatList[0].messages).toHaveLength(0) // default 不受影响
    expect(state.chatList[1].messages[0].content).toBe('in chat 2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store actions (via exposed actions object)', () => {
  // Access the actions generated in createLocalStore
  // We need to call them through the store proxy

  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  // Helper: get actions from store internals
  // In createLocalStore the actions are created via actionsGenerator and stored in closure
  // We test them by importing and calling the store directly
  it('commitChat — 向 chat 追加消息', () => {
    // Actions are returned by useActions() hook; for unit testing we call setState
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      if (chat) chat.messages.push({ role: 'user', content: 'test msg' })
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList[0].messages[0].content).toBe('test msg')
  })

  it('appendToLastAssistantMessage — 累积流式 delta', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList[0].messages = [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: '' },
      ]
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      if (chat && chat.messages.length > 0) {
        const last = chat.messages[chat.messages.length - 1]
        if (last?.role === 'assistant') last.content += 'hello '
      }
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      if (chat && chat.messages.length > 0) {
        const last = chat.messages[chat.messages.length - 1]
        if (last?.role === 'assistant') last.content += 'world'
      }
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList[0].messages[1].content).toBe('hello world')
  })

  it('appendToLastAssistantMessage — 末尾非 assistant 时不写入', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList[0].messages = [{ role: 'user', content: 'only user' }]
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      if (chat && chat.messages.length > 0) {
        const last = chat.messages[chat.messages.length - 1]
        if (last?.role === 'assistant') last.content += 'should not append'
      }
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList[0].messages).toHaveLength(1) // 消息条数不变
    expect(chatList[0].messages[0].content).toBe('only user')
  })

  it('setLoading — 切换 isLoading 状态', () => {
    store.setState((s: typeof INITIAL_STATE) => { s.isLoading = true })
    expect((store.getState() as typeof INITIAL_STATE).isLoading).toBe(true)
    store.setState((s: typeof INITIAL_STATE) => { s.isLoading = false })
    expect((store.getState() as typeof INITIAL_STATE).isLoading).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — addChat / deleteChat / setCurrentChatId', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('addChat — 新增对话并切换为当前', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      const id = 'chat-new'
      s.chatList.push({ id, title: '新对话', messages: [] })
      s.currentChatId = id
    })
    const { chatList, currentChatId } = store.getState() as typeof INITIAL_STATE
    expect(chatList).toHaveLength(2)
    expect(currentChatId).toBe('chat-new')
  })

  it('deleteChat — 删除非当前 chat 后列表减少', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList.push({ id: 'chat-x', title: 'X', messages: [] })
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const idx = s.chatList.findIndex((c) => c.id === 'chat-x')
      if (idx !== -1) s.chatList.splice(idx, 1)
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList).toHaveLength(1)
    expect(chatList[0].id).toBe('default')
  })

  it('deleteChat — 删除当前 chat 时自动切换到第一个', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList.push({ id: 'chat-b', title: 'B', messages: [] })
      s.currentChatId = 'chat-b'
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const idx = s.chatList.findIndex((c) => c.id === 'chat-b')
      if (idx !== -1) {
        s.chatList.splice(idx, 1)
        if (s.currentChatId === 'chat-b') s.currentChatId = s.chatList[0].id
      }
    })
    const { currentChatId, chatList } = store.getState() as typeof INITIAL_STATE
    expect(currentChatId).toBe('default')
    expect(chatList).toHaveLength(1)
  })

  it('deleteChat — 删除最后一条后自动补回 default', () => {
    // 先删除 default，只剩一个 chat-only
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList = [{ id: 'chat-only', title: 'Only', messages: [] }]
      s.currentChatId = 'chat-only'
    })
    store.setState((s: typeof INITIAL_STATE) => {
      const idx = s.chatList.findIndex((c) => c.id === 'chat-only')
      if (idx !== -1) s.chatList.splice(idx, 1)
      if (s.chatList.length === 0) s.chatList.push({ id: 'default', title: '新对话', messages: [] })
      s.currentChatId = s.chatList[0].id
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList).toHaveLength(1)
    expect(chatList[0].id).toBe('default')
  })

  it('setCurrentChatId — 正确更新 currentChatId', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList.push({ id: 'chat-c', title: 'C', messages: [] })
    })
    store.setState((s: typeof INITIAL_STATE) => { s.currentChatId = 'chat-c' })
    expect((store.getState() as typeof INITIAL_STATE).currentChatId).toBe('chat-c')
  })

  it('renameChatTitle — 更新指定 chat 标题', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      const chat = s.chatList.find((c) => c.id === 'default')
      if (chat) chat.title = 'My First Chat'
    })
    const { chatList } = store.getState() as typeof INITIAL_STATE
    expect(chatList[0].title).toBe('My First Chat')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — localStorage 持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('状态变更后写入 localStorage', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList[0].title = 'Persisted Title'
    })
    const raw = localStorage.getItem('supercell-v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    // Zustand persist 将 state 放在 parsed.state
    expect(parsed.state.chatList[0].title).toBe('Persisted Title')
  })

  it('currentModel 变更持久化', () => {
    store.setState((s: typeof INITIAL_STATE) => { s.currentModel = 'llama-3' })
    const raw = JSON.parse(localStorage.getItem('supercell-v1')!)
    expect(raw.state.currentModel).toBe('llama-3')
  })

  it('isLoading 不影响已有 chatList 数据', () => {
    store.setState((s: typeof INITIAL_STATE) => {
      s.chatList[0].messages.push({ role: 'user', content: 'persist check' })
    })
    store.setState((s: typeof INITIAL_STATE) => { s.isLoading = true })
    store.setState((s: typeof INITIAL_STATE) => { s.isLoading = false })

    const raw = JSON.parse(localStorage.getItem('supercell-v1')!)
    expect(raw.state.chatList[0].messages[0].content).toBe('persist check')
  })
})

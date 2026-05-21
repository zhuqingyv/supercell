/**
 * QA — 补充 Store Actions 测试
 *
 * 覆盖现有 store.test.ts 未覆盖的 action：
 *  1. clearChat — 清空指定 chat 的消息列表
 *  2. setUserInputCache — 写入/读取 userInputCache
 *  3. setCurrentModel — 切换 currentModel
 *  4. removeLastEmptyAssistantMessage — 仅删除末尾空 assistant 消息
 *  5. getAllMessages — 返回当前 chat 的消息数组
 *  6. commitChat — 自动生成 UUID id（message 无 id 时）
 *  7. deleteChat — 删除不存在的 id 不崩溃
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { store } from './index'
import type { Message } from '../service/types'

type StoreState = {
  chatList: Array<{ id: string; title: string; messages: Message[]; userInputCache?: string }>
  currentChatId: string
  currentModel: string
  modelList: string[]
  environment: string
  userInfo: { name: string; description: string }
  isLoading: boolean
}

const INITIAL_STATE: StoreState = {
  chatList: [{ id: 'default', title: '新对话', messages: [] }],
  currentChatId: 'default',
  currentModel: 'qwen2.5-7b-instruct-1m',
  modelList: ['qwen2.5-7b-instruct-1m'],
  environment: '',
  userInfo: { name: 'user', description: 'user' },
  isLoading: false,
}

function resetStore() {
  ;(store as unknown as { setState: (s: StoreState, replace: boolean) => void })
    .setState(structuredClone(INITIAL_STATE), true)
}

function getState() {
  return store.getState() as unknown as StoreState
}

// ─────────────────────────────────────────────────────────────────────────────

describe('store — clearChat', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('清空指定 chat 的消息列表', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'msg1' }, id: 'default' })
    actions.commitChat({ message: { role: 'assistant', content: 'reply1' }, id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(2)

    actions.clearChat({ id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(0)
  })

  it('clearChat 对不存在的 id 安全忽略', () => {
    const actions = store.useActions()
    expect(() => actions.clearChat({ id: 'nonexistent' })).not.toThrow()
    expect(getState().chatList).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — deleteChat edge cases', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('deleteChat 对不存在的 id 安全忽略', () => {
    const actions = store.useActions()
    expect(() => actions.deleteChat({ id: 'nonexistent' })).not.toThrow()
    expect(getState().chatList).toHaveLength(1)
    expect(getState().currentChatId).toBe('default')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — setUserInputCache', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('写入 userInputCache', () => {
    const actions = store.useActions()
    actions.setUserInputCache({ id: 'default', cache: 'draft text' })
    expect(getState().chatList[0].userInputCache).toBe('draft text')
  })

  it('覆盖写入 userInputCache', () => {
    const actions = store.useActions()
    actions.setUserInputCache({ id: 'default', cache: 'v1' })
    actions.setUserInputCache({ id: 'default', cache: 'v2' })
    expect(getState().chatList[0].userInputCache).toBe('v2')
  })

  it('清空 userInputCache（空字符串）', () => {
    const actions = store.useActions()
    actions.setUserInputCache({ id: 'default', cache: 'something' })
    actions.setUserInputCache({ id: 'default', cache: '' })
    expect(getState().chatList[0].userInputCache).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — setCurrentModel', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('切换 currentModel', () => {
    const actions = store.useActions()
    actions.setCurrentModel({ model: 'llama-3-70b' })
    expect(getState().currentModel).toBe('llama-3-70b')
  })

  it('setCurrentModel 持久化到 localStorage', () => {
    const actions = store.useActions()
    actions.setCurrentModel({ model: 'gemma-2' })
    const raw = JSON.parse(localStorage.getItem('supercell-v1')!)
    expect(raw.state.currentModel).toBe('gemma-2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — removeLastEmptyAssistantMessage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('末尾 assistant 消息为空时删除', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'q' }, id: 'default' })
    actions.commitChat({ message: { role: 'assistant', content: '' }, id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(2)

    actions.removeLastEmptyAssistantMessage({ id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(1)
    expect(getState().chatList[0].messages[0].role).toBe('user')
  })

  it('末尾 assistant 消息有内容时不删除', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'assistant', content: 'non-empty' }, id: 'default' })
    actions.removeLastEmptyAssistantMessage({ id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(1)
  })

  it('末尾是 user 消息时不删除任何内容', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'hi' }, id: 'default' })
    actions.removeLastEmptyAssistantMessage({ id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — removeAssistantMessageById', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('仅删除指定 id 的空 assistant 消息', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { id: 'u1', role: 'user', content: 'q1' }, id: 'default' })
    actions.commitChat({ message: { id: 'a-old', role: 'assistant', content: '' }, id: 'default' })
    actions.commitChat({ message: { id: 'u2', role: 'user', content: 'q2' }, id: 'default' })
    actions.commitChat({ message: { id: 'a-new', role: 'assistant', content: '' }, id: 'default' })

    actions.removeAssistantMessageById({ id: 'default', messageId: 'a-old' })

    const ids = getState().chatList[0].messages.map((m) => m.id)
    expect(ids).toEqual(['u1', 'u2', 'a-new'])
  })

  it('目标消息非空时不删除', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { id: 'a1', role: 'assistant', content: 'partial' }, id: 'default' })

    actions.removeAssistantMessageById({ id: 'default', messageId: 'a1' })

    expect(getState().chatList[0].messages).toHaveLength(1)
    expect(getState().chatList[0].messages[0].content).toBe('partial')
  })

  it('不存在的 id 安全忽略', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { id: 'a1', role: 'assistant', content: '' }, id: 'default' })

    expect(() => actions.removeAssistantMessageById({ id: 'default', messageId: 'missing' })).not.toThrow()
    expect(getState().chatList[0].messages).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — getAllMessages', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('空 chat 返回空数组', () => {
    const actions = store.useActions()
    expect(actions.getAllMessages()).toEqual([])
  })

  it('返回当前 chat 的消息列表', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'hello' }, id: 'default' })
    actions.commitChat({ message: { role: 'assistant', content: 'world' }, id: 'default' })
    const msgs = actions.getAllMessages()
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toBe('hello')
    expect(msgs[1].content).toBe('world')
  })

  it('切换 currentChatId 后 getAllMessages 返回对应 chat 的消息', () => {
    const actions = store.useActions()
    actions.addChat()
    const newId = getState().currentChatId
    actions.commitChat({ message: { role: 'user', content: 'in new chat' }, id: newId })

    // 当前 chat 是 newId，getAllMessages 应返回该 chat 的消息
    expect(actions.getAllMessages()[0].content).toBe('in new chat')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — commitChat id 生成', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('无 id 的 message 提交后自动生成 UUID', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'auto id' }, id: 'default' })
    const msg = getState().chatList[0].messages[0]
    expect(msg.id).toBeDefined()
    expect(typeof msg.id).toBe('string')
    expect(msg.id!.length).toBeGreaterThan(0)
  })

  it('有 id 的 message 提交后保留原 id', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { id: 'my-id', role: 'user', content: 'with id' }, id: 'default' })
    expect(getState().chatList[0].messages[0].id).toBe('my-id')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — updateModelList', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
    vi.stubEnv('VITE_OPENAI_BASE_URL', 'http://localhost:11434/v1')
    vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('成功获取模型列表并更新 modelList', async () => {
    const mockModels = { data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-c' }] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    } as Response)

    const actions = store.useActions()
    await actions.updateModelList()

    expect(getState().modelList).toEqual(['model-a', 'model-b', 'model-c'])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('fetch 返回非 ok 时不更新 modelList', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const actions = store.useActions()
    await actions.updateModelList()

    // modelList 保持初始值
    expect(getState().modelList).toEqual(['qwen2.5-7b-instruct-1m'])
    expect(console.warn).toHaveBeenCalled()
  })

  it('fetch 抛出网络错误时不崩溃，modelList 不变', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const actions = store.useActions()
    await actions.updateModelList()

    expect(getState().modelList).toEqual(['qwen2.5-7b-instruct-1m'])
    expect(console.warn).toHaveBeenCalledWith('Failed to fetch model list:', expect.any(Error))
  })

  it('过滤空模型 id 与重复值，并在当前模型失效时回退到首个可用模型', async () => {
    const mockModels = {
      data: [{ id: ' model-a ' }, { id: 'model-a' }, { id: '' }, {}, { id: 'model-b' }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockModels,
    } as Response)

    const actions = store.useActions()
    actions.setCurrentModel({ model: 'non-existent-model' })
    await actions.updateModelList()

    expect(getState().modelList).toEqual(['model-a', 'model-b'])
    expect(getState().currentModel).toBe('model-a')
  })

  it('请求超时时中止 fetch 并保持现有 modelList', async () => {
    vi.useFakeTimers()
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise((_, reject) => {
        if (!signal) return
        signal.addEventListener('abort', () => reject(abortError), { once: true })
      }) as Promise<Response>
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const actions = store.useActions()
    const pending = actions.updateModelList()
    await vi.advanceTimersByTimeAsync(10_001)
    await pending

    expect(getState().modelList).toEqual(['qwen2.5-7b-instruct-1m'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('request timed out after'))
    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — addChat edge cases', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('addChat 生成的 ID 以 "chat-" 前缀开头', () => {
    const actions = store.useActions()
    actions.addChat()
    const state = getState()
    const newChat = state.chatList.find((c) => c.id !== 'default')
    expect(newChat).toBeDefined()
    expect(newChat!.id).toMatch(/^chat-.+$/)
  })

  it('addChat 后 currentChatId 切换到新建的 chat', () => {
    const actions = store.useActions()
    actions.addChat()
    const state = getState()
    expect(state.currentChatId).not.toBe('default')
    expect(state.chatList.some((c) => c.id === state.currentChatId)).toBe(true)
  })

  it('新建 chat 的 messages 初始为空数组', () => {
    const actions = store.useActions()
    actions.addChat()
    const state = getState()
    const newChat = state.chatList.find((c) => c.id === state.currentChatId)
    expect(newChat!.messages).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — appendToLastAssistantMessage via actions', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('通过 actions.appendToLastAssistantMessage 累积内容', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'hi' }, id: 'default' })
    actions.commitChat({ message: { role: 'assistant', content: '' }, id: 'default' })
    actions.appendToLastAssistantMessage({ id: 'default', content: 'Hello' })
    actions.appendToLastAssistantMessage({ id: 'default', content: ' World' })
    expect(getState().chatList[0].messages[1].content).toBe('Hello World')
  })

  it('对不存在的 chat id 调用不崩溃', () => {
    const actions = store.useActions()
    expect(() => actions.appendToLastAssistantMessage({ id: 'nonexistent', content: 'test' })).not.toThrow()
  })

  it('空 messages 数组时调用不崩溃', () => {
    const actions = store.useActions()
    expect(() => actions.appendToLastAssistantMessage({ id: 'default', content: 'test' })).not.toThrow()
    expect(getState().chatList[0].messages).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — renameChatTitle via actions', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('重命名后持久化到 localStorage', () => {
    const actions = store.useActions()
    actions.renameChatTitle({ id: 'default', title: 'Renamed Chat' })
    const raw = JSON.parse(localStorage.getItem('supercell-v1')!)
    expect(raw.state.chatList[0].title).toBe('Renamed Chat')
  })

  it('对不存在的 id 安全忽略', () => {
    const actions = store.useActions()
    expect(() => actions.renameChatTitle({ id: 'nonexistent', title: 'X' })).not.toThrow()
    expect(getState().chatList[0].title).toBe('新对话')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — setLoading via actions', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('setLoading(true) 将 isLoading 设为 true', () => {
    const actions = store.useActions()
    actions.setLoading(true)
    expect(getState().isLoading).toBe(true)
  })

  it('setLoading(false) 将 isLoading 设为 false', () => {
    const actions = store.useActions()
    actions.setLoading(true)
    actions.setLoading(false)
    expect(getState().isLoading).toBe(false)
  })

  it('setLoading 不影响其他状态', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'keep this' }, id: 'default' })
    actions.setLoading(true)
    expect(getState().chatList[0].messages[0].content).toBe('keep this')
    expect(getState().currentChatId).toBe('default')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — addChat + deleteChat 组合场景', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('连续 addChat 3 次，chatList 增加到 4 条', () => {
    const actions = store.useActions()
    actions.addChat()
    actions.addChat()
    actions.addChat()
    expect(getState().chatList).toHaveLength(4)
  })

  it('addChat 后 deleteChat 所有新建 chat，剩余 default', () => {
    const actions = store.useActions()
    actions.addChat()
    actions.addChat()
    const ids = getState().chatList.filter((c) => c.id !== 'default').map((c) => c.id)
    ids.forEach((id) => actions.deleteChat({ id }))
    expect(getState().chatList).toHaveLength(1)
    expect(getState().chatList[0].id).toBe('default')
  })

  it('addChat 后在新 chat 中 commitChat，deleteChat 后消息随之删除', () => {
    const actions = store.useActions()
    actions.addChat()
    const newId = getState().currentChatId
    actions.commitChat({ message: { role: 'user', content: 'temp msg' }, id: newId })
    expect(getState().chatList.find((c) => c.id === newId)?.messages).toHaveLength(1)

    actions.deleteChat({ id: newId })
    expect(getState().chatList.find((c) => c.id === newId)).toBeUndefined()
  })

  it('deleteChat default 后再 addChat 恢复正常', () => {
    const actions = store.useActions()
    actions.deleteChat({ id: 'default' })
    // deleteChat 会自动补回 default
    expect(getState().chatList).toHaveLength(1)
    actions.addChat()
    expect(getState().chatList).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('store — clearChat + commitChat 组合', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  it('clearChat 后 commitChat 重新添加消息', () => {
    const actions = store.useActions()
    actions.commitChat({ message: { role: 'user', content: 'old msg' }, id: 'default' })
    actions.clearChat({ id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(0)

    actions.commitChat({ message: { role: 'user', content: 'new msg' }, id: 'default' })
    expect(getState().chatList[0].messages).toHaveLength(1)
    expect(getState().chatList[0].messages[0].content).toBe('new msg')
  })

  it('clearChat 不影响其他 chat 的消息', () => {
    const actions = store.useActions()
    actions.addChat()
    const newId = getState().currentChatId
    actions.commitChat({ message: { role: 'user', content: 'msg in new' }, id: newId })
    actions.commitChat({ message: { role: 'user', content: 'msg in default' }, id: 'default' })

    actions.clearChat({ id: 'default' })
    expect(getState().chatList.find((c) => c.id === 'default')?.messages).toHaveLength(0)
    expect(getState().chatList.find((c) => c.id === newId)?.messages).toHaveLength(1)
  })
})

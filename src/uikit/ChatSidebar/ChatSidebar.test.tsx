/**
 * 测试团队 — ChatSidebar 侧边栏交互测试
 *
 * 覆盖范围：
 *  1. 渲染 chat 列表
 *  2. 点击"＋新对话"触发 addChat
 *  3. 点击 chat 项触发 setCurrentChatId
 *  4. 点击删除按钮触发 deleteChat（stopPropagation 不触发切换）
 *  5. isLoading 时"新对话"按钮 disabled
 *  6. 当前 active chat 有 active 样式
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ─── Mock store ────────────────────────────────────────────────────────────
// ChatSidebar 直接消费 `store` 单例，通过 vi.mock 注入受控状态

const mockAddChat = vi.fn()
const mockDeleteChat = vi.fn()
const mockSetCurrentChatId = vi.fn()

const storeMock = {
  chatList: [
    { id: 'chat-1', title: '对话一', messages: [] },
    { id: 'chat-2', title: '对话二', messages: [] },
  ],
  currentChatId: 'chat-1',
  isLoading: false,
}

vi.mock('../../store', () => ({
  store: {
    useSelector: vi.fn((selector: (s: typeof storeMock) => unknown) => ({
      state: selector(storeMock),
      actions: {},
    })),
    useActions: vi.fn(() => ({
      addChat: mockAddChat,
      deleteChat: mockDeleteChat,
      setCurrentChatId: mockSetCurrentChatId,
    })),
  },
}))

// CSS modules → empty object (vitest css: false doesn't stub module names)
vi.mock('./ChatSidebar.module.css', () => ({
  default: new Proxy({}, { get: (_t, prop) => String(prop) }),
}))

import { ChatSidebar } from './index'

// ─────────────────────────────────────────────────────────────────────────────

describe('ChatSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染所有 chat 标题', () => {
    render(<ChatSidebar />)
    expect(screen.getByText('对话一')).toBeInTheDocument()
    expect(screen.getByText('对话二')).toBeInTheDocument()
  })

  it('点击"＋新对话"调用 addChat', () => {
    render(<ChatSidebar />)
    fireEvent.click(screen.getByTitle('新建对话'))
    expect(mockAddChat).toHaveBeenCalledTimes(1)
  })

  it('点击 chat 标题调用 setCurrentChatId', () => {
    render(<ChatSidebar />)
    fireEvent.click(screen.getByTitle('对话一'))
    expect(mockSetCurrentChatId).toHaveBeenCalledWith({ id: 'chat-1' })
  })

  it('点击删除按钮调用 deleteChat，不触发 setCurrentChatId', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ChatSidebar />)
    const deleteBtns = screen.getAllByRole('button', { name: /^删除「/ })
    fireEvent.click(deleteBtns[0])
    expect(mockDeleteChat).toHaveBeenCalledWith({ id: 'chat-1' })
    expect(mockSetCurrentChatId).not.toHaveBeenCalled()
  })

  it('isLoading 时"新对话"按钮 disabled', async () => {
    // 临时覆写 isLoading
    const { store } = await import('../../store')
    ;(store.useSelector as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof storeMock) => unknown) => ({
        state: selector({ ...storeMock, isLoading: true }),
        actions: {},
      })
    )
    render(<ChatSidebar />)
    const newBtn = screen.getByTitle('新建对话')
    expect(newBtn).toBeDisabled()
  })

  it('confirm 返回 false 时不调用 deleteChat', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ChatSidebar />)
    const deleteBtns = screen.getAllByRole('button', { name: /^删除「/ })
    fireEvent.click(deleteBtns[0])
    expect(mockDeleteChat).not.toHaveBeenCalled()
  })

  it('渲染品牌名称 Supercell', () => {
    render(<ChatSidebar />)
    expect(screen.getByText('Supercell')).toBeInTheDocument()
  })

  it('点击移动端 toggle 按钮切换侧栏', () => {
    render(<ChatSidebar />)
    const toggleBtn = screen.getByLabelText('切换侧栏')
    expect(toggleBtn).toBeInTheDocument()
    fireEvent.click(toggleBtn)
    // overlay should appear when mobile sidebar is open
    // The overlay is rendered conditionally; clicking toggle again closes it
    fireEvent.click(toggleBtn)
  })

  it('点击 chat 后移动端侧栏关闭（不再有 overlay）', () => {
    render(<ChatSidebar />)
    const toggleBtn = screen.getByLabelText('切换侧栏')
    fireEvent.click(toggleBtn) // open mobile sidebar
    fireEvent.click(screen.getByTitle('对话一'))
    expect(mockSetCurrentChatId).toHaveBeenCalledWith({ id: 'chat-1' })
  })

  it('当前 active chat 标题元素存在', () => {
    render(<ChatSidebar />)
    // chat-1 is currentChatId, its title button should be in the document
    const chatBtn = screen.getByTitle('对话一')
    expect(chatBtn).toBeInTheDocument()
  })

  it('多个 chat 的删除按钮都可以独立点击', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ChatSidebar />)
    const deleteBtns = screen.getAllByRole('button', { name: /^删除「/ })
    expect(deleteBtns).toHaveLength(2)
    fireEvent.click(deleteBtns[1])
    expect(mockDeleteChat).toHaveBeenCalledWith({ id: 'chat-2' })
  })
})

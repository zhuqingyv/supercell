/**
 * QA — Message 组件测试
 *
 * 覆盖范围：
 *  1. 用户消息（direction=right）渲染文本内容
 *  2. AI 消息（direction=left）渲染文本内容
 *  3. isLoading=true 且内容为空时展示 loading 动画
 *  4. isStreaming=true 时展示流式光标
 *  5. Markdown 渲染：加粗、斜体、行内代码
 *  6. Markdown 渲染：代码块（lang + 内容）
 *  7. 代码块复制按钮存在
 *  8. AI 消息 hover 时复制消息按钮存在（aria-label）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Message } from './index'

// navigator.clipboard.writeText mock
const writeTextMock = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  writable: true,
})

describe('Message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染用户消息文本', () => {
    render(<Message direction="right" content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('渲染 AI 消息文本', () => {
    render(<Message direction="left" content="AI reply" />)
    expect(screen.getByText('AI reply')).toBeInTheDocument()
  })

  it('isLoading=true 且内容为空时展示 loading 状态', () => {
    render(<Message direction="left" content="" isLoading />)
    expect(screen.getByRole('status', { name: 'AI 正在思考' })).toBeInTheDocument()
  })

  it('isLoading=true 但有内容时不展示 loading 状态', () => {
    render(<Message direction="left" content="partial response" isLoading />)
    expect(screen.queryByRole('status', { name: 'AI 正在思考' })).not.toBeInTheDocument()
    expect(screen.getByText('partial response')).toBeInTheDocument()
  })

  it('isStreaming=true 时展示流式光标（aria-hidden span）', () => {
    const { container } = render(
      <Message direction="left" content="streaming..." isStreaming />
    )
    // Cursor is an aria-hidden inline span with animate-pulse
    const cursor = container.querySelector('.animate-pulse')
    expect(cursor).toBeInTheDocument()
  })

  it('Markdown 加粗文本渲染为 <strong>', () => {
    render(<Message direction="left" content="**bold text**" />)
    expect(screen.getByText('bold text').tagName).toBe('STRONG')
  })

  it('Markdown 行内代码渲染为 <code>', () => {
    render(<Message direction="left" content="`inline code`" />)
    expect(screen.getByText('inline code').tagName).toBe('CODE')
  })

  it('代码块展示语言标识和代码内容', () => {
    render(<Message direction="left" content={"```python\nprint('hi')\n```"} />)
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText("print('hi')")).toBeInTheDocument()
  })

  it('代码块复制按钮存在', () => {
    render(<Message direction="left" content={"```js\nconsole.log(1)\n```"} />)
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument()
  })

  it('代码块复制按钮点击后调用 clipboard.writeText', async () => {
    render(<Message direction="left" content={"```js\nconsole.log(1)\n```"} />)
    fireEvent.click(screen.getByRole('button', { name: '复制代码' }))
    expect(writeTextMock).toHaveBeenCalledWith("console.log(1)\n")
  })

  it('AI 完整消息有"复制消息"按钮', () => {
    render(<Message direction="left" content="full response" />)
    expect(screen.getByRole('button', { name: '复制消息' })).toBeInTheDocument()
  })

  it('用户消息没有"复制消息"按钮', () => {
    render(<Message direction="right" content="user msg" />)
    expect(screen.queryByRole('button', { name: '复制消息' })).not.toBeInTheDocument()
  })

  it('AI 消息正在流式传输时没有"复制消息"按钮', () => {
    render(<Message direction="left" content="partial..." isStreaming />)
    expect(screen.queryByRole('button', { name: '复制消息' })).not.toBeInTheDocument()
  })

  it('Markdown 斜体文本渲染为 <em>', () => {
    render(<Message direction="left" content="*italic text*" />)
    expect(screen.getByText('italic text').tagName).toBe('EM')
  })

  it('Markdown 删除线文本渲染为 <del>', () => {
    render(<Message direction="left" content="~~deleted~~" />)
    expect(screen.getByText('deleted').tagName).toBe('DEL')
  })

  it('无序列表渲染为 <ul>', () => {
    const { container } = render(<Message direction="left" content={"- item one\n- item two"} />)
    const ul = container.querySelector('ul')
    expect(ul).toBeInTheDocument()
    expect(ul?.querySelectorAll('li')).toHaveLength(2)
  })

  it('有序列表渲染为 <ol>', () => {
    const { container } = render(<Message direction="left" content={"1. first\n2. second"} />)
    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()
    expect(ol?.querySelectorAll('li')).toHaveLength(2)
  })

  it('标题渲染', () => {
    render(<Message direction="left" content="## Heading Two" />)
    expect(screen.getByText('Heading Two')).toBeInTheDocument()
  })

  it('引用块渲染为 <blockquote>', () => {
    const { container } = render(<Message direction="left" content="> quoted text" />)
    const bq = container.querySelector('blockquote')
    expect(bq).toBeInTheDocument()
  })

  it('分隔线渲染为 <hr>', () => {
    const { container } = render(<Message direction="left" content="---" />)
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  it('空内容非 loading 时正常渲染无崩溃', () => {
    const { container } = render(<Message direction="left" content="" />)
    expect(container).toBeInTheDocument()
  })

  it('多个代码块正确分割渲染', () => {
    const content = "```js\na()\n```\nsome text\n```python\nb()\n```"
    render(<Message direction="left" content={content} />)
    expect(screen.getByText('js')).toBeInTheDocument()
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText('a()')).toBeInTheDocument()
    expect(screen.getByText('b()')).toBeInTheDocument()
  })

  it('无语言标识的代码块显示 "code" 作为默认标签', () => {
    render(<Message direction="left" content={"```\nplain code\n```"} />)
    expect(screen.getByText('code')).toBeInTheDocument()
    expect(screen.getByText('plain code')).toBeInTheDocument()
  })

  it('超长单行内容正常渲染不崩溃', () => {
    const longContent = 'x'.repeat(5000)
    const { container } = render(<Message direction="left" content={longContent} />)
    expect(container).toBeInTheDocument()
  })

  it('用户头像显示"我"', () => {
    render(<Message direction="right" content="user msg" />)
    expect(screen.getByText('我')).toBeInTheDocument()
  })

  it('AI 消息有 SparkIcon 头像（aria-hidden svg）', () => {
    const { container } = render(<Message direction="left" content="ai msg" />)
    const hiddenDivs = container.querySelectorAll('[aria-hidden]')
    expect(hiddenDivs.length).toBeGreaterThan(0)
  })

  it('loading 状态有 3 个 bounce 动画点', () => {
    const { container } = render(<Message direction="left" content="" isLoading />)
    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots).toHaveLength(3)
  })

  it('纯文本无 Markdown 标记正常渲染', () => {
    render(<Message direction="left" content="just plain text with no formatting" />)
    expect(screen.getByText('just plain text with no formatting')).toBeInTheDocument()
  })

  it('混合 Markdown 内容（加粗 + 行内代码 + 普通文本）', () => {
    render(<Message direction="left" content="Use **bold** and `code` together" />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('code').tagName).toBe('CODE')
  })
})

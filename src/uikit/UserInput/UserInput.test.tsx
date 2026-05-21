/**
 * QA — UserInput 组件测试
 *
 * 覆盖范围：
 *  1. 基础渲染（textarea、发送按钮、模型选择器）
 *  2. 输入内容后"发送"按钮可用
 *  3. 按 Enter 提交内容，按 Shift+Enter 换行
 *  4. 空输入不触发 onCommit
 *  5. disabled=true 时展示"停止"按钮而非"发送"按钮
 *  6. disabled=true 时 Enter 键不触发 onCommit
 *  7. 点击"停止"按钮调用 onStop
 *  8. 模型下拉选择器打开/关闭/选择
 *  9. currentModel 不在 modelList 时自动加入列表头部
 * 10. 外部 value prop 变化时 textarea 同步更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserInput } from './index'

const DEFAULT_PROPS = {
  modelList: ['model-a', 'model-b'],
  currentModel: 'model-a',
  value: '',
  onCommit: vi.fn(),
}

describe('UserInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染 textarea 和发送按钮', () => {
    render(<UserInput {...DEFAULT_PROPS} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  })

  it('空内容时发送按钮 disabled', () => {
    render(<UserInput {...DEFAULT_PROPS} value="" />)
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
  })

  it('输入内容后发送按钮可点击', async () => {
    render(<UserInput {...DEFAULT_PROPS} />)
    await userEvent.type(screen.getByRole('textbox'), 'hello')
    expect(screen.getByRole('button', { name: '发送' })).not.toBeDisabled()
  })

  it('点击发送按钮调用 onCommit 并清空输入', async () => {
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'test message')
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(onCommit).toHaveBeenCalledWith('test message')
    expect(textarea).toHaveValue('')
  })

  it('Enter 键提交，清空内容', async () => {
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'enter test')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommit).toHaveBeenCalledWith('enter test')
  })

  it('Shift+Enter 不提交', async () => {
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'line one')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('纯空格内容不触发 onCommit', async () => {
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, '   ')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('disabled=true 时展示停止按钮', () => {
    render(<UserInput {...DEFAULT_PROPS} disabled onStop={vi.fn()} />)
    expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()
  })

  it('disabled=true 时 Enter 不触发 onCommit', async () => {
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} disabled />)
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('点击停止按钮调用 onStop', () => {
    const onStop = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} disabled onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('点击模型选择器打开下拉列表', () => {
    render(<UserInput {...DEFAULT_PROPS} onModelChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择模型' }))
    expect(screen.getByRole('listbox', { name: '模型列表' })).toBeInTheDocument()
  })

  it('从下拉列表选择模型并回调 onModelChange', () => {
    const onModelChange = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onModelChange={onModelChange} />)
    fireEvent.click(screen.getByRole('button', { name: '选择模型' }))
    fireEvent.click(screen.getByRole('option', { name: /model-b/ }))
    expect(onModelChange).toHaveBeenCalledWith('model-b')
    // 选完后下拉应关闭
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('currentModel 不在 modelList 时自动添加到列表', () => {
    render(
      <UserInput
        {...DEFAULT_PROPS}
        currentModel="custom-model"
        onModelChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '选择模型' }))
    expect(screen.getByRole('option', { name: /custom-model/ })).toBeInTheDocument()
  })

  it('外部 value 变化时 textarea 同步', () => {
    const { rerender } = render(<UserInput {...DEFAULT_PROPS} value="initial" />)
    expect(screen.getByRole('textbox')).toHaveValue('initial')
    rerender(<UserInput {...DEFAULT_PROPS} value="updated" />)
    expect(screen.getByRole('textbox')).toHaveValue('updated')
  })

  it('onChange 回调在输入时触发', async () => {
    const onChange = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('提交后 onChange 收到空字符串', async () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'msg')
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('modelList 为空时不渲染模型选择器', () => {
    render(<UserInput {...DEFAULT_PROPS} modelList={[]} />)
    expect(screen.queryByRole('button', { name: '选择模型' })).not.toBeInTheDocument()
  })

  it('无 onModelChange 时模型以纯文本展示', () => {
    render(<UserInput {...DEFAULT_PROPS} />)
    expect(screen.queryByRole('button', { name: '选择模型' })).not.toBeInTheDocument()
    expect(screen.getByText('model-a')).toBeInTheDocument()
  })

  it('disabled 时 textarea 有降低透明度样式', () => {
    render(<UserInput {...DEFAULT_PROPS} disabled />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.style.opacity).toBe('0.5')
  })

  it('非 disabled 时 textarea 透明度为 1', () => {
    render(<UserInput {...DEFAULT_PROPS} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.style.opacity).toBe('1')
  })

  it('disabled 时 textarea 有 placeholder "AI 正在回复..."', () => {
    render(<UserInput {...DEFAULT_PROPS} disabled />)
    expect(screen.getByPlaceholderText('AI 正在回复...')).toBeInTheDocument()
  })

  it('非 disabled 时 textarea 有正常 placeholder', () => {
    render(<UserInput {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText('输入消息，Enter 发送，Shift+Enter 换行')).toBeInTheDocument()
  })

  it('disabled 时点击发送（如果存在）不调用 onCommit', async () => {
    const onCommit = vi.fn()
    // When disabled, there's a stop button instead of send, so onCommit should never fire
    render(<UserInput {...DEFAULT_PROPS} onCommit={onCommit} disabled onStop={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('点击模型选择器外部区域关闭下拉', async () => {
    const onModelChange = vi.fn()
    render(<UserInput {...DEFAULT_PROPS} onModelChange={onModelChange} />)
    fireEvent.click(screen.getByRole('button', { name: '选择模型' }))
    expect(screen.getByRole('listbox', { name: '模型列表' })).toBeInTheDocument()
    // click outside (document body)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('模型选择器按钮显示 aria-expanded 状态', () => {
    render(<UserInput {...DEFAULT_PROPS} onModelChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: '选择模型' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('当前模型在下拉中标记"当前"', () => {
    render(<UserInput {...DEFAULT_PROPS} onModelChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择模型' }))
    expect(screen.getByText('当前')).toBeInTheDocument()
  })

  it('超长模型名截断显示', () => {
    const longModel = 'a'.repeat(30)
    render(<UserInput {...DEFAULT_PROPS} currentModel={longModel} onModelChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: '选择模型' })
    expect(trigger.textContent).toContain('...')
  })

  it('onStop 未提供时 disabled 模式停止按钮仍可渲染', () => {
    render(<UserInput {...DEFAULT_PROPS} disabled />)
    expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument()
  })
})

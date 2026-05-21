/**
 * QA — rolePrompt & RoleModule 测试
 *
 * 覆盖范围：
 *  1. rolePrompt 输出包含必要结构字段
 *  2. 无用户消息时 currentInput 为 WAITING_FOR_INPUT
 *  3. historyTranscript 正确过滤 system 消息
 *  4. 角色标识转换（user→T, assistant→H）
 *  5. RoleModule 初始化从 localStorage 读取 memory
 *  6. RoleModule.updateMemory 写入 localStorage 和 this.memory
 *  7. RoleModule.prompt 将 this.memory 注入生成的 prompt
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rolePrompt, RoleModule } from './modules/role'
import type { Message } from './types'

const baseUserInfo = { name: 'Alice', description: 'Test user' }
const baseEnv = 'test-env'

describe('rolePrompt', () => {
  it('输出包含 JSON 格式标记和 GENERATE JSON', () => {
    const result = rolePrompt({
      userInfo: baseUserInfo,
      memory: '',
      environment: baseEnv,
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(result).toContain('GENERATE JSON')
    expect(result).toContain('"main"')
    expect(result).toContain('"memory"')
  })

  it('没有用户消息时 currentInput 为 WAITING_FOR_INPUT', () => {
    const result = rolePrompt({
      userInfo: baseUserInfo,
      memory: '',
      environment: baseEnv,
      messages: [],
    })
    expect(result).toContain('WAITING_FOR_INPUT')
  })

  it('最后一条用户消息内容出现在 CURRENT INPUT 区域', () => {
    const messages: Message[] = [
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'follow up question' },
    ]
    const result = rolePrompt({ userInfo: baseUserInfo, memory: '', environment: baseEnv, messages })
    expect(result).toContain('follow up question')
  })

  it('historyTranscript 中 system 消息被过滤掉', () => {
    const messages: Message[] = [
      { role: 'system', content: 'system prompt content' },
      { role: 'user', content: 'real question' },
    ]
    const result = rolePrompt({ userInfo: baseUserInfo, memory: '', environment: baseEnv, messages })
    expect(result).not.toContain('system prompt content')
  })

  it('历史消息中 user 转为 T(name)，assistant 转为 H(System)', () => {
    const messages: Message[] = [
      { role: 'user', content: 'question one' },
      { role: 'assistant', content: 'answer one' },
      { role: 'user', content: 'question two' },
    ]
    const result = rolePrompt({ userInfo: baseUserInfo, memory: '', environment: baseEnv, messages })
    expect(result).toContain('T(Alice): question one')
    expect(result).toContain('H(System): answer one')
  })

  it('memory 内容出现在 Long-term Memory 区域', () => {
    const result = rolePrompt({
      userInfo: baseUserInfo,
      memory: 'REL: T>>H | DATE: 2026-01-01',
      environment: baseEnv,
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(result).toContain('REL: T>>H | DATE: 2026-01-01')
  })

  it('环境变量注入到 Env 区域', () => {
    const result = rolePrompt({
      userInfo: baseUserInfo,
      memory: '',
      environment: 'production-env',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result).toContain('production-env')
  })

  it('userInfo.description 注入到 Target Profile 区域', () => {
    const result = rolePrompt({
      userInfo: { name: 'Bob', description: 'senior engineer who loves cats' },
      memory: '',
      environment: '',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result).toContain('senior engineer who loves cats')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('RoleModule', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('初始化时 memory 为空字符串（localStorage 无值）', () => {
    const mod = new RoleModule()
    expect(mod.memory).toBe('')
  })

  it('初始化时从 localStorage 读取 memory', () => {
    localStorage.setItem('gagent-role-memory', 'existing memory')
    const mod = new RoleModule()
    expect(mod.memory).toBe('existing memory')
  })

  it('updateMemory 更新 this.memory 并写入 localStorage', () => {
    const mod = new RoleModule()
    mod.updateMemory('new memory content')
    expect(mod.memory).toBe('new memory content')
    expect(localStorage.getItem('gagent-role-memory')).toBe('new memory content')
  })

  it('prompt() 将 this.memory 传入 rolePrompt', () => {
    const mod = new RoleModule()
    mod.updateMemory('MEMORY_MARKER')
    const result = mod.prompt({
      messages: [{ role: 'user', content: 'hi' }],
      environment: '',
      userInfo: { name: 'U', description: 'D' },
    })
    expect(result).toContain('MEMORY_MARKER')
  })

  it('updateMemory 多次覆盖，只保留最新值', () => {
    const mod = new RoleModule()
    mod.updateMemory('v1')
    mod.updateMemory('v2')
    mod.updateMemory('v3')
    expect(mod.memory).toBe('v3')
    expect(localStorage.getItem('gagent-role-memory')).toBe('v3')
  })

  it('new RoleModule 不同实例共享 localStorage', () => {
    const mod1 = new RoleModule()
    mod1.updateMemory('shared-data')
    const mod2 = new RoleModule()
    expect(mod2.memory).toBe('shared-data')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('rolePrompt edge cases', () => {
  it('只有一条用户消息时 historyTranscript 为空', () => {
    const result = rolePrompt({
      userInfo: { name: 'Solo', description: 'alone' },
      memory: '',
      environment: '',
      messages: [{ role: 'user', content: 'only message' }],
    })
    expect(result).toContain('No prior conversation.')
    expect(result).toContain('only message')
  })

  it('多条 system 消息全部被过滤', () => {
    const messages: Message[] = [
      { role: 'system', content: 'sys1' },
      { role: 'system', content: 'sys2' },
      { role: 'user', content: 'actual input' },
    ]
    const result = rolePrompt({
      userInfo: { name: 'Test', description: 'test' },
      memory: '',
      environment: '',
      messages,
    })
    expect(result).not.toContain('sys1')
    expect(result).not.toContain('sys2')
  })

  it('memory 为空时输出 N/A', () => {
    const result = rolePrompt({
      userInfo: { name: 'X', description: 'x' },
      memory: '',
      environment: '',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result).toContain('N/A')
  })

  it('输出包含日期格式 YYYY-MM-DD', () => {
    const result = rolePrompt({
      userInfo: { name: 'X', description: 'x' },
      memory: '',
      environment: '',
      messages: [{ role: 'user', content: 'test' }],
    })
    // DATE: should contain a YYYY-MM-DD pattern
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})

/**
 * QA — getService / openaiServiceCache 测试
 *
 * 覆盖范围：
 *  1. getService 返回 OpenAI 实例
 *  2. 多次调用返回同一实例（缓存命中，key 为 baseURL）
 *  3. 清除缓存后重新创建实例
 *  4. 返回的实例具备 chat.completions API
 *  5. 缓存条目数为 1（单 baseURL 环境）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock import.meta.env before importing the module
vi.stubEnv('VITE_OPENAI_BASE_URL', 'http://localhost:11434/v1')
vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key')

// Must import AFTER env stubbing
import { getService, openaiServiceCache } from './index'

describe('getService', () => {
  beforeEach(() => {
    // 清空缓存，避免测试间污染
    Object.keys(openaiServiceCache).forEach((k) => delete openaiServiceCache[k])
  })

  it('返回 OpenAI 实例', () => {
    const svc = getService('test-model')
    expect(svc).toBeDefined()
    expect(typeof svc.chat.completions.create).toBe('function')
  })

  it('相同参数两次调用返回同一实例（缓存）', () => {
    const a = getService('model-x')
    const b = getService('model-x')
    expect(a).toBe(b)
  })

  it('不同 model 参数仍返回同一实例（cache key 为 baseURL）', () => {
    // 源码中 model 参数未用于 cache key，key 仅为 baseURL
    const a = getService('model-a')
    const b = getService('model-b')
    expect(a).toBe(b)
  })

  it('缓存命中时不创建新条目', () => {
    getService('hit-model')
    const after1 = Object.keys(openaiServiceCache).length
    getService('hit-model-2')
    const after2 = Object.keys(openaiServiceCache).length
    expect(after2).toBe(after1)
  })

  it('清除缓存后再次调用返回新实例', () => {
    const first = getService('recycle-model')
    // 手动清除缓存
    Object.keys(openaiServiceCache).forEach((k) => delete openaiServiceCache[k])
    const second = getService('recycle-model')
    expect(second).not.toBe(first)
  })

  it('返回的实例有 chat.completions 命名空间', () => {
    const svc = getService('namespace-check')
    expect(svc.chat).toBeDefined()
    expect(svc.chat.completions).toBeDefined()
  })

  it('单 baseURL 环境下缓存最多 1 条', () => {
    getService('a')
    getService('b')
    getService('c')
    expect(Object.keys(openaiServiceCache)).toHaveLength(1)
  })
})

import { describe, it, expect } from 'vitest'
import { estimateTokens, totalTokens } from '../../src/agent/token-counter'
import { ContextManager } from '../../src/agent/context-manager'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import type { LLMMessage, TraceEvent } from '../../src/agent/types'

describe('Token Counter', () => {
  it('estimates tokens as chars/4', () => {
    expect(estimateTokens('hello world')).toBe(3) // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a')).toBe(1) // 1 char / 4 = 0.25 → 1
  })

  it('counts message tokens', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]
    const tokens = totalTokens(messages)
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('ContextManager', () => {
  it('detects overflow', () => {
    const cm = new ContextManager({ maxContextTokens: 100 })

    const shortMessages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    ]
    expect(cm.isOverflow(shortMessages)).toBe(false)

    // Create a message that exceeds 75 tokens (75% of 100)
    const longText = 'a'.repeat(400) // 400 chars / 4 = 100 tokens
    const longMessages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: longText }] },
    ]
    expect(cm.isOverflow(longMessages)).toBe(true)
  })

  it('prunes old tool results', () => {
    const cm = new ContextManager({ maxContextTokens: 1000 })

    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'do something' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tc_1', name: 'read', input: { path: '/a' } }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tc_1', content: 'big content here '.repeat(20), is_error: false }],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'found it' }] },
      { role: 'user', content: [{ type: 'text', text: 'now do more' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'sure thing' }] },
      { role: 'user', content: [{ type: 'text', text: 'and more' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    ]

    const { messages: pruned, pruned: count } = cm.prune(messages)
    expect(count).toBe(1)

    // The old tool result (index 2) should be cleared
    const toolResult = pruned[2]!.content[0]!
    expect(toolResult.type).toBe('tool_result')
    if (toolResult.type === 'tool_result') {
      expect(toolResult.content).toBe('[Old tool result content cleared]')
    }
  })

  it('does not prune recent messages', () => {
    const cm = new ContextManager({ maxContextTokens: 1000 })

    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a' }] },
    ]

    const { pruned: count } = cm.prune(messages)
    expect(count).toBe(0)
  })

  it('compacts messages via LLM summary', async () => {
    const engine = new MockLLMEngine([
      {
        content: [{ type: 'text', text: 'User discussed file operations and debugging.' }],
        stop_reason: 'end_turn',
      },
    ])

    const cm = new ContextManager({ maxContextTokens: 1000 })

    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'read file A' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'contents of A' }] },
      { role: 'user', content: [{ type: 'text', text: 'now debug it' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'found bug on line 5' }] },
      { role: 'user', content: [{ type: 'text', text: 'fix it' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'fixed' }] },
    ]

    const { messages: compacted, summary } = await cm.compact(messages, engine)

    // Should have summary + understanding + last 2 messages
    expect(compacted.length).toBe(4)
    expect(summary).toContain('file operations')

    // First message should be the summary
    const firstContent = compacted[0]!.content[0]!
    if (firstContent.type === 'text') {
      expect(firstContent.text).toContain('summary')
    }
  })

  it('getStats reports token counts', () => {
    const cm = new ContextManager({ maxContextTokens: 200 })
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hello world' }] },
    ]
    const stats = cm.getStats(messages)
    expect(stats.max).toBe(200)
    expect(stats.threshold).toBe(150) // 75% of 200
    expect(stats.current).toBeGreaterThan(0)
    expect(stats.overflowing).toBe(false)
  })

  it('manage pipeline yields trace events on overflow', async () => {
    const engine = new MockLLMEngine([
      {
        content: [{ type: 'text', text: 'summary' }],
        stop_reason: 'end_turn',
      },
    ])

    const cm = new ContextManager({ maxContextTokens: 50, compactionThreshold: 0.5 })

    // Create enough content to overflow
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'a'.repeat(100) }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tc_1', name: 'test', input: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tc_1', content: 'b'.repeat(100), is_error: false }],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'c'.repeat(100) }] },
      { role: 'user', content: [{ type: 'text', text: 'final question' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] },
    ]

    const events: TraceEvent[] = []
    const gen = cm.manage(messages, engine)
    let result = await gen.next()

    while (!result.done) {
      events.push(result.value)
      result = await gen.next()
    }

    // Should have pruning and/or compaction events
    expect(events.length).toBeGreaterThan(0)
  })

  it('manage pipeline returns unchanged messages when under threshold', async () => {
    const engine = new MockLLMEngine([])
    const cm = new ContextManager({ maxContextTokens: 10000 })

    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    ]

    const gen = cm.manage(messages, engine)
    let result = await gen.next()

    while (!result.done) {
      result = await gen.next()
    }

    expect(result.value).toEqual(messages)
  })
})

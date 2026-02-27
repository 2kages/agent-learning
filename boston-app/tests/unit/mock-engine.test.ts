import { describe, it, expect } from 'vitest'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import type { LLMResponse } from '../../src/agent/types'

describe('MockLLMEngine', () => {
  it('returns scripted responses in order', async () => {
    const responses: LLMResponse[] = [
      { content: [{ type: 'text', text: 'first' }], stop_reason: 'end_turn' },
      { content: [{ type: 'text', text: 'second' }], stop_reason: 'end_turn' },
    ]

    const engine = new MockLLMEngine(responses)

    const r1 = await engine.chat([], '', [])
    expect(r1.content[0]).toEqual({ type: 'text', text: 'first' })

    const r2 = await engine.chat([], '', [])
    expect(r2.content[0]).toEqual({ type: 'text', text: 'second' })
  })

  it('returns fallback when responses exhausted', async () => {
    const engine = new MockLLMEngine([
      { content: [{ type: 'text', text: 'only one' }], stop_reason: 'end_turn' },
    ])

    await engine.chat([], '', [])
    const fallback = await engine.chat([], '', [])
    expect(fallback.stop_reason).toBe('end_turn')
    expect((fallback.content[0] as { text: string }).text).toContain('no more scripted')
  })

  it('records all calls', async () => {
    const engine = new MockLLMEngine([
      { content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' },
    ])

    await engine.chat(
      [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      'system prompt',
      [{ name: 'test', description: 'test tool', input_schema: {} }]
    )

    expect(engine.calls).toHaveLength(1)
    expect(engine.calls[0]!.systemPrompt).toBe('system prompt')
    expect(engine.calls[0]!.messages[0]!.content[0]).toEqual({ type: 'text', text: 'hello' })
    expect(engine.calls[0]!.tools[0]!.name).toBe('test')
  })

  it('tracks callCount', async () => {
    const engine = new MockLLMEngine([
      { content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn' },
      { content: [{ type: 'text', text: 'b' }], stop_reason: 'end_turn' },
    ])

    expect(engine.callCount).toBe(0)
    await engine.chat([], '', [])
    expect(engine.callCount).toBe(1)
    await engine.chat([], '', [])
    expect(engine.callCount).toBe(2)
  })

  it('resets state', async () => {
    const engine = new MockLLMEngine([
      { content: [{ type: 'text', text: 'old' }], stop_reason: 'end_turn' },
    ])

    await engine.chat([], '', [])
    engine.reset([
      { content: [{ type: 'text', text: 'new' }], stop_reason: 'end_turn' },
    ])

    expect(engine.callCount).toBe(0)
    expect(engine.calls).toHaveLength(0)

    const r = await engine.chat([], '', [])
    expect((r.content[0] as { text: string }).text).toBe('new')
  })

  it('handles tool_use stop_reason', async () => {
    const engine = new MockLLMEngine([
      {
        content: [
          { type: 'text', text: 'calling tool' },
          { type: 'tool_use', id: 'tc_1', name: 'read_file', input: { path: '/test' } },
        ],
        stop_reason: 'tool_use',
      },
    ])

    const r = await engine.chat([], '', [])
    expect(r.stop_reason).toBe('tool_use')
    expect(r.content).toHaveLength(2)
    expect(r.content[1]!.type).toBe('tool_use')
  })
})

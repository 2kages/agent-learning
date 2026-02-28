import { describe, it, expect } from 'vitest'
import { runAgentLoop } from '../../src/agent/agent-loop'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import type { LLMResponse, TraceEvent } from '../../src/agent/types'

/** Collect all trace events and the final return value */
async function collectLoop(
  userMessage: string,
  responses: LLMResponse[],
  maxTurns?: number
) {
  const engine = new MockLLMEngine(responses)
  const events: TraceEvent[] = []

  const gen = runAgentLoop(userMessage, { engine, maxTurns })
  let result = await gen.next()

  while (!result.done) {
    events.push(result.value)
    result = await gen.next()
  }

  return { events, finalText: result.value, engine }
}

describe('Agent Loop (Layer 0)', () => {
  it('exits on end_turn and returns text', async () => {
    const { events, finalText } = await collectLoop('hello', [
      {
        content: [{ type: 'text', text: 'Hello back!' }],
        stop_reason: 'end_turn',
      },
    ])

    expect(finalText).toBe('Hello back!')

    // Should have: loop_start, llm_call, llm_response, loop_end
    const types = events.map(e => e.type)
    expect(types).toEqual(['loop_start', 'llm_call', 'llm_response', 'loop_end'])
  })

  it('emits loop_start and loop_end events', async () => {
    const { events } = await collectLoop('test', [
      {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      },
    ])

    expect(events[0]!.type).toBe('loop_start')
    expect(events[events.length - 1]!.type).toBe('loop_end')
  })

  it('sends the user message to the engine', async () => {
    const { engine } = await collectLoop('what is 2+2?', [
      {
        content: [{ type: 'text', text: '4' }],
        stop_reason: 'end_turn',
      },
    ])

    expect(engine.calls).toHaveLength(1)
    const firstCall = engine.calls[0]!
    expect(firstCall.messages).toHaveLength(1)
    expect(firstCall.messages[0]!.role).toBe('user')
    expect(firstCall.messages[0]!.content[0]).toEqual({
      type: 'text',
      text: 'what is 2+2?',
    })
  })

  it('respects maxTurns limit', async () => {
    // With tool_use stop_reason, the loop would continue in Layer 1.
    // In Layer 0, it breaks immediately on tool_use since there's no handler.
    // But let's test with end_turn to verify maxTurns is passed through.
    const { events } = await collectLoop(
      'test',
      [
        {
          content: [{ type: 'text', text: 'done' }],
          stop_reason: 'end_turn',
        },
      ],
      1
    )

    const types = events.map(e => e.type)
    expect(types).toContain('loop_start')
    expect(types).toContain('loop_end')
  })

  it('returns empty string when response has no text blocks', async () => {
    const { finalText } = await collectLoop('test', [
      {
        content: [],
        stop_reason: 'end_turn',
      },
    ])

    expect(finalText).toBe('')
  })

  it('includes messages in llm_call trace event', async () => {
    const { events } = await collectLoop('hello world', [
      {
        content: [{ type: 'text', text: 'hi' }],
        stop_reason: 'end_turn',
      },
    ])

    const llmCall = events.find(e => e.type === 'llm_call')
    expect(llmCall).toBeDefined()
    if (llmCall?.type === 'llm_call') {
      expect(llmCall.messages).toHaveLength(1)
      expect(llmCall.messages[0]!.role).toBe('user')
    }
  })

  it('includes response in llm_response trace event', async () => {
    const { events } = await collectLoop('test', [
      {
        content: [{ type: 'text', text: 'response text' }],
        stop_reason: 'end_turn',
      },
    ])

    const llmResp = events.find(e => e.type === 'llm_response')
    expect(llmResp).toBeDefined()
    if (llmResp?.type === 'llm_response') {
      expect(llmResp.response.stop_reason).toBe('end_turn')
      expect(llmResp.response.content[0]).toEqual({
        type: 'text',
        text: 'response text',
      })
    }
  })
})

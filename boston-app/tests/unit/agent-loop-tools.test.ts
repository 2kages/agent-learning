import { describe, it, expect } from 'vitest'
import { runAgentLoop } from '../../src/agent/agent-loop'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import { ToolRegistry } from '../../src/agent/tool-registry'
import type { LLMResponse, TraceEvent } from '../../src/agent/types'

async function collectLoop(
  userMessage: string,
  responses: LLMResponse[],
  registry?: ToolRegistry
) {
  const engine = new MockLLMEngine(responses)
  const events: TraceEvent[] = []
  const tools = registry?.getDefinitions() ?? []

  const gen = runAgentLoop(userMessage, { engine, toolRegistry: registry, tools })
  let result = await gen.next()

  while (!result.done) {
    events.push(result.value)
    result = await gen.next()
  }

  return { events, finalText: result.value, engine }
}

describe('Agent Loop with Tools (Layer 1)', () => {
  it('executes a tool call and loops back', async () => {
    const registry = new ToolRegistry()
    registry.register({
      definition: {
        name: 'get_time',
        description: 'Get current time',
        input_schema: { type: 'object', properties: {} },
      },
      async execute() {
        return { output: '12:00 PM', isError: false }
      },
    })

    const { events, finalText } = await collectLoop(
      'what time is it?',
      [
        // Turn 1: LLM requests tool
        {
          content: [
            { type: 'text', text: 'Let me check the time.' },
            { type: 'tool_use', id: 'tc_1', name: 'get_time', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        // Turn 2: LLM responds with text
        {
          content: [{ type: 'text', text: 'It is 12:00 PM.' }],
          stop_reason: 'end_turn',
        },
      ],
      registry
    )

    expect(finalText).toBe('It is 12:00 PM.')

    const types = events.map(e => e.type)
    expect(types).toContain('tool_call')
    expect(types).toContain('tool_result')
  })

  it('emits tool_call and tool_result trace events', async () => {
    const registry = new ToolRegistry()
    registry.register({
      definition: {
        name: 'echo',
        description: 'Echo input',
        input_schema: { type: 'object', properties: { msg: { type: 'string' } } },
      },
      async execute(input) {
        return { output: input.msg as string, isError: false }
      },
    })

    const { events } = await collectLoop(
      'test',
      [
        {
          content: [
            { type: 'tool_use', id: 'tc_1', name: 'echo', input: { msg: 'hello' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [{ type: 'text', text: 'done' }],
          stop_reason: 'end_turn',
        },
      ],
      registry
    )

    const toolCall = events.find(e => e.type === 'tool_call')
    expect(toolCall).toBeDefined()
    if (toolCall?.type === 'tool_call') {
      expect(toolCall.name).toBe('echo')
      expect(toolCall.input).toEqual({ msg: 'hello' })
    }

    const toolResult = events.find(e => e.type === 'tool_result')
    expect(toolResult).toBeDefined()
    if (toolResult?.type === 'tool_result') {
      expect(toolResult.name).toBe('echo')
      expect(toolResult.output).toBe('hello')
      expect(toolResult.isError).toBe(false)
    }
  })

  it('handles tool errors as data (not exceptions)', async () => {
    const registry = new ToolRegistry()
    registry.register({
      definition: {
        name: 'fail',
        description: 'Always fails',
        input_schema: {},
      },
      async execute() {
        throw new Error('boom')
      },
    })

    const { events } = await collectLoop(
      'test',
      [
        {
          content: [
            { type: 'tool_use', id: 'tc_1', name: 'fail', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [{ type: 'text', text: 'error handled' }],
          stop_reason: 'end_turn',
        },
      ],
      registry
    )

    const toolResult = events.find(e => e.type === 'tool_result')
    if (toolResult?.type === 'tool_result') {
      expect(toolResult.isError).toBe(true)
      expect(toolResult.output).toContain('boom')
    }
  })

  it('handles unknown tool name', async () => {
    const registry = new ToolRegistry()

    const { events } = await collectLoop(
      'test',
      [
        {
          content: [
            { type: 'tool_use', id: 'tc_1', name: 'nonexistent', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
        },
      ],
      registry
    )

    const toolResult = events.find(e => e.type === 'tool_result')
    if (toolResult?.type === 'tool_result') {
      expect(toolResult.isError).toBe(true)
      expect(toolResult.output).toContain('Unknown tool')
    }
  })
})

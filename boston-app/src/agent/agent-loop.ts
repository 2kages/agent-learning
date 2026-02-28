import type {
  LLMEngine,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  TraceEvent,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from './types'
import type { ToolRegistry } from './tool-registry'
import { MAX_AGENT_TURNS, SYSTEM_PROMPT } from '../lib/constants'

export interface AgentLoopOptions {
  engine: LLMEngine
  systemPrompt?: string
  tools?: ToolDefinition[]
  toolRegistry?: ToolRegistry
  maxTurns?: number
}

/**
 * The agent loop — an async generator that yields trace events.
 *
 * Mirrors the while-loop pattern from agent-loop.md:
 * 1. Call the LLM with the full message history
 * 2. Check stop_reason
 * 3. If tool_use → execute tools, push results, loop
 * 4. If end_turn → return final text
 */
export async function* runAgentLoop(
  userMessage: string,
  options: AgentLoopOptions
): AsyncGenerator<TraceEvent, string> {
  const {
    engine,
    systemPrompt = SYSTEM_PROMPT,
    tools = [],
    toolRegistry,
    maxTurns = MAX_AGENT_TURNS,
  } = options

  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userMessage }] },
  ]

  yield { type: 'loop_start' }

  let lastResponse: LLMResponse | null = null

  for (let turn = 0; turn < maxTurns; turn++) {
    yield { type: 'llm_call', messages: [...messages] }

    lastResponse = await engine.chat(messages, systemPrompt, tools)

    yield { type: 'llm_response', response: lastResponse }

    // Append assistant response to history
    messages.push({ role: 'assistant', content: lastResponse.content })

    // Check termination: no tool calls → done
    if (lastResponse.stop_reason !== 'tool_use') {
      break
    }

    // No registry → can't execute tools, bail
    if (!toolRegistry) {
      break
    }

    // Extract tool_use blocks
    const toolCalls = lastResponse.content.filter(
      (b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use'
    )

    // Execute each tool and collect results
    const toolResults: ToolResultBlock[] = []

    for (const call of toolCalls) {
      yield { type: 'tool_call', name: call.name, input: call.input }

      const result = await toolRegistry.execute(call.name, call.input)

      yield { type: 'tool_result', name: call.name, output: result.output, isError: result.isError }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: result.output,
        is_error: result.isError,
      })
    }

    // Push tool results as a user message (Anthropic API convention)
    messages.push({ role: 'user', content: toolResults })
  }

  yield { type: 'loop_end' }

  // Extract final text from last response
  const textBlock = lastResponse?.content.find(
    (b: ContentBlock): b is TextBlock => b.type === 'text'
  )
  return textBlock?.text ?? ''
}

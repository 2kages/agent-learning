import type {
  LLMEngine,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  TraceEvent,
  ContentBlock,
  TextBlock,
} from './types'
import { MAX_AGENT_TURNS, SYSTEM_PROMPT } from '../lib/constants'

export interface AgentLoopOptions {
  engine: LLMEngine
  systemPrompt?: string
  tools?: ToolDefinition[]
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
 *
 * Layer 0: no tools yet, just the basic loop that exits on end_turn.
 */
export async function* runAgentLoop(
  userMessage: string,
  options: AgentLoopOptions
): AsyncGenerator<TraceEvent, string> {
  const {
    engine,
    systemPrompt = SYSTEM_PROMPT,
    tools = [],
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

    // Layer 1+ will handle tool execution here.
    // For now, if stop_reason is tool_use but we have no tool executor,
    // just break to avoid infinite loop.
    break
  }

  yield { type: 'loop_end' }

  // Extract final text from last response
  const textBlock = lastResponse?.content.find(
    (b: ContentBlock): b is TextBlock => b.type === 'text'
  )
  return textBlock?.text ?? ''
}

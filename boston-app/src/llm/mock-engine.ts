import type { LLMEngine, LLMMessage, LLMResponse, ToolDefinition } from '../agent/types'

/**
 * Scripted mock LLM engine for deterministic testing.
 * Feed it a sequence of responses; it returns them in order.
 * Records all calls for assertions.
 */
export class MockLLMEngine implements LLMEngine {
  private responses: LLMResponse[]
  private index = 0

  /** Every call to chat() is recorded here */
  readonly calls: Array<{
    messages: LLMMessage[]
    systemPrompt: string
    tools: ToolDefinition[]
  }> = []

  constructor(responses: LLMResponse[]) {
    this.responses = responses
  }

  async chat(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: ToolDefinition[]
  ): Promise<LLMResponse> {
    this.calls.push({ messages: [...messages], systemPrompt, tools: [...tools] })

    if (this.index >= this.responses.length) {
      return {
        content: [{ type: 'text', text: '(no more scripted responses)' }],
        stop_reason: 'end_turn',
      }
    }

    return this.responses[this.index++]!
  }

  /** How many responses have been consumed */
  get callCount(): number {
    return this.index
  }

  /** Reset for reuse */
  reset(responses?: LLMResponse[]) {
    this.index = 0
    this.calls.length = 0
    if (responses) this.responses = responses
  }
}

import type {
  LLMEngine,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
  ContentBlock,
} from '../agent/types'

/**
 * JSON schema for constrained output from small models.
 * Small models can't produce Anthropic-style tool_use blocks natively,
 * so we force them to output this JSON structure and translate it.
 */
const RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    thinking: { type: 'string' as const },
    text: { type: 'string' as const },
    tool_calls: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          input: { type: 'object' as const },
        },
        required: ['name', 'input'] as const,
      },
    },
  },
  required: ['text'] as const,
}

interface WebLLMChat {
  completions: {
    create: (params: Record<string, unknown>) => Promise<{
      choices: Array<{
        message: { content: string }
        finish_reason: string
      }>
    }>
  }
}

interface WebLLMInstance {
  chat: WebLLMChat
}

/**
 * Translates ContentBlock[] messages into OpenAI-compatible format
 * for WebLLM, and translates the constrained JSON response back
 * into ContentBlock[].
 */
export class WebLLMEngine implements LLMEngine {
  private engine: WebLLMInstance

  constructor(engine: WebLLMInstance) {
    this.engine = engine
  }

  async chat(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: ToolDefinition[]
  ): Promise<LLMResponse> {
    // Build OpenAI-compatible messages
    const openaiMessages = [
      { role: 'system' as const, content: this.buildSystemPrompt(systemPrompt, tools) },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: this.blocksToText(m.content),
      })),
    ]

    const response = await this.engine.chat.completions.create({
      messages: openaiMessages,
      temperature: 0.3,
      response_format: { type: 'json_object', schema: RESPONSE_SCHEMA },
    })

    const raw = response.choices[0]?.message.content ?? '{}'
    return this.parseResponse(raw)
  }

  /** Inject tool definitions into the system prompt as JSON */
  private buildSystemPrompt(base: string, tools: ToolDefinition[]): string {
    if (tools.length === 0) return base

    const toolDocs = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }))

    return `${base}

## Available Tools

${JSON.stringify(toolDocs, null, 2)}

To call a tool, include it in your JSON response under "tool_calls".
You may call multiple tools at once. If you don't need a tool, leave tool_calls empty or omit it.`
  }

  /** Convert ContentBlock[] to plain text for the OpenAI message format */
  private blocksToText(blocks: ContentBlock[]): string {
    return blocks
      .map(b => {
        switch (b.type) {
          case 'text':
            return b.text
          case 'tool_use':
            return `[Tool call: ${b.name}(${JSON.stringify(b.input)})]`
          case 'tool_result':
            return `[Tool result for ${b.tool_use_id}: ${b.content}]`
        }
      })
      .join('\n')
  }

  /** Parse constrained JSON output into ContentBlock[] */
  private parseResponse(raw: string): LLMResponse {
    let parsed: { text?: string; tool_calls?: Array<{ name: string; input: Record<string, unknown> }> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {
        content: [{ type: 'text', text: raw }],
        stop_reason: 'end_turn',
      }
    }

    const content: ContentBlock[] = []

    if (parsed.text) {
      content.push({ type: 'text', text: parsed.text })
    }

    if (parsed.tool_calls && parsed.tool_calls.length > 0) {
      for (const tc of parsed.tool_calls) {
        content.push({
          type: 'tool_use',
          id: `tc_${crypto.randomUUID().slice(0, 8)}`,
          name: tc.name,
          input: tc.input,
        })
      }
      return { content, stop_reason: 'tool_use' }
    }

    if (content.length === 0) {
      content.push({ type: 'text', text: '' })
    }

    return { content, stop_reason: 'end_turn' }
  }
}

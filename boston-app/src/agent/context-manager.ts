import type { LLMEngine, LLMMessage, ContentBlock, ToolResultBlock, TraceEvent } from './types'
import { totalTokens, estimateTokens } from './token-counter'

export interface ContextManagerOptions {
  maxContextTokens: number
  compactionThreshold?: number // fraction of max at which to compact (default 0.75)
}

/**
 * Context manager implementing compaction + pruning from context-management.md.
 *
 * When context exceeds threshold:
 * 1. Prune: replace old tool results with "[cleared]" summaries
 * 2. Compact: if still over, summarize conversation via LLM and replace messages
 */
export class ContextManager {
  private maxTokens: number
  private threshold: number

  constructor(options: ContextManagerOptions) {
    this.maxTokens = options.maxContextTokens
    this.threshold = options.compactionThreshold ?? 0.75
  }

  /** Check if messages exceed the context threshold */
  isOverflow(messages: LLMMessage[]): boolean {
    return totalTokens(messages) > this.maxTokens * this.threshold
  }

  /**
   * Prune old tool results — replace their content with "[cleared]".
   * Only prunes tool_result blocks older than the last 2 turns.
   * Returns new array (does not mutate).
   */
  prune(messages: LLMMessage[]): { messages: LLMMessage[]; pruned: number } {
    if (messages.length <= 4) return { messages, pruned: 0 }

    let pruned = 0
    const cutoff = Math.max(0, messages.length - 4) // keep last 4 messages intact

    const result = messages.map((msg, i) => {
      if (i >= cutoff) return msg

      const newContent = msg.content.map((block: ContentBlock) => {
        if (block.type === 'tool_result' && block.content !== '[Old tool result content cleared]') {
          pruned++
          return {
            ...block,
            content: '[Old tool result content cleared]',
          } as ToolResultBlock
        }
        return block
      })

      return { ...msg, content: newContent }
    })

    return { messages: result, pruned }
  }

  /**
   * Compact messages by summarizing old conversation via LLM.
   * Replaces all messages except the last 2 with a summary.
   */
  async compact(
    messages: LLMMessage[],
    engine: LLMEngine
  ): Promise<{ messages: LLMMessage[]; summary: string }> {
    if (messages.length <= 2) {
      return { messages, summary: '' }
    }

    // Split: old messages to summarize, recent to keep
    const keepCount = Math.min(2, messages.length)
    const oldMessages = messages.slice(0, -keepCount)
    const recentMessages = messages.slice(-keepCount)

    // Build summary text from old messages
    const historyText = oldMessages
      .map(m => {
        const texts = m.content
          .map(b => {
            if (b.type === 'text') return b.text
            if (b.type === 'tool_use') return `[Tool: ${b.name}]`
            if (b.type === 'tool_result') return `[Result: ${b.content.slice(0, 50)}]`
            return ''
          })
          .join(' ')
        return `${m.role}: ${texts}`
      })
      .join('\n')

    // Ask LLM to summarize
    const summaryResponse = await engine.chat(
      [{ role: 'user', content: [{ type: 'text', text: `Summarize this conversation history concisely:\n\n${historyText}` }] }],
      'You are a summarizer. Provide a brief, factual summary of the conversation.',
      []
    )

    const summaryText = summaryResponse.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    // Replace old messages with a summary message
    const compactedMessages: LLMMessage[] = [
      {
        role: 'user',
        content: [{
          type: 'text',
          text: `[Previous conversation summary: ${summaryText}]`,
        }],
      },
      {
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Understood, I have the context from the previous conversation.',
        }],
      },
      ...recentMessages,
    ]

    return { messages: compactedMessages, summary: summaryText }
  }

  /**
   * Run the full context management pipeline.
   * Yields trace events for pruning and compaction.
   */
  async *manage(
    messages: LLMMessage[],
    engine: LLMEngine
  ): AsyncGenerator<TraceEvent, LLMMessage[]> {
    if (!this.isOverflow(messages)) {
      return messages
    }

    // Step 1: Prune old tool results
    const { messages: prunedMessages, pruned } = this.prune(messages)
    if (pruned > 0) {
      yield { type: 'context_pruned', pruned }
    }

    // Step 2: If still over, compact
    if (this.isOverflow(prunedMessages)) {
      const { messages: compactedMessages, summary } = await this.compact(prunedMessages, engine)
      yield { type: 'context_compacted', summary }
      return compactedMessages
    }

    return prunedMessages
  }

  /** Get current token stats */
  getStats(messages: LLMMessage[]): { current: number; max: number; threshold: number; overflowing: boolean } {
    const current = totalTokens(messages)
    return {
      current,
      max: this.maxTokens,
      threshold: Math.floor(this.maxTokens * this.threshold),
      overflowing: current > this.maxTokens * this.threshold,
    }
  }
}

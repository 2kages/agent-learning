import type { LLMMessage, ContentBlock } from './types'

/**
 * Approximate token counter using the char/4 heuristic.
 * 1 token ~ 4 characters. Good enough for demo purposes.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Estimate tokens for a single content block */
export function blockTokens(block: ContentBlock): number {
  switch (block.type) {
    case 'text':
      return estimateTokens(block.text)
    case 'tool_use':
      return estimateTokens(block.name) + estimateTokens(JSON.stringify(block.input)) + 10
    case 'tool_result':
      return estimateTokens(block.content) + 10
  }
}

/** Estimate total tokens in a message */
export function messageTokens(message: LLMMessage): number {
  return message.content.reduce((sum, block) => sum + blockTokens(block), 0) + 4 // role overhead
}

/** Estimate total tokens across all messages */
export function totalTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, msg) => sum + messageTokens(msg), 0)
}

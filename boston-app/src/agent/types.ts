/**
 * Shared type definitions for the agent architecture.
 * Maps directly to concepts from the teaching docs.
 */

// ─── Content Blocks ─────────────────────────────────────────────

/** A plain text block from the LLM */
export interface TextBlock {
  type: 'text'
  text: string
}

/** The LLM requests a tool call */
export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** The result of executing a tool */
export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

// ─── Messages ───────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

// ─── LLM Response ───────────────────────────────────────────────

/** What the LLM engine returns after a single call */
export interface LLMResponse {
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'tool_use'
}

// ─── Tool Definitions ───────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface Tool {
  definition: ToolDefinition
  execute: (input: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolResult {
  output: string
  isError: boolean
}

// ─── Trace Events ───────────────────────────────────────────────

export type TraceEvent =
  | { type: 'loop_start' }
  | { type: 'loop_end' }
  | { type: 'llm_call'; messages: LLMMessage[] }
  | { type: 'llm_response'; response: LLMResponse }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; output: string; isError: boolean }
  | { type: 'error'; message: string }

// ─── LLM Engine Interface ───────────────────────────────────────

export interface LLMEngine {
  chat(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: ToolDefinition[]
  ): Promise<LLMResponse>
}

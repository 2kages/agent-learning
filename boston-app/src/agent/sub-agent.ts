import type {
  LLMEngine,
  LLMMessage,
  TraceEvent,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from './types'
import type { ToolRegistry } from './tool-registry'
import { MAX_AGENT_TURNS, SYSTEM_PROMPT } from '../lib/constants'

export interface SubAgentTask {
  id: string
  goal: string
}

export interface SubAgentResult {
  id: string
  goal: string
  output: string
  isError: boolean
}

/**
 * Run a sub-agent loop for a single task.
 * Isolated conversation context, shared VirtualFS (via toolRegistry).
 */
async function runSubAgent(
  task: SubAgentTask,
  engine: LLMEngine,
  toolRegistry: ToolRegistry,
  systemPrompt: string
): Promise<SubAgentResult> {
  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: task.goal }] },
  ]

  const tools = toolRegistry.getDefinitions()

  try {
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      const response = await engine.chat(messages, systemPrompt, tools)
      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(
          (b: ContentBlock): b is TextBlock => b.type === 'text'
        )
        return {
          id: task.id,
          goal: task.goal,
          output: textBlock?.text ?? '',
          isError: false,
        }
      }

      // Execute tools
      const toolCalls = response.content.filter(
        (b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use'
      )

      const toolResults: ToolResultBlock[] = []
      for (const call of toolCalls) {
        const result = await toolRegistry.execute(call.name, call.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: result.output,
          is_error: result.isError,
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return {
      id: task.id,
      goal: task.goal,
      output: 'Sub-agent reached max turns',
      isError: true,
    }
  } catch (err) {
    return {
      id: task.id,
      goal: task.goal,
      output: `Sub-agent error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    }
  }
}

/**
 * Spawn multiple sub-agents in parallel.
 * Each gets its own conversation context but shares the VirtualFS
 * (through the shared toolRegistry).
 *
 * From subagents.md: sub-agents run in parallel, results are collected
 * and returned to the parent agent.
 */
export async function spawnSubAgents(
  tasks: SubAgentTask[],
  engine: LLMEngine,
  toolRegistry: ToolRegistry,
  systemPrompt = SYSTEM_PROMPT
): Promise<SubAgentResult[]> {
  const promises = tasks.map(task =>
    runSubAgent(task, engine, toolRegistry, systemPrompt)
  )

  return Promise.all(promises)
}

/**
 * Partition content blocks into regular tool calls and spawn_agent calls.
 * Regular tool calls are executed first, then spawn_agent calls are run in parallel.
 */
export function partitionToolCalls(
  blocks: ContentBlock[]
): { regular: ToolUseBlock[]; spawns: ToolUseBlock[] } {
  const toolCalls = blocks.filter(
    (b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use'
  )

  const regular = toolCalls.filter(tc => tc.name !== 'spawn_agent')
  const spawns = toolCalls.filter(tc => tc.name === 'spawn_agent')

  return { regular, spawns }
}

/**
 * Create the spawn_agent tool definition for the tool registry.
 */
export function createSpawnAgentTool(
  engine: LLMEngine,
  toolRegistry: ToolRegistry
) {
  return {
    definition: {
      name: 'spawn_agent',
      description: 'Spawn a sub-agent to handle a task in parallel. The sub-agent gets its own conversation but shares the file system.',
      input_schema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The task for the sub-agent to accomplish' },
        },
        required: ['goal'],
      },
    },
    async execute(input: Record<string, unknown>) {
      const goal = input.goal as string
      const task: SubAgentTask = {
        id: `sub_${crypto.randomUUID().slice(0, 8)}`,
        goal,
      }

      const results = await spawnSubAgents([task], engine, toolRegistry)
      const result = results[0]!

      if (result.isError) {
        return { output: `Sub-agent failed: ${result.output}`, isError: true }
      }

      return { output: `Sub-agent completed: ${result.output}`, isError: false }
    },
  }
}

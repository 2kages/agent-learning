import { describe, it, expect } from 'vitest'
import { spawnSubAgents, partitionToolCalls, createSpawnAgentTool } from '../../src/agent/sub-agent'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import { ToolRegistry } from '../../src/agent/tool-registry'
import { VirtualFS } from '../../src/fs/virtual-fs'
import { createFSTools } from '../../src/agent/tools/fs-tools'
import type { ContentBlock, ToolUseBlock } from '../../src/agent/types'

function setupRegistry() {
  const fs = new VirtualFS()
  const registry = new ToolRegistry()
  for (const tool of createFSTools(fs)) {
    registry.register(tool)
  }
  return { fs, registry }
}

describe('spawnSubAgents', () => {
  it('runs parallel tasks and returns results', async () => {
    const engine = new MockLLMEngine([
      // Sub-agent 1 response
      { content: [{ type: 'text', text: 'Task 1 done' }], stop_reason: 'end_turn' },
      // Sub-agent 2 response
      { content: [{ type: 'text', text: 'Task 2 done' }], stop_reason: 'end_turn' },
    ])

    const { registry } = setupRegistry()

    const results = await spawnSubAgents(
      [
        { id: 'sub_1', goal: 'Do task 1' },
        { id: 'sub_2', goal: 'Do task 2' },
      ],
      engine,
      registry
    )

    expect(results).toHaveLength(2)
    expect(results[0]!.output).toBe('Task 1 done')
    expect(results[1]!.output).toBe('Task 2 done')
    expect(results[0]!.isError).toBe(false)
    expect(results[1]!.isError).toBe(false)
  })

  it('sub-agents share VirtualFS', async () => {
    const { fs, registry } = setupRegistry()

    const engine = new MockLLMEngine([
      // Sub-agent writes a file
      {
        content: [
          { type: 'tool_use', id: 'tc_1', name: 'write_file', input: { path: '/from-sub.txt', content: 'created by sub-agent' } },
        ],
        stop_reason: 'tool_use',
      },
      // Sub-agent finishes
      { content: [{ type: 'text', text: 'File created' }], stop_reason: 'end_turn' },
    ])

    await spawnSubAgents(
      [{ id: 'sub_1', goal: 'Create a file' }],
      engine,
      registry
    )

    // File should be visible in the shared FS
    expect(fs.readFile('/from-sub.txt')).toBe('created by sub-agent')
  })

  it('handles sub-agent failures gracefully', async () => {
    const engine = new MockLLMEngine([]) // No responses → will use fallback

    const { registry } = setupRegistry()

    const results = await spawnSubAgents(
      [{ id: 'sub_1', goal: 'Do something' }],
      engine,
      registry
    )

    expect(results).toHaveLength(1)
    // Should return a result (either text or error), not throw
    expect(results[0]!.id).toBe('sub_1')
  })
})

describe('partitionToolCalls', () => {
  it('separates regular and spawn_agent calls', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'hello' },
      { type: 'tool_use', id: 'tc_1', name: 'read_file', input: { path: '/a' } },
      { type: 'tool_use', id: 'tc_2', name: 'spawn_agent', input: { goal: 'task' } },
      { type: 'tool_use', id: 'tc_3', name: 'write_file', input: { path: '/b', content: '' } },
    ]

    const { regular, spawns } = partitionToolCalls(blocks)

    expect(regular).toHaveLength(2)
    expect(regular.map((r: ToolUseBlock) => r.name)).toEqual(['read_file', 'write_file'])
    expect(spawns).toHaveLength(1)
    expect(spawns[0]!.name).toBe('spawn_agent')
  })

  it('handles no spawn_agent calls', () => {
    const blocks: ContentBlock[] = [
      { type: 'tool_use', id: 'tc_1', name: 'read_file', input: {} },
    ]

    const { regular, spawns } = partitionToolCalls(blocks)
    expect(regular).toHaveLength(1)
    expect(spawns).toHaveLength(0)
  })

  it('handles all spawn_agent calls', () => {
    const blocks: ContentBlock[] = [
      { type: 'tool_use', id: 'tc_1', name: 'spawn_agent', input: { goal: 'a' } },
      { type: 'tool_use', id: 'tc_2', name: 'spawn_agent', input: { goal: 'b' } },
    ]

    const { regular, spawns } = partitionToolCalls(blocks)
    expect(regular).toHaveLength(0)
    expect(spawns).toHaveLength(2)
  })
})

describe('createSpawnAgentTool', () => {
  it('creates a tool that spawns sub-agents', async () => {
    const engine = new MockLLMEngine([
      { content: [{ type: 'text', text: 'Sub-agent result' }], stop_reason: 'end_turn' },
    ])

    const { registry } = setupRegistry()
    const tool = createSpawnAgentTool(engine, registry)

    expect(tool.definition.name).toBe('spawn_agent')

    const result = await tool.execute({ goal: 'Test task' })
    expect(result.isError).toBe(false)
    expect(result.output).toContain('Sub-agent completed')
  })
})

import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../../src/agent/tool-registry'
import type { Tool } from '../../src/agent/types'

function makeTool(name: string, output = 'ok'): Tool {
  return {
    definition: {
      name,
      description: `Tool ${name}`,
      input_schema: { type: 'object', properties: {} },
    },
    async execute() {
      return { output, isError: false }
    },
  }
}

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry()
    const tool = makeTool('test')
    registry.register(tool)
    expect(registry.get('test')).toBe(tool)
    expect(registry.has('test')).toBe(true)
    expect(registry.size).toBe(1)
  })

  it('replaces tools with same name', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('test', 'v1'))
    registry.register(makeTool('test', 'v2'))
    expect(registry.size).toBe(1)
  })

  it('unregisters tools', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('test'))
    expect(registry.unregister('test')).toBe(true)
    expect(registry.has('test')).toBe(false)
    expect(registry.unregister('test')).toBe(false)
  })

  it('returns definitions sorted alphabetically', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('zebra'))
    registry.register(makeTool('alpha'))
    registry.register(makeTool('mid'))
    const defs = registry.getDefinitions()
    expect(defs.map(d => d.name)).toEqual(['alpha', 'mid', 'zebra'])
  })

  it('executes a tool successfully', async () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('greet', 'hello!'))
    const result = await registry.execute('greet', {})
    expect(result).toEqual({ output: 'hello!', isError: false })
  })

  it('returns error for unknown tool', async () => {
    const registry = new ToolRegistry()
    const result = await registry.execute('nonexistent', {})
    expect(result.isError).toBe(true)
    expect(result.output).toContain('Unknown tool')
  })

  it('catches tool execution errors', async () => {
    const registry = new ToolRegistry()
    registry.register({
      definition: {
        name: 'broken',
        description: 'always fails',
        input_schema: {},
      },
      async execute() {
        throw new Error('kaboom')
      },
    })
    const result = await registry.execute('broken', {})
    expect(result.isError).toBe(true)
    expect(result.output).toContain('kaboom')
  })

  it('clears all tools', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('a'))
    registry.register(makeTool('b'))
    registry.clear()
    expect(registry.size).toBe(0)
  })
})

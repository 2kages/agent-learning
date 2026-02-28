import type { Tool, ToolDefinition, ToolResult } from './types'

/**
 * Tool registry — a Map from tool name to Tool.
 * Keeps definitions sorted alphabetically for stable prompt ordering.
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>()

  /** Register a tool. Replaces if name already exists. */
  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool)
  }

  /** Unregister a tool by name. */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /** Get a tool by name. */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /** Check if a tool exists. */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** Get all tool definitions, sorted alphabetically by name. */
  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()]
      .map(t => t.definition)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Execute a tool by name. Returns error result if tool not found. */
  async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { output: `Unknown tool: ${name}`, isError: true }
    }
    try {
      return await tool.execute(input)
    } catch (err) {
      return {
        output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      }
    }
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size
  }

  /** Clear all tools. */
  clear(): void {
    this.tools.clear()
  }
}

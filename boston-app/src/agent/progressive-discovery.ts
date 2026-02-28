import type { Tool, ToolDefinition } from './types'
import type { ToolRegistry } from './tool-registry'

/**
 * A skill definition: a named bundle of tools + instructions
 * that can be activated on demand.
 */
export interface SkillDefinition {
  name: string
  description: string
  instructions: string
  tools: Tool[]
}

/**
 * Skill registry — manages available skills and their activation.
 * Implements the progressive discovery pattern from progressive-discovery.md:
 * - Skills are listed in the system prompt (names + descriptions only)
 * - The LLM calls activate_skill to load a skill's tools into the registry
 * - Activation is idempotent (activating twice is a no-op)
 */
export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>()
  private activated = new Set<string>()

  /** Register a skill as available (not yet activated) */
  addSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
  }

  /** Get all available (registered) skill names */
  available(): string[] {
    return [...this.skills.keys()].sort()
  }

  /** Check if a skill is activated */
  isActivated(name: string): boolean {
    return this.activated.has(name)
  }

  /**
   * Activate a skill: register its tools into the tool registry.
   * Returns the skill's instructions to be injected into the conversation.
   * Idempotent — second activation is a no-op.
   */
  activate(name: string, toolRegistry: ToolRegistry): { instructions: string } | { error: string } {
    const skill = this.skills.get(name)
    if (!skill) {
      return { error: `Unknown skill: ${name}. Available: ${this.available().join(', ')}` }
    }

    if (this.activated.has(name)) {
      return { instructions: `Skill "${name}" is already active.` }
    }

    this.activated.add(name)

    for (const tool of skill.tools) {
      toolRegistry.register(tool)
    }

    return { instructions: skill.instructions }
  }

  /**
   * Build the skill catalog section for the system prompt.
   * Lists skill names + descriptions for the LLM to browse.
   */
  buildCatalogPrompt(): string {
    if (this.skills.size === 0) return ''

    const entries = [...this.skills.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, skill]) => {
        const status = this.activated.has(name) ? ' (active)' : ''
        return `- **${name}**${status}: ${skill.description}`
      })
      .join('\n')

    return `## Available Skills

Use the \`activate_skill\` tool to load any skill you need.

${entries}`
  }

  /**
   * Create the activate_skill meta-tool.
   * When called, it activates the named skill and returns its instructions.
   */
  createActivateSkillTool(toolRegistry: ToolRegistry): Tool {
    return {
      definition: {
        name: 'activate_skill',
        description: 'Activate a skill to load its tools and instructions. Call this when you need specialized capabilities.',
        input_schema: {
          type: 'object',
          properties: {
            skill_name: {
              type: 'string',
              description: `The skill to activate. Available: ${this.available().join(', ')}`,
            },
          },
          required: ['skill_name'],
        },
      },
      execute: async (input) => {
        const skillName = input.skill_name as string
        const result = this.activate(skillName, toolRegistry)

        if ('error' in result) {
          return { output: result.error, isError: true }
        }

        return {
          output: `Skill "${skillName}" activated. Instructions:\n\n${result.instructions}`,
          isError: false,
        }
      },
    }
  }

  /** Number of registered skills */
  get size(): number {
    return this.skills.size
  }

  /** Number of activated skills */
  get activatedCount(): number {
    return this.activated.size
  }
}

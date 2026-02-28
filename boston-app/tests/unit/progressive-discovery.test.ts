import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '../../src/agent/progressive-discovery'
import { ToolRegistry } from '../../src/agent/tool-registry'
import type { SkillDefinition } from '../../src/agent/progressive-discovery'
import type { Tool } from '../../src/agent/types'

function makeSkill(name: string, toolNames: string[] = []): SkillDefinition {
  const tools: Tool[] = toolNames.map(tn => ({
    definition: {
      name: tn,
      description: `Tool ${tn}`,
      input_schema: {},
    },
    async execute() {
      return { output: `${tn} executed`, isError: false }
    },
  }))

  return {
    name,
    description: `Skill ${name}`,
    instructions: `Instructions for ${name}`,
    tools,
  }
}

describe('SkillRegistry', () => {
  it('lists available skills sorted', () => {
    const sr = new SkillRegistry()
    sr.addSkill(makeSkill('zebra'))
    sr.addSkill(makeSkill('alpha'))
    expect(sr.available()).toEqual(['alpha', 'zebra'])
  })

  it('activates a skill and registers its tools', () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    sr.addSkill(makeSkill('review', ['analyze', 'lint']))

    const result = sr.activate('review', tr)
    expect('instructions' in result).toBe(true)
    expect(sr.isActivated('review')).toBe(true)
    expect(tr.has('analyze')).toBe(true)
    expect(tr.has('lint')).toBe(true)
  })

  it('activation is idempotent', () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    sr.addSkill(makeSkill('review', ['analyze']))

    sr.activate('review', tr)
    const result = sr.activate('review', tr)
    expect('instructions' in result).toBe(true)
    if ('instructions' in result) {
      expect(result.instructions).toContain('already active')
    }
  })

  it('returns error for unknown skill', () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    const result = sr.activate('nonexistent', tr)
    expect('error' in result).toBe(true)
  })

  it('builds catalog prompt with available skills', () => {
    const sr = new SkillRegistry()
    sr.addSkill(makeSkill('code-review'))
    sr.addSkill(makeSkill('test-writer'))

    const prompt = sr.buildCatalogPrompt()
    expect(prompt).toContain('code-review')
    expect(prompt).toContain('test-writer')
    expect(prompt).toContain('activate_skill')
  })

  it('catalog prompt marks activated skills', () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    sr.addSkill(makeSkill('review', ['analyze']))
    sr.activate('review', tr)

    const prompt = sr.buildCatalogPrompt()
    expect(prompt).toContain('(active)')
  })

  it('returns empty string for catalog when no skills', () => {
    const sr = new SkillRegistry()
    expect(sr.buildCatalogPrompt()).toBe('')
  })

  it('creates activate_skill meta-tool', async () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    sr.addSkill(makeSkill('review', ['analyze']))

    const tool = sr.createActivateSkillTool(tr)
    expect(tool.definition.name).toBe('activate_skill')

    const result = await tool.execute({ skill_name: 'review' })
    expect(result.isError).toBe(false)
    expect(result.output).toContain('activated')
    expect(tr.has('analyze')).toBe(true)
  })

  it('activate_skill tool returns error for unknown skill', async () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    const tool = sr.createActivateSkillTool(tr)
    const result = await tool.execute({ skill_name: 'nope' })
    expect(result.isError).toBe(true)
  })

  it('tracks size and activatedCount', () => {
    const sr = new SkillRegistry()
    const tr = new ToolRegistry()
    sr.addSkill(makeSkill('a', ['t1']))
    sr.addSkill(makeSkill('b', ['t2']))
    expect(sr.size).toBe(2)
    expect(sr.activatedCount).toBe(0)
    sr.activate('a', tr)
    expect(sr.activatedCount).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { ObservationalMemory } from '../../src/agent/observational-memory'
import { VirtualFS } from '../../src/fs/virtual-fs'
import { MockLLMEngine } from '../../src/llm/mock-engine'
import type { LLMMessage, TraceEvent } from '../../src/agent/types'

function makeLongMessages(count: number): LLMMessage[] {
  const msgs: LLMMessage[] = []
  for (let i = 0; i < count; i++) {
    msgs.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: [{ type: 'text', text: 'x'.repeat(200) }],
    })
  }
  return msgs
}

describe('ObservationalMemory', () => {
  it('shouldObserve returns false when below threshold', () => {
    const fs = new VirtualFS()
    const memory = new ObservationalMemory(fs, { observationThreshold: 1000 })
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    ]
    expect(memory.shouldObserve(messages)).toBe(false)
  })

  it('shouldObserve returns true when above threshold', () => {
    const fs = new VirtualFS()
    const memory = new ObservationalMemory(fs, { observationThreshold: 50 })
    const messages = makeLongMessages(6)
    expect(memory.shouldObserve(messages)).toBe(true)
  })

  it('observe extracts facts and stores in VirtualFS', async () => {
    const fs = new VirtualFS()
    const engine = new MockLLMEngine([
      {
        content: [{ type: 'text', text: '- User prefers TypeScript\n- Project uses React' }],
        stop_reason: 'end_turn',
      },
    ])
    const memory = new ObservationalMemory(fs, { observationThreshold: 10 })

    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'I prefer TypeScript and we use React' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Noted!' }] },
    ]

    const facts = await memory.observe(messages, engine)
    expect(facts).toHaveLength(2)
    expect(facts[0]!.fact).toBe('User prefers TypeScript')

    // Should be stored in VirtualFS
    expect(fs.exists('/.observations.json')).toBe(true)
    const stored = JSON.parse(fs.readFile('/.observations.json')!)
    expect(stored).toHaveLength(2)
  })

  it('incremental observation merges with existing', async () => {
    const fs = new VirtualFS()
    // Pre-populate with one existing fact
    fs.writeFile('/.observations.json', JSON.stringify([
      { fact: 'Existing fact', timestamp: 1000 },
    ]))

    const engine = new MockLLMEngine([
      {
        content: [{ type: 'text', text: '- New fact here' }],
        stop_reason: 'end_turn',
      },
    ])
    const memory = new ObservationalMemory(fs, { observationThreshold: 10 })

    await memory.observe(
      [{ role: 'user', content: [{ type: 'text', text: 'something' }] }],
      engine
    )

    const all = memory.getObservations()
    expect(all).toHaveLength(2)
    expect(all[0]!.fact).toBe('Existing fact')
    expect(all[1]!.fact).toBe('New fact here')
  })

  it('getObservationsForPrompt returns formatted string', () => {
    const fs = new VirtualFS()
    fs.writeFile('/.observations.json', JSON.stringify([
      { fact: 'User likes dark mode', timestamp: 1000 },
      { fact: 'Project uses Vite', timestamp: 2000 },
    ]))

    const memory = new ObservationalMemory(fs, { observationThreshold: 100 })
    const prompt = memory.getObservationsForPrompt()

    expect(prompt).toContain('Remembered Facts')
    expect(prompt).toContain('User likes dark mode')
    expect(prompt).toContain('Project uses Vite')
  })

  it('getObservationsForPrompt returns empty when no observations', () => {
    const fs = new VirtualFS()
    const memory = new ObservationalMemory(fs, { observationThreshold: 100 })
    expect(memory.getObservationsForPrompt()).toBe('')
  })

  it('observations survive VirtualFS persistence', () => {
    const fs = new VirtualFS()
    fs.writeFile('/.observations.json', JSON.stringify([
      { fact: 'persisted fact', timestamp: 1000 },
    ]))

    // Simulate a new ObservationalMemory instance reading from same FS
    const memory = new ObservationalMemory(fs, { observationThreshold: 100 })
    const obs = memory.getObservations()
    expect(obs).toHaveLength(1)
    expect(obs[0]!.fact).toBe('persisted fact')
  })

  it('run yields observation trace event', async () => {
    const fs = new VirtualFS()
    const engine = new MockLLMEngine([
      {
        content: [{ type: 'text', text: '- Important fact' }],
        stop_reason: 'end_turn',
      },
    ])

    const memory = new ObservationalMemory(fs, { observationThreshold: 10 })
    const messages = makeLongMessages(4)

    const events: TraceEvent[] = []
    const gen = memory.run(messages, engine)
    let result = await gen.next()
    while (!result.done) {
      events.push(result.value)
      result = await gen.next()
    }

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]!.type).toBe('observation')
  })
})

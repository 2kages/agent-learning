import type { LLMEngine, LLMMessage, TraceEvent } from './types'
import type { VirtualFS } from '../fs/virtual-fs'
import { totalTokens } from './token-counter'

const OBSERVATIONS_FILE = '/.observations.json'

export interface Observation {
  fact: string
  timestamp: number
}

export interface ObservationalMemoryOptions {
  /** Token count threshold above which observations are extracted */
  observationThreshold: number
  /** Path to store observations in VirtualFS */
  storagePath?: string
}

/**
 * Observational memory — a background note-taker from observational-memory.md.
 *
 * When the conversation grows past a threshold, it extracts key facts via
 * a side LLM call and stores them in the VirtualFS. These facts survive
 * compaction and are injected back into the system prompt.
 */
export class ObservationalMemory {
  private threshold: number
  private storagePath: string
  private fs: VirtualFS
  private lastObservedAt = 0

  constructor(fs: VirtualFS, options: ObservationalMemoryOptions) {
    this.fs = fs
    this.threshold = options.observationThreshold
    this.storagePath = options.storagePath ?? OBSERVATIONS_FILE
  }

  /** Check if we should run observation based on token count */
  shouldObserve(messages: LLMMessage[]): boolean {
    const tokens = totalTokens(messages)
    return tokens > this.threshold && tokens > this.lastObservedAt + this.threshold * 0.3
  }

  /**
   * Extract observations from recent conversation via LLM.
   * Stores them incrementally in VirtualFS.
   */
  async observe(messages: LLMMessage[], engine: LLMEngine): Promise<Observation[]> {
    const tokens = totalTokens(messages)
    this.lastObservedAt = tokens

    // Build conversation text for observation
    const recentMessages = messages.slice(-6) // observe recent context
    const conversationText = recentMessages
      .map(m => {
        const texts = m.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map(b => b.text)
          .join(' ')
        return `${m.role}: ${texts}`
      })
      .join('\n')

    // Ask LLM to extract key facts
    const response = await engine.chat(
      [{
        role: 'user',
        content: [{
          type: 'text',
          text: `Extract 2-3 key facts from this conversation that would be important to remember. Return each fact on its own line, prefixed with "- ".\n\n${conversationText}`,
        }],
      }],
      'You extract key facts from conversations. Be brief and factual.',
      []
    )

    const responseText = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    // Parse facts from response
    const newFacts: Observation[] = responseText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- '))
      .map(line => ({
        fact: line.slice(2).trim(),
        timestamp: Date.now(),
      }))

    // Merge with existing observations
    const existing = this.getObservations()
    const merged = [...existing, ...newFacts]

    // Store in VirtualFS
    this.fs.writeFile(this.storagePath, JSON.stringify(merged, null, 2))

    return newFacts
  }

  /** Get all stored observations */
  getObservations(): Observation[] {
    const content = this.fs.readFile(this.storagePath)
    if (!content) return []
    try {
      return JSON.parse(content) as Observation[]
    } catch {
      return []
    }
  }

  /**
   * Build the observations section to inject into the system prompt.
   * Returns empty string if no observations exist.
   */
  getObservationsForPrompt(): string {
    const observations = this.getObservations()
    if (observations.length === 0) return ''

    const facts = observations.map(o => `- ${o.fact}`).join('\n')

    return `## Remembered Facts

The following facts were observed during this conversation and should inform your responses:

${facts}`
  }

  /**
   * Run the observation pipeline.
   * Yields trace events when observations are extracted.
   */
  async *run(
    messages: LLMMessage[],
    engine: LLMEngine
  ): AsyncGenerator<TraceEvent, void> {
    if (!this.shouldObserve(messages)) return

    const newFacts = await this.observe(messages, engine)

    if (newFacts.length > 0) {
      yield {
        type: 'observation',
        facts: newFacts.map(f => f.fact),
      }
    }
  }
}

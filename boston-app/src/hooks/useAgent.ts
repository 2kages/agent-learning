import { useState, useCallback, useRef } from 'react'
import type { LLMEngine, TraceEvent } from '../agent/types'
import { runAgentLoop } from '../agent/agent-loop'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

/**
 * React hook that manages agent state: messages, trace events, running status.
 * Connects the async generator agent loop to React state.
 */
export function useAgent(engine: LLMEngine | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef(false)

  const sendMessage = useCallback(
    async (text: string) => {
      if (!engine || isRunning) return

      setMessages(prev => [...prev, { role: 'user', text }])
      setTraceEvents([])
      setIsRunning(true)
      abortRef.current = false

      try {
        const gen = runAgentLoop(text, { engine })
        let result = await gen.next()

        while (!result.done) {
          if (abortRef.current) break
          setTraceEvents(prev => [...prev, result.value as TraceEvent])
          result = await gen.next()
        }

        if (result.done && result.value) {
          setMessages(prev => [...prev, { role: 'assistant', text: result.value as string }])
        }
      } catch (err) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ])
      } finally {
        setIsRunning(false)
      }
    },
    [engine, isRunning]
  )

  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  return { messages, traceEvents, isRunning, sendMessage, abort }
}

import { useMemo } from 'react'
import { ModelStatus } from './ui/ModelStatus'
import { ChatPanel } from './ui/ChatPanel'
import { TracePanel } from './ui/TracePanel'
import { useAgent } from './hooks/useAgent'
import { MockLLMEngine } from './llm/mock-engine'
import type { LLMEngine } from './agent/types'

/**
 * Creates the appropriate LLM engine based on URL params.
 * ?mock=true → MockLLMEngine (for tests and demos)
 * Otherwise → null (WebLLM loaded later)
 */
function createEngine(): LLMEngine | null {
  const isMock = new URL(window.location.href).searchParams.has('mock')
  if (isMock) {
    // Mock engine with a simple echo response for demo/testing
    return new MockLLMEngine([]) as LLMEngine & { chat: MockLLMEngine['chat'] }
  }
  return null
}

/**
 * 3-panel layout: Chat (left), Trace (center), Files (right).
 * Panels are progressively filled in by each layer commit.
 */
export function App() {
  const engine = useMemo(createEngine, [])
  const { messages, traceEvents, isRunning, sendMessage } = useAgent(engine)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Boston Agent</h1>
        <ModelStatus />
      </header>
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ChatPanel messages={messages} onSend={sendMessage} isRunning={isRunning} />
        <TracePanel events={traceEvents} />
        <section data-testid="file-panel" style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <p style={{ color: '#888' }}>File explorer — Layer 1</p>
        </section>
      </main>
    </div>
  )
}

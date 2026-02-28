import { useMemo } from 'react'
import { ModelStatus } from './ui/ModelStatus'
import { ChatPanel } from './ui/ChatPanel'
import { TracePanel } from './ui/TracePanel'
import { FileExplorer } from './ui/FileExplorer'
import { useAgent } from './hooks/useAgent'
import { useVirtualFS } from './hooks/useVirtualFS'
import { MockLLMEngine } from './llm/mock-engine'
import { ToolRegistry } from './agent/tool-registry'
import { createFSTools } from './agent/tools/fs-tools'
import type { LLMEngine } from './agent/types'
import type { VirtualFS } from './fs/virtual-fs'

/**
 * Creates the appropriate LLM engine based on URL params.
 * ?mock=true → MockLLMEngine (for tests and demos)
 * Otherwise → null (WebLLM loaded later)
 */
function createEngine(): LLMEngine | null {
  const isMock = new URL(window.location.href).searchParams.has('mock')
  if (isMock) {
    return new MockLLMEngine([]) as LLMEngine & { chat: MockLLMEngine['chat'] }
  }
  return null
}

/**
 * Creates and populates a tool registry with VirtualFS tools.
 */
function createToolRegistry(fs: VirtualFS): ToolRegistry {
  const registry = new ToolRegistry()
  for (const tool of createFSTools(fs)) {
    registry.register(tool)
  }
  return registry
}

/**
 * 3-panel layout: Chat (left), Trace (center), Files (right).
 */
export function App() {
  const engine = useMemo(createEngine, [])
  const { fs, files } = useVirtualFS()
  const toolRegistry = useMemo(() => createToolRegistry(fs), [fs])
  const { messages, traceEvents, isRunning, sendMessage } = useAgent(engine, toolRegistry)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Boston Agent</h1>
        <ModelStatus />
      </header>
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ChatPanel messages={messages} onSend={sendMessage} isRunning={isRunning} />
        <TracePanel events={traceEvents} />
        <FileExplorer fs={fs} files={files} />
      </main>
    </div>
  )
}

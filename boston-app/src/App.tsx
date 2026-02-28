import { useMemo } from 'react'
import { ModelStatus } from './ui/ModelStatus'
import { ChatPanel } from './ui/ChatPanel'
import { TracePanel } from './ui/TracePanel'
import { FileExplorer } from './ui/FileExplorer'
import { useAgent } from './hooks/useAgent'
import { useVirtualFS } from './hooks/useVirtualFS'
import { useWebLLM } from './hooks/useWebLLM'
import { MockLLMEngine } from './llm/mock-engine'
import { ToolRegistry } from './agent/tool-registry'
import { createFSTools } from './agent/tools/fs-tools'
import type { LLMEngine } from './agent/types'
import type { VirtualFS } from './fs/virtual-fs'

const IS_MOCK = typeof window !== 'undefined' && new URL(window.location.href).searchParams.has('mock')

/**
 * Creates a mock engine that echoes messages back (for tests).
 */
function createMockEngine(): LLMEngine {
  // Mock engine that generates simple responses
  return new MockLLMEngine([]) as LLMEngine
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
  const { fs, files } = useVirtualFS()
  const toolRegistry = useMemo(() => createToolRegistry(fs), [fs])
  const webLLM = useWebLLM()

  // In mock mode, use MockEngine. Otherwise, use WebLLM engine (null until loaded).
  const mockEngine = useMemo(() => IS_MOCK ? createMockEngine() : null, [])
  const activeEngine = IS_MOCK ? mockEngine : webLLM.engine

  const { messages, traceEvents, isRunning, sendMessage } = useAgent(activeEngine, toolRegistry)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Boston Agent</h1>
        <ModelStatus
          status={webLLM.status}
          progress={webLLM.progress}
          statusText={webLLM.statusText}
          error={webLLM.error}
          isMock={IS_MOCK}
          onLoad={webLLM.loadModel}
        />
      </header>
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ChatPanel messages={messages} onSend={sendMessage} isRunning={isRunning} engineReady={IS_MOCK || activeEngine !== null} />
        <TracePanel events={traceEvents} />
        <FileExplorer fs={fs} files={files} />
      </main>
    </div>
  )
}

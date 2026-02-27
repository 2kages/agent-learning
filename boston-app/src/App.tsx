import { ModelStatus } from './ui/ModelStatus'

/**
 * 3-panel layout: Chat (left), Trace (center), Files (right).
 * Panels are progressively filled in by each layer commit.
 */
export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Boston Agent</h1>
        <ModelStatus />
      </header>
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <section data-testid="chat-panel" style={{ flex: 1, borderRight: '1px solid #e0e0e0', padding: 16, overflow: 'auto' }}>
          <p style={{ color: '#888' }}>Chat panel — Layer 0</p>
        </section>
        <section data-testid="trace-panel" style={{ flex: 1, borderRight: '1px solid #e0e0e0', padding: 16, overflow: 'auto' }}>
          <p style={{ color: '#888' }}>Trace panel — Layer 0</p>
        </section>
        <section data-testid="file-panel" style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <p style={{ color: '#888' }}>File explorer — Layer 1</p>
        </section>
      </main>
    </div>
  )
}

import type { TraceEvent } from '../agent/types'
import { TraceEntry } from './TraceEntry'

interface TracePanelProps {
  events: TraceEvent[]
}

/**
 * Displays all trace events from the agent loop.
 */
export function TracePanel({ events }: TracePanelProps) {
  return (
    <div data-testid="trace-panel" style={{ flex: 1, borderRight: '1px solid #e0e0e0', padding: 16, overflow: 'auto' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>
        Trace ({events.length} events)
      </h3>
      {events.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Send a message to see trace events</p>
      ) : (
        events.map((event, i) => <TraceEntry key={i} event={event} index={i} />)
      )}
    </div>
  )
}

import type { TraceEvent } from '../agent/types'

interface TraceEntryProps {
  event: TraceEvent
  index: number
}

const EVENT_COLORS: Record<TraceEvent['type'], string> = {
  loop_start: '#6b7280',
  loop_end: '#6b7280',
  llm_call: '#3b82f6',
  llm_response: '#3b82f6',
  tool_call: '#eab308',
  tool_result: '#22c55e',
  error: '#ef4444',
}

/**
 * Renders a single trace event in the trace panel.
 */
export function TraceEntry({ event, index }: TraceEntryProps) {
  const color = EVENT_COLORS[event.type]

  let detail = ''
  switch (event.type) {
    case 'loop_start':
      detail = 'Agent loop started'
      break
    case 'loop_end':
      detail = 'Agent loop ended'
      break
    case 'llm_call':
      detail = `LLM call (${event.messages.length} messages)`
      break
    case 'llm_response':
      detail = `LLM responded (${event.response.stop_reason})`
      break
    case 'tool_call':
      detail = `Tool: ${event.name}(${JSON.stringify(event.input)})`
      break
    case 'tool_result':
      detail = `Result: ${event.output.slice(0, 100)}${event.output.length > 100 ? '...' : ''}`
      break
    case 'error':
      detail = event.message
      break
  }

  return (
    <div
      data-testid="trace-entry"
      style={{
        padding: '4px 8px',
        fontSize: 12,
        fontFamily: 'monospace',
        borderLeft: `3px solid ${color}`,
        marginBottom: 4,
        backgroundColor: '#fafafa',
      }}
    >
      <span style={{ color: '#9ca3af', marginRight: 8 }}>#{index}</span>
      <span style={{ color, fontWeight: 600 }}>{event.type}</span>
      <span style={{ color: '#6b7280', marginLeft: 8 }}>{detail}</span>
    </div>
  )
}

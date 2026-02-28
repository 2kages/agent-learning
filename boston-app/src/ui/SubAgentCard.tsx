interface SubAgentCardProps {
  id: string
  goal: string
  output?: string
  isError?: boolean
  isRunning: boolean
}

/**
 * Displays a sub-agent's status in the trace panel.
 */
export function SubAgentCard({ id, goal, output, isError, isRunning }: SubAgentCardProps) {
  const borderColor = isError ? '#ef4444' : isRunning ? '#a855f7' : '#22c55e'

  return (
    <div
      data-testid="sub-agent-card"
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#faf5ff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: borderColor,
          display: 'inline-block',
          animation: isRunning ? 'pulse 1.5s infinite' : 'none',
        }} />
        <strong style={{ fontSize: 13 }}>Sub-agent {id}</strong>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {goal}
      </div>
      {output && (
        <div style={{
          fontSize: 12,
          fontFamily: 'monospace',
          backgroundColor: '#f3f4f6',
          padding: 8,
          borderRadius: 4,
          color: isError ? '#ef4444' : '#1f2937',
          maxHeight: 100,
          overflow: 'auto',
        }}>
          {output}
        </div>
      )}
    </div>
  )
}

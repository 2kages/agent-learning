import { useState } from 'react'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const STATUS_COLORS: Record<Status, string> = {
  idle: '#888',
  loading: '#f59e0b',
  ready: '#22c55e',
  error: '#ef4444',
}

const STATUS_LABELS: Record<Status, string> = {
  idle: 'Not loaded',
  loading: 'Loading model...',
  ready: 'Model ready',
  error: 'Load failed',
}

/**
 * Shows current WebLLM model loading status.
 * In mock mode (?mock=true), shows "Mock mode" immediately.
 */
export function ModelStatus() {
  const isMock = typeof window !== 'undefined' && new URL(window.location.href).searchParams.has('mock')
  const [status] = useState<Status>(isMock ? 'ready' : 'idle')

  const label = isMock ? 'Mock mode' : STATUS_LABELS[status]
  const color = isMock ? '#8b5cf6' : STATUS_COLORS[status]

  return (
    <span
      data-testid="model-status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        color,
        fontWeight: 500,
      }}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
      }} />
      {label}
    </span>
  )
}

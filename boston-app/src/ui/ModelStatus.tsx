import type { ModelStatus as Status } from '../hooks/useWebLLM'

interface ModelStatusProps {
  status: Status
  progress: number
  statusText: string
  error: string | null
  isMock: boolean
  onLoad: () => void
}

const STATUS_COLORS: Record<Status, string> = {
  idle: '#888',
  loading: '#f59e0b',
  ready: '#22c55e',
  error: '#ef4444',
}

/**
 * Shows current WebLLM model loading status with a load button.
 */
export function ModelStatus({ status, progress, statusText, error, isMock, onLoad }: ModelStatusProps) {
  if (isMock) {
    return (
      <span
        data-testid="model-status"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8b5cf6', fontWeight: 500 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
        Mock mode
      </span>
    )
  }

  const color = STATUS_COLORS[status]

  return (
    <span
      data-testid="model-status"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
      {status === 'idle' && (
        <button
          data-testid="load-model-btn"
          onClick={onLoad}
          style={{
            padding: '4px 12px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Load Model
        </button>
      )}
      {status === 'loading' && (
        <span style={{ color }}>
          Loading... {Math.round(progress * 100)}%
          <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>{statusText}</span>
        </span>
      )}
      {status === 'ready' && (
        <span style={{ color }}>Model ready</span>
      )}
      {status === 'error' && (
        <span style={{ color }}>
          {error ?? 'Load failed'}
          <button
            onClick={onLoad}
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </span>
      )}
    </span>
  )
}

import { useState, useCallback, useRef } from 'react'
import { WebLLMEngine } from '../llm/webllm-engine'
import { MODEL_ID } from '../lib/constants'
import type { LLMEngine } from '../agent/types'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface WebLLMState {
  engine: LLMEngine | null
  status: ModelStatus
  progress: number
  statusText: string
  error: string | null
  loadModel: () => Promise<void>
}

/**
 * Hook that manages WebLLM model lifecycle:
 * - Checks WebGPU availability
 * - Downloads and loads the model with progress tracking
 * - Returns a ready-to-use LLMEngine
 */
export function useWebLLM(): WebLLMState {
  const [engine, setEngine] = useState<LLMEngine | null>(null)
  const [status, setStatus] = useState<ModelStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const loadModel = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true

    // Check WebGPU
    if (!navigator.gpu) {
      setStatus('error')
      setError('WebGPU not available. Use Chrome 113+ with WebGPU enabled.')
      loadingRef.current = false
      return
    }

    setStatus('loading')
    setProgress(0)
    setStatusText('Initializing...')
    setError(null)

    try {
      // Dynamic import to avoid bundling WebLLM when not needed
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')

      const mlcEngine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          setProgress(report.progress)
          setStatusText(report.text)
        },
      })

      const wrappedEngine = new WebLLMEngine(mlcEngine)
      setEngine(wrappedEngine)
      setStatus('ready')
      setStatusText('Model ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setError(msg)
      setStatusText(`Load failed: ${msg}`)
    } finally {
      loadingRef.current = false
    }
  }, [])

  return { engine, status, progress, statusText, error, loadModel }
}

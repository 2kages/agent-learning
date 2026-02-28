import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isRunning: boolean
  engineReady?: boolean
}

/**
 * Chat panel with message history and input form.
 */
export function ChatPanel({ messages, onSend, isRunning, engineReady = true }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isRunning || !engineReady) return
    setInput('')
    onSend(text)
  }

  return (
    <div data-testid="chat-panel" style={{ flex: 1, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} text={m.text} />
        ))}
        {isRunning && (
          <div style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
            Agent is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '8px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8 }}>
        <input
          data-testid="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={engineReady ? 'Type a message...' : 'Load model first...'}
          disabled={isRunning || !engineReady}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          data-testid="send-button"
          type="submit"
          disabled={isRunning || !input.trim() || !engineReady}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: isRunning || !engineReady ? 'not-allowed' : 'pointer',
            opacity: isRunning || !input.trim() || !engineReady ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}

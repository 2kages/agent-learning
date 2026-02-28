interface MessageBubbleProps {
  role: 'user' | 'assistant'
  text: string
}

/**
 * Renders a single chat message bubble.
 * User messages right-aligned, assistant messages left-aligned.
 */
export function MessageBubble({ role, text }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div
      data-testid={`message-${role}`}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 12,
          backgroundColor: isUser ? '#2563eb' : '#f3f4f6',
          color: isUser ? 'white' : '#1f2937',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </div>
    </div>
  )
}

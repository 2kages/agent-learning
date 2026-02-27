/**
 * Minimal typed event emitter for trace events.
 */
export class EventEmitter<T> {
  private listeners = new Set<(event: T) => void>()

  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: T): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  removeAll(): void {
    this.listeners.clear()
  }
}

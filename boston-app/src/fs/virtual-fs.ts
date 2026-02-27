/**
 * In-memory virtual file system backed by a Map.
 * Used instead of real FS for browser-based agent demos.
 * Fires onChange listeners on every mutation.
 */
export type FSListener = (event: FSEvent) => void

export type FSEvent =
  | { type: 'write'; path: string; content: string }
  | { type: 'delete'; path: string }

export class VirtualFS {
  private files = new Map<string, string>()
  private listeners = new Set<FSListener>()

  /** Write or overwrite a file */
  writeFile(path: string, content: string): void {
    this.files.set(path, content)
    this.emit({ type: 'write', path, content })
  }

  /** Read a file. Returns null if not found. */
  readFile(path: string): string | null {
    return this.files.get(path) ?? null
  }

  /** Delete a file. Returns true if it existed. */
  deleteFile(path: string): boolean {
    const existed = this.files.delete(path)
    if (existed) this.emit({ type: 'delete', path })
    return existed
  }

  /** Check if a file exists */
  exists(path: string): boolean {
    return this.files.has(path)
  }

  /** List all file paths, optionally filtered by prefix */
  listFiles(prefix = ''): string[] {
    const paths = [...this.files.keys()]
    if (!prefix) return paths.sort()
    return paths.filter(p => p.startsWith(prefix)).sort()
  }

  /** Search files for content matching a query string */
  searchFiles(query: string): Array<{ path: string; matches: string[] }> {
    const results: Array<{ path: string; matches: string[] }> = []
    for (const [path, content] of this.files) {
      const lines = content.split('\n')
      const matches = lines.filter(line =>
        line.toLowerCase().includes(query.toLowerCase())
      )
      if (matches.length > 0) {
        results.push({ path, matches })
      }
    }
    return results
  }

  /** Get total number of files */
  get size(): number {
    return this.files.size
  }

  /** Subscribe to file system changes */
  onChange(listener: FSListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Get a snapshot of all files (for serialization) */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files)
  }

  /** Load from a snapshot */
  loadSnapshot(data: Record<string, string>): void {
    this.files.clear()
    for (const [path, content] of Object.entries(data)) {
      this.files.set(path, content)
    }
  }

  private emit(event: FSEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

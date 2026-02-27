import { describe, it, expect, vi } from 'vitest'
import { VirtualFS } from '../../src/fs/virtual-fs'

describe('VirtualFS', () => {
  it('writes and reads a file', () => {
    const fs = new VirtualFS()
    fs.writeFile('/hello.txt', 'world')
    expect(fs.readFile('/hello.txt')).toBe('world')
  })

  it('returns null for missing files', () => {
    const fs = new VirtualFS()
    expect(fs.readFile('/nope')).toBeNull()
  })

  it('overwrites existing files', () => {
    const fs = new VirtualFS()
    fs.writeFile('/a.txt', 'v1')
    fs.writeFile('/a.txt', 'v2')
    expect(fs.readFile('/a.txt')).toBe('v2')
  })

  it('deletes files', () => {
    const fs = new VirtualFS()
    fs.writeFile('/a.txt', 'content')
    expect(fs.deleteFile('/a.txt')).toBe(true)
    expect(fs.readFile('/a.txt')).toBeNull()
    expect(fs.deleteFile('/a.txt')).toBe(false)
  })

  it('checks existence', () => {
    const fs = new VirtualFS()
    expect(fs.exists('/a.txt')).toBe(false)
    fs.writeFile('/a.txt', '')
    expect(fs.exists('/a.txt')).toBe(true)
  })

  it('lists files sorted alphabetically', () => {
    const fs = new VirtualFS()
    fs.writeFile('/c.txt', '')
    fs.writeFile('/a.txt', '')
    fs.writeFile('/b.txt', '')
    expect(fs.listFiles()).toEqual(['/a.txt', '/b.txt', '/c.txt'])
  })

  it('lists files with prefix filter', () => {
    const fs = new VirtualFS()
    fs.writeFile('/src/a.ts', '')
    fs.writeFile('/src/b.ts', '')
    fs.writeFile('/README.md', '')
    expect(fs.listFiles('/src')).toEqual(['/src/a.ts', '/src/b.ts'])
  })

  it('searches files case-insensitively', () => {
    const fs = new VirtualFS()
    fs.writeFile('/a.ts', 'Hello World\nfoo bar')
    fs.writeFile('/b.ts', 'nothing here')
    const results = fs.searchFiles('hello')
    expect(results).toEqual([
      { path: '/a.ts', matches: ['Hello World'] },
    ])
  })

  it('tracks size', () => {
    const fs = new VirtualFS()
    expect(fs.size).toBe(0)
    fs.writeFile('/a', '')
    fs.writeFile('/b', '')
    expect(fs.size).toBe(2)
    fs.deleteFile('/a')
    expect(fs.size).toBe(1)
  })

  it('fires onChange on write', () => {
    const fs = new VirtualFS()
    const listener = vi.fn()
    fs.onChange(listener)
    fs.writeFile('/test.txt', 'content')
    expect(listener).toHaveBeenCalledWith({
      type: 'write',
      path: '/test.txt',
      content: 'content',
    })
  })

  it('fires onChange on delete', () => {
    const fs = new VirtualFS()
    fs.writeFile('/test.txt', '')
    const listener = vi.fn()
    fs.onChange(listener)
    fs.deleteFile('/test.txt')
    expect(listener).toHaveBeenCalledWith({
      type: 'delete',
      path: '/test.txt',
    })
  })

  it('unsubscribes onChange', () => {
    const fs = new VirtualFS()
    const listener = vi.fn()
    const unsub = fs.onChange(listener)
    unsub()
    fs.writeFile('/test.txt', 'x')
    expect(listener).not.toHaveBeenCalled()
  })

  it('snapshots and restores', () => {
    const fs = new VirtualFS()
    fs.writeFile('/a', 'one')
    fs.writeFile('/b', 'two')
    const snap = fs.snapshot()
    expect(snap).toEqual({ '/a': 'one', '/b': 'two' })

    const fs2 = new VirtualFS()
    fs2.loadSnapshot(snap)
    expect(fs2.readFile('/a')).toBe('one')
    expect(fs2.readFile('/b')).toBe('two')
  })
})

import { describe, it, expect } from 'vitest'
import { VirtualFS } from '../../src/fs/virtual-fs'
import { createFSTools } from '../../src/agent/tools/fs-tools'
import { ToolRegistry } from '../../src/agent/tool-registry'

function setup() {
  const fs = new VirtualFS()
  const registry = new ToolRegistry()
  for (const tool of createFSTools(fs)) {
    registry.register(tool)
  }
  return { fs, registry }
}

describe('FS Tools', () => {
  it('write_file creates a file', async () => {
    const { fs, registry } = setup()
    const result = await registry.execute('write_file', { path: '/test.txt', content: 'hello' })
    expect(result.isError).toBe(false)
    expect(fs.readFile('/test.txt')).toBe('hello')
  })

  it('read_file reads existing file', async () => {
    const { fs, registry } = setup()
    fs.writeFile('/test.txt', 'content here')
    const result = await registry.execute('read_file', { path: '/test.txt' })
    expect(result.isError).toBe(false)
    expect(result.output).toBe('content here')
  })

  it('read_file returns error for missing file', async () => {
    const { registry } = setup()
    const result = await registry.execute('read_file', { path: '/nope.txt' })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('not found')
  })

  it('list_files returns all files', async () => {
    const { fs, registry } = setup()
    fs.writeFile('/a.txt', '')
    fs.writeFile('/b.txt', '')
    const result = await registry.execute('list_files', {})
    expect(result.isError).toBe(false)
    expect(result.output).toContain('/a.txt')
    expect(result.output).toContain('/b.txt')
  })

  it('list_files with prefix filter', async () => {
    const { fs, registry } = setup()
    fs.writeFile('/src/main.ts', '')
    fs.writeFile('/README.md', '')
    const result = await registry.execute('list_files', { prefix: '/src' })
    expect(result.output).toContain('/src/main.ts')
    expect(result.output).not.toContain('README')
  })

  it('list_files returns message when empty', async () => {
    const { registry } = setup()
    const result = await registry.execute('list_files', {})
    expect(result.output).toContain('No files')
  })

  it('search_files finds matching lines', async () => {
    const { fs, registry } = setup()
    fs.writeFile('/code.ts', 'function hello() {\n  return "world"\n}')
    const result = await registry.execute('search_files', { query: 'hello' })
    expect(result.isError).toBe(false)
    expect(result.output).toContain('function hello')
  })

  it('search_files returns no matches message', async () => {
    const { fs, registry } = setup()
    fs.writeFile('/code.ts', 'nothing relevant')
    const result = await registry.execute('search_files', { query: 'xyzzy' })
    expect(result.output).toContain('No matches')
  })
})

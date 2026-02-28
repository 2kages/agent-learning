import { describe, it, expect } from 'vitest'
import { CodeSandbox, createExecuteCodeTool, getCodeModeTools } from '../../src/agent/code-mode'
import { VirtualFS } from '../../src/fs/virtual-fs'

describe('CodeSandbox', () => {
  it('executes simple code', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('api.log("hello")')
    expect(result.output).toBe('hello')
    expect(result.isError).toBe(false)
  })

  it('api.fs.writeFile creates a file', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    await sandbox.execute('api.fs.writeFile("/test.txt", "hello world")')
    expect(fs.readFile('/test.txt')).toBe('hello world')
  })

  it('api.fs.readFile reads a file', async () => {
    const fs = new VirtualFS()
    fs.writeFile('/test.txt', 'content')
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('api.log(api.fs.readFile("/test.txt"))')
    expect(result.output).toBe('content')
  })

  it('api.fs.listFiles lists files', async () => {
    const fs = new VirtualFS()
    fs.writeFile('/a.txt', '')
    fs.writeFile('/b.txt', '')
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('api.log(JSON.stringify(api.fs.listFiles()))')
    expect(JSON.parse(result.output)).toEqual(['/a.txt', '/b.txt'])
  })

  it('api.fs.searchFiles searches files', async () => {
    const fs = new VirtualFS()
    fs.writeFile('/code.ts', 'function hello() {}')
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('api.log(JSON.stringify(api.fs.searchFiles("hello")))')
    const parsed = JSON.parse(result.output)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('/code.ts')
  })

  it('api.fs.deleteFile deletes a file', async () => {
    const fs = new VirtualFS()
    fs.writeFile('/test.txt', 'x')
    const sandbox = new CodeSandbox(fs)
    await sandbox.execute('api.fs.deleteFile("/test.txt")')
    expect(fs.exists('/test.txt')).toBe(false)
  })

  it('catches execution errors', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('throw new Error("boom")')
    expect(result.isError).toBe(true)
    expect(result.output).toContain('boom')
  })

  it('api.log captures multiple calls', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute(`
      api.log("line 1")
      api.log("line 2")
      api.log("line 3")
    `)
    expect(result.output).toBe('line 1\nline 2\nline 3')
    expect(result.logs).toEqual(['line 1', 'line 2', 'line 3'])
  })

  it('returns JSON of return value when no logs', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('return { a: 1 }')
    expect(result.output).toBe('{"a":1}')
  })

  it('returns success message when no output and no return', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const result = await sandbox.execute('const x = 1')
    expect(result.output).toContain('successfully')
  })
})

describe('createExecuteCodeTool', () => {
  it('creates a tool that executes code', async () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const tool = createExecuteCodeTool(sandbox)

    expect(tool.definition.name).toBe('execute_code')
    const result = await tool.execute({ code: 'api.log("works")' })
    expect(result.output).toBe('works')
    expect(result.isError).toBe(false)
  })
})

describe('getCodeModeTools', () => {
  it('returns only one tool definition', () => {
    const fs = new VirtualFS()
    const sandbox = new CodeSandbox(fs)
    const tools = getCodeModeTools(sandbox)
    expect(tools).toHaveLength(1)
    expect(tools[0]!.name).toBe('execute_code')
  })
})

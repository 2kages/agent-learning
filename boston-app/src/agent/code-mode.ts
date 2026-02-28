import type { Tool, ToolDefinition } from './types'
import type { VirtualFS } from '../fs/virtual-fs'

/**
 * API object exposed inside the code sandbox.
 * Gives executed code access to the virtual file system and logging.
 */
export interface SandboxAPI {
  fs: {
    readFile: (path: string) => string | null
    writeFile: (path: string, content: string) => void
    listFiles: (prefix?: string) => string[]
    searchFiles: (query: string) => Array<{ path: string; matches: string[] }>
    deleteFile: (path: string) => boolean
  }
  log: (...args: unknown[]) => void
}

/**
 * Code sandbox that executes JavaScript strings with an injected API object.
 * Implements code mode from code-mode.md: replace N tools with 1 execute_code tool.
 */
export class CodeSandbox {
  private virtualFS: VirtualFS
  private logs: string[] = []

  constructor(fs: VirtualFS) {
    this.virtualFS = fs
  }

  /**
   * Execute a JavaScript code string in a sandboxed context.
   * The code has access to an `api` object with fs and log methods.
   */
  async execute(code: string): Promise<{ output: string; logs: string[]; isError: boolean }> {
    this.logs = []

    const api: SandboxAPI = {
      fs: {
        readFile: (path: string) => this.virtualFS.readFile(path),
        writeFile: (path: string, content: string) => this.virtualFS.writeFile(path, content),
        listFiles: (prefix?: string) => this.virtualFS.listFiles(prefix),
        searchFiles: (query: string) => this.virtualFS.searchFiles(query),
        deleteFile: (path: string) => this.virtualFS.deleteFile(path),
      },
      log: (...args: unknown[]) => {
        this.logs.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '))
      },
    }

    try {
      // Create an async function with `api` in scope
      const fn = new Function('api', `return (async () => {\n${code}\n})()`)
      const result = await fn(api)

      const output = this.logs.length > 0
        ? this.logs.join('\n')
        : result !== undefined
          ? JSON.stringify(result)
          : 'Code executed successfully (no output)'

      return { output, logs: [...this.logs], isError: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        output: `Error: ${message}`,
        logs: [...this.logs],
        isError: true,
      }
    }
  }

  /** Get the last execution's logs */
  getLastLogs(): string[] {
    return [...this.logs]
  }
}

/**
 * Create the execute_code tool definition.
 */
export function createExecuteCodeTool(sandbox: CodeSandbox): Tool {
  return {
    definition: {
      name: 'execute_code',
      description: `Execute JavaScript code with access to the virtual file system API.

Available API:
  api.fs.readFile(path) → string | null
  api.fs.writeFile(path, content) → void
  api.fs.listFiles(prefix?) → string[]
  api.fs.searchFiles(query) → Array<{path, matches}>
  api.fs.deleteFile(path) → boolean
  api.log(...args) → void (captures output)

The code runs as an async function. Use api.log() to produce output.`,
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
        },
        required: ['code'],
      },
    },
    async execute(input) {
      const code = input.code as string
      const result = await sandbox.execute(code)
      return { output: result.output, isError: result.isError }
    },
  }
}

/**
 * Get the code mode system prompt addition.
 * Explains the API to the LLM.
 */
export const CODE_MODE_PROMPT = `## Code Mode

You have access to a single \`execute_code\` tool. Instead of calling individual tools, write JavaScript code that uses the \`api\` object:

\`\`\`javascript
// Read a file
const content = api.fs.readFile('/path/to/file')

// Write a file
api.fs.writeFile('/path/to/file', 'content')

// List files
const files = api.fs.listFiles('/src')

// Search files
const results = api.fs.searchFiles('pattern')

// Delete a file
api.fs.deleteFile('/path/to/file')

// Log output (will be returned as the tool result)
api.log('result:', someValue)
\`\`\`

You can chain multiple operations in a single execute_code call to reduce round trips.`

/**
 * Get the tool definitions for code mode.
 * Returns only the execute_code tool (replacing all individual tools).
 */
export function getCodeModeTools(sandbox: CodeSandbox): ToolDefinition[] {
  return [createExecuteCodeTool(sandbox).definition]
}

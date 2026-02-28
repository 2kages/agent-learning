import type { Tool } from '../types'
import type { VirtualFS } from '../../fs/virtual-fs'

/**
 * Creates the 4 VirtualFS tools: read_file, write_file, list_files, search_files.
 * Each tool wraps the VirtualFS instance for in-browser file operations.
 */
export function createFSTools(fs: VirtualFS): Tool[] {
  const readFile: Tool = {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file path to read' },
        },
        required: ['path'],
      },
    },
    async execute(input) {
      const path = input.path as string
      const content = fs.readFile(path)
      if (content === null) {
        return { output: `File not found: ${path}`, isError: true }
      }
      return { output: content, isError: false }
    },
  }

  const writeFile: Tool = {
    definition: {
      name: 'write_file',
      description: 'Write content to a file at the given path. Creates or overwrites.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file path to write' },
          content: { type: 'string', description: 'The file content' },
        },
        required: ['path', 'content'],
      },
    },
    async execute(input) {
      const path = input.path as string
      const content = input.content as string
      fs.writeFile(path, content)
      return { output: `File written: ${path}`, isError: false }
    },
  }

  const listFiles: Tool = {
    definition: {
      name: 'list_files',
      description: 'List all files in the virtual file system. Optionally filter by prefix.',
      input_schema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Optional path prefix filter' },
        },
      },
    },
    async execute(input) {
      const prefix = (input.prefix as string) || ''
      const files = fs.listFiles(prefix)
      if (files.length === 0) {
        return { output: 'No files found.', isError: false }
      }
      return { output: files.join('\n'), isError: false }
    },
  }

  const searchFiles: Tool = {
    definition: {
      name: 'search_files',
      description: 'Search all files for lines matching a query string (case-insensitive).',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
    async execute(input) {
      const query = input.query as string
      const results = fs.searchFiles(query)
      if (results.length === 0) {
        return { output: 'No matches found.', isError: false }
      }
      const formatted = results
        .map(r => `${r.path}:\n${r.matches.map(m => `  ${m}`).join('\n')}`)
        .join('\n')
      return { output: formatted, isError: false }
    },
  }

  return [readFile, writeFile, listFiles, searchFiles]
}

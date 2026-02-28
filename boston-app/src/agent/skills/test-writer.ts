import type { SkillDefinition } from '../progressive-discovery'
import type { VirtualFS } from '../../fs/virtual-fs'

/**
 * Test writer skill — adds tools for generating test files.
 */
export function createTestWriterSkill(fs: VirtualFS): SkillDefinition {
  return {
    name: 'test-writer',
    description: 'Generate unit tests for source files',
    instructions: `## Test Writing Guidelines

When writing tests:
1. Test both happy path and edge cases
2. Use descriptive test names that explain the expected behavior
3. Keep tests focused — one assertion per test when possible
4. Mock external dependencies
5. Use the generate_test_scaffold tool to create a starting point

Write test files with the .test.ts extension alongside the source file.`,
    tools: [
      {
        definition: {
          name: 'generate_test_scaffold',
          description: 'Generate a test scaffold for a source file.',
          input_schema: {
            type: 'object',
            properties: {
              source_path: { type: 'string', description: 'Path to the source file' },
            },
            required: ['source_path'],
          },
        },
        async execute(input) {
          const sourcePath = input.source_path as string
          const content = fs.readFile(sourcePath)
          if (!content) {
            return { output: `File not found: ${sourcePath}`, isError: true }
          }
          const testPath = sourcePath.replace(/\.ts$/, '.test.ts')
          const scaffold = `import { describe, it, expect } from 'vitest'\n\ndescribe('${sourcePath}', () => {\n  it('should work', () => {\n    // TODO: implement test\n    expect(true).toBe(true)\n  })\n})\n`
          return {
            output: JSON.stringify({ testPath, scaffold }),
            isError: false,
          }
        },
      },
    ],
  }
}

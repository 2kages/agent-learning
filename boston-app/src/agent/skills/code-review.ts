import type { SkillDefinition } from '../progressive-discovery'
import type { VirtualFS } from '../../fs/virtual-fs'

/**
 * Code review skill — adds tools for analyzing code quality.
 */
export function createCodeReviewSkill(fs: VirtualFS): SkillDefinition {
  return {
    name: 'code-review',
    description: 'Analyze code for bugs, style issues, and improvements',
    instructions: `## Code Review Guidelines

When reviewing code:
1. Check for common bugs (null checks, off-by-one errors, race conditions)
2. Evaluate naming clarity and consistency
3. Look for code duplication opportunities
4. Assess error handling completeness
5. Suggest specific improvements with examples

Use the analyze_file tool to get a structured analysis of a file.`,
    tools: [
      {
        definition: {
          name: 'analyze_file',
          description: 'Analyze a file for code quality issues. Returns a structured review.',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path to analyze' },
            },
            required: ['path'],
          },
        },
        async execute(input) {
          const path = input.path as string
          const content = fs.readFile(path)
          if (!content) {
            return { output: `File not found: ${path}`, isError: true }
          }
          const lines = content.split('\n').length
          return {
            output: JSON.stringify({
              path,
              lines,
              analysis: `File has ${lines} lines. Review the content for potential issues.`,
            }),
            isError: false,
          }
        },
      },
    ],
  }
}

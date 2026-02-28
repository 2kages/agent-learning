# Module 1: Giving Your Agent Hands — Tools

> **Time:** ~60 minutes
> **Prerequisites:** Complete [Module 0: The Loop](./module-0-the-loop.md)
> **What you'll build:** A tool registry and tools that let your agent read/write files
> **Key files:** `boston-app/src/agent/tool-registry.ts`, `boston-app/src/agent/tools/fs-tools.ts`

---

## Part 1: The Problem (5 min)

At the end of Module 0, you built a loop that calls the AI repeatedly. But the AI still can't DO anything. If you ask "What's in my package.json?" it can only say "I don't have access to your files."

```
You:    "What's in my package.json?"
Agent:  "I'm sorry, I can't access your files."   ← Useless!
```

The AI is a **brain in a jar**. It can think brilliantly, but it has no hands.

### The key question

How do you give a text-only machine the ability to act on the real world?

---

## Part 2: The Concept (15 min)

### It's All Just Text

Here's the most important insight in this entire course:

> **The LLM does not "call" tools. It outputs structured text. YOUR code reads that text and decides what to do.**

The LLM never touches your file system. It never runs a command. It writes a JSON message that says "I would like to read this file," and your code is what actually reads the file.

### The 5-Step Dance

```
Step 1: YOU describe available tools as JSON
        "There's a tool called 'read_file' that takes a 'path' argument"

Step 2: THE LLM outputs a tool request
        { name: "read_file", input: { path: "package.json" } }

Step 3: YOUR CODE parses that request
        "Oh, it wants to read package.json"

Step 4: YOUR CODE executes the real function
        fs.readFileSync("package.json", "utf-8")

Step 5: YOUR CODE sends the result back as text
        { tool_result: '{ "version": "1.0.0" }' }
```

Then the loop continues — the AI sees the file contents and decides what to do next.

### What a Tool Looks Like in Code

Every tool has two parts:

```typescript
const readFileTool = {
  // PART 1: The definition — tells the LLM what this tool does
  definition: {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to read' }
      },
      required: ['path']
    }
  },

  // PART 2: The function — what actually runs when the tool is called
  execute: async (input) => {
    const content = fs.readFileSync(input.path, 'utf-8')
    return { output: content, isError: false }
  }
}
```

The LLM only sees Part 1 (the definition). Part 2 (the execute function) is YOUR code that runs on YOUR machine.

### The Tool Registry

Instead of hard-coding tools, we use a **registry** — a Map that stores tools by name:

```typescript
class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool)
  }

  execute(name: string, input: object): Promise<ToolResult> {
    const tool = this.tools.get(name)
    return tool.execute(input)
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map(t => t.definition)
  }
}
```

Why a registry?
- Easy to add/remove tools
- Definitions are sorted alphabetically (important for caching — Module 3)
- Centralized error handling

### How the API Actually Works

When you call the Claude or OpenAI API, you send tools as a parameter:

```typescript
const response = await api.chat({
  messages: [...],              // The conversation
  system: "You are a...",      // System prompt
  tools: [                      // Available tools
    {
      name: 'read_file',
      description: '...',
      input_schema: { ... }
    },
    {
      name: 'write_file',
      description: '...',
      input_schema: { ... }
    }
  ]
})
```

The API reads the tool definitions and gives the LLM the ability to request them. When the LLM wants a tool, its response contains:

```json
{
  "content": [
    { "type": "text", "text": "I'll read that file for you." },
    { "type": "tool_use", "id": "tc_123", "name": "read_file", "input": { "path": "package.json" } }
  ],
  "stop_reason": "tool_use"
}
```

Notice two things:
1. The response can contain BOTH text AND tool requests
2. The `stop_reason` is `"tool_use"` — this is how the loop knows to continue

### Returning Tool Results

After executing the tool, you send the result back as a `user` message:

```typescript
messages.push({
  role: 'user',
  content: [{
    type: 'tool_result',
    tool_use_id: 'tc_123',           // Must match the tool call ID!
    content: '{ "version": "1.0" }', // The actual result
    is_error: false
  }]
})
```

The `tool_use_id` links the result to the specific tool call. This is crucial when the LLM makes multiple tool calls in one response.

---

## Part 3: See It Work (10 min)

### Exercise 1.1: Trace a Tool Call

Start the app with `npm run dev` and open http://localhost:5173?mock.

Watch the **Trace Panel** as you interact. You'll see events like:

```
loop_start
llm_call          → messages sent to AI
llm_response      → AI's response (with tool_use blocks)
tool_call         → name: "read_file", input: { path: "..." }
tool_result       → output: "file contents..."
llm_call          → messages sent again (now with tool results)
llm_response      → AI's final answer
loop_end
```

### Exercise 1.2: Read the Tool Registry

Open `boston-app/src/agent/tool-registry.ts` (only 62 lines).

Notice:
- `getDefinitions()` sorts alphabetically — this keeps the tool list stable across calls (important for prompt caching later)
- `execute()` wraps tool calls in try/catch — errors become `{ isError: true }` results, not crashes
- The registry is **generic** — it doesn't know about files, commands, or anything specific

### Exercise 1.3: Read the File Tools

Open `boston-app/src/agent/tools/fs-tools.ts`. These are the actual tools:

- `read_file` — reads from the virtual file system
- `write_file` — writes to the virtual file system
- `list_files` — lists all files
- `search_files` — searches file contents

Each follows the same pattern: definition + execute function.

---

## Part 4: Build It Yourself (20 min)

### Exercise 1.4: Create a Calculator Tool

Create `boston-app/src/exercises/calculator-tool.ts`:

```typescript
import type { Tool } from '../agent/types'

/**
 * YOUR TASK: Create a calculator tool.
 *
 * The tool should:
 * - Be named 'calculate'
 * - Take 'expression' as a string input (e.g., "2 + 3 * 4")
 * - Evaluate the expression and return the result
 * - Return an error if the expression is invalid
 *
 * Hints:
 * - Use Function constructor for safe-ish evaluation (this is a demo!)
 * - The definition needs: name, description, input_schema
 * - The execute function returns: { output: string, isError: boolean }
 */
export const calculatorTool: Tool = {
  definition: {
    // YOUR CODE: name, description, input_schema
  },
  execute: async (input) => {
    // YOUR CODE: evaluate the expression, return result
  }
}
```

<details>
<summary>Solution (click to reveal)</summary>

```typescript
import type { Tool } from '../agent/types'

export const calculatorTool: Tool = {
  definition: {
    name: 'calculate',
    description: 'Evaluate a mathematical expression and return the result.',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The math expression to evaluate (e.g., "2 + 3 * 4")',
        },
      },
      required: ['expression'],
    },
  },
  execute: async (input) => {
    const expression = input.expression as string
    try {
      // Only allow numbers, operators, parentheses, and spaces
      if (!/^[\d\s+\-*/().]+$/.test(expression)) {
        return { output: 'Invalid expression: only numbers and +, -, *, /, () are allowed', isError: true }
      }
      const result = new Function(`return (${expression})`)()
      return { output: String(result), isError: false }
    } catch (err) {
      return {
        output: `Error evaluating "${expression}": ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      }
    }
  },
}
```

</details>

### Exercise 1.5: Register and Use Your Tool

```typescript
import { ToolRegistry } from '../agent/tool-registry'
import { calculatorTool } from './calculator-tool'

// Create a registry and add your tool
const registry = new ToolRegistry()
registry.register(calculatorTool)

// Now the LLM can use it!
// When the LLM outputs: { name: 'calculate', input: { expression: '2 + 3' } }
// The loop calls: registry.execute('calculate', { expression: '2 + 3' })
// Result: { output: '5', isError: false }

// Test it yourself:
const result = await registry.execute('calculate', { expression: '2 + 3 * 4' })
console.log(result) // { output: '14', isError: false }
```

### Exercise 1.6: Wire It Into the Agent Loop

Now modify your `myAgentLoop` from Module 0 to actually execute tools:

```typescript
export async function myAgentLoop(
  userMessage: string,
  engine: LLMEngine,
  systemPrompt: string,
  toolRegistry: ToolRegistry  // NEW: pass the registry
): Promise<string> {
  const tools = toolRegistry.getDefinitions()
  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userMessage }] },
  ]

  for (let turn = 0; turn < 20; turn++) {
    const response = await engine.chat(messages, systemPrompt, tools)
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') break

    // NEW: Execute tools and add results
    const toolCalls = response.content.filter(b => b.type === 'tool_use')
    const toolResults = []

    for (const call of toolCalls) {
      const result = await toolRegistry.execute(call.name, call.input)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: result.output,
        is_error: result.isError,
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  // Return final text
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const textBlock = lastAssistant?.content.find(b => b.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : ''
}
```

---

## Part 5: Break It (5 min)

### Exercise 1.7: What Happens When...

1. **The LLM requests a tool that doesn't exist?**
   ```
   registry.execute('nonexistent', {})
   → { output: 'Unknown tool: nonexistent', isError: true }
   ```
   The registry returns an error result. The LLM sees the error and can react.

2. **A tool throws an exception?**
   The registry catches it and returns `{ isError: true }`. The loop doesn't crash.

3. **The tool_use_id doesn't match?**
   The API may reject the response. Always pass through the exact `id` from the tool_use block.

4. **The LLM requests 3 tools at once?**
   The loop executes them one by one (sequentially) and sends all results back in a single user message.

---

## Part 6: Challenge

### Exercise 1.8: Create a "Time" Tool

Build a tool called `get_time` that:
- Takes an optional `timezone` parameter
- Returns the current time
- Defaults to UTC if no timezone is given

Register it alongside the calculator tool and test them together.

### Exercise 1.9: Create a "Random" Tool

Build a tool called `random_number` that:
- Takes `min` and `max` as inputs
- Returns a random integer between min and max
- Returns an error if min > max

---

## Key Takeaways

1. **Tools are just JSON descriptions + functions** — the LLM sees the description, your code runs the function
2. **The LLM doesn't execute anything** — it outputs structured text requesting a tool call
3. **The tool registry is a Map** — register tools by name, look them up when the LLM requests them
4. **Tool results become user messages** — the `tool_use_id` links results back to requests
5. **Errors don't crash the loop** — they become `isError: true` results that the LLM can react to
6. **Definitions are sorted alphabetically** — this keeps the prompt stable for caching

---

## What's Next?

We now have a loop (Module 0) and tools (Module 1). Our agent can do real work!

But what happens when you have 100 tools? Or 500? Sending all their definitions on every call wastes tokens and confuses the LLM.

**[Module 2: Smart Tool Loading — Progressive Discovery →](./module-2-discovery.md)**

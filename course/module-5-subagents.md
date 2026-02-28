# Module 5: Teamwork — Sub-Agents

> **Time:** ~45 minutes
> **Prerequisites:** Complete [Module 4: Memory](./module-4-memory.md)
> **What you'll build:** A system to spawn parallel workers
> **Key file:** `boston-app/src/agent/sub-agent.ts`

---

## Part 1: The Problem (5 min)

Your agent is powerful now. But it does everything sequentially — one step at a time:

```
You: "Update the header, fix the footer bug, and add a loading spinner"

Agent (sequential):
  Step 1: Update the header      → 5 minutes
  Step 2: Fix the footer bug     → 4 minutes
  Step 3: Add a loading spinner  → 3 minutes
  Total: 12 minutes
```

But these three tasks are **independent** — they don't depend on each other. They could run at the same time:

```
Agent (parallel):
  Worker 1: Update the header      → 5 minutes ─┐
  Worker 2: Fix the footer bug     → 4 minutes ─┤
  Worker 3: Add a loading spinner  → 3 minutes ─┘
  Total: 5 minutes (2.4x faster!)
```

### The constraint

Each LLM API call is **one request → one response**. You can't have a single call do three things simultaneously.

### The key question

How do you run multiple AI tasks in parallel?

---

## Part 2: The Concept (15 min)

### Sub-Agents: Separate Workers

A **sub-agent** is a completely separate agent loop running in parallel. It has:
- Its own messages array (isolated conversation)
- Its own system prompt
- Access to the same tools (shared file system)
- A specific goal to accomplish

Think of it like delegating work to teammates:

```
┌─────────────────────────────────────────┐
│  Parent Agent (the manager)              │
│                                          │
│  "I need three things done..."           │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Worker 1 │ │ Worker 2 │ │ Worker 3 │  │
│  │ "Update  │ │ "Fix the │ │ "Add a   │  │
│  │  header" │ │  footer" │ │ spinner" │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │         │
│       ▼            ▼            ▼         │
│  ┌─────────────────────────────────────┐  │
│  │  Results collected via Promise.all   │  │
│  └─────────────────────────────────────┘  │
│                                          │
│  "All three tasks complete!"             │
└─────────────────────────────────────────┘
```

### How Sub-Agents Work

1. **The parent agent** receives a complex task
2. **The LLM decides** to parallelize (by calling the `spawn_agent` tool)
3. **Each sub-agent** gets:
   - A specific goal ("Update the header component")
   - Its own empty messages array
   - The same tools and system prompt as the parent
4. **All sub-agents run simultaneously** via `Promise.all()`
5. **Results are returned** to the parent as tool results
6. **The parent continues** with the combined results

### It's Just Another Tool

The genius of this design: `spawn_agent` is just a regular tool. The LLM decides when to use it, just like it decides when to use `read_file` or `write_file`.

```typescript
// The spawn_agent tool definition
{
  name: 'spawn_agent',
  description: 'Spawn a sub-agent to handle a task in parallel.',
  input_schema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'The task for the sub-agent to accomplish'
      }
    },
    required: ['goal']
  }
}
```

When the LLM outputs:
```json
{ "name": "spawn_agent", "input": { "goal": "Update the header component" } }
```

Your code creates a new agent loop, runs it to completion, and returns the result.

### Shared File System, Isolated Context

Sub-agents share the **file system** but NOT the **conversation**:

```
Parent's conversation:    "User wants three changes..."
Worker 1's conversation:  "Update the header" (clean slate)
Worker 2's conversation:  "Fix the footer"    (clean slate)
Worker 3's conversation:  "Add a spinner"     (clean slate)
```

Why isolated conversations?
- Each sub-agent has its full context window available
- No cross-contamination between tasks
- Each can use tools independently

Why shared file system?
- Workers can read the same source files
- Workers can write their changes
- Results are visible to the parent after completion

### When the LLM Decides to Parallelize

The LLM itself decides when to use `spawn_agent`. You don't hard-code parallelism. The system prompt tells it:

> "When a task has independent parts that could run simultaneously, use spawn_agent to delegate each part to a separate worker."

The LLM then analyzes the user's request and decides:
- "Update header + fix footer + add spinner" → independent → parallelize
- "Read the config, then update based on what you find" → dependent → sequential

---

## Part 3: See It Work (10 min)

### Exercise 5.1: Read the Implementation

Open `boston-app/src/agent/sub-agent.ts` (167 lines).

Study the key parts:

1. **`runSubAgent(task, engine, toolRegistry)`** — runs a complete agent loop for one task
2. **`spawnSubAgents(tasks, engine, toolRegistry)`** — runs multiple sub-agents via `Promise.all()`
3. **`partitionToolCalls(blocks)`** — separates regular tools from `spawn_agent` calls
4. **`createSpawnAgentTool(engine, toolRegistry)`** — creates the tool definition

Notice how `runSubAgent` is essentially the same loop from Module 0, but self-contained:

```typescript
async function runSubAgent(task, engine, toolRegistry, systemPrompt) {
  // Fresh conversation — isolated from parent
  const messages = [
    { role: 'user', content: [{ type: 'text', text: task.goal }] }
  ]

  // Same loop pattern as Module 0
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await engine.chat(messages, systemPrompt, tools)
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      return { output: finalText, isError: false }
    }

    // Execute tools (same as Module 1)
    // ... add tool results ...
  }
}
```

### Exercise 5.2: Run the Tests

```bash
cd boston-app
npm run test -- sub-agent
```

Watch how:
- Sub-agents run their own loop to completion
- Multiple sub-agents execute in parallel
- Results are collected and returned
- Errors in one sub-agent don't crash others

---

## Part 4: Build It Yourself (15 min)

### Exercise 5.3: Build a Simple Sub-Agent Runner

```typescript
import type { LLMEngine, LLMMessage, ToolDefinition, ContentBlock, TextBlock, ToolUseBlock, ToolResultBlock } from '../agent/types'
import type { ToolRegistry } from '../agent/tool-registry'

interface SubTask {
  id: string
  goal: string
}

interface SubResult {
  id: string
  goal: string
  output: string
  isError: boolean
}

/**
 * YOUR TASK: Run a single sub-agent.
 *
 * This is essentially the agent loop from Module 0+1,
 * but as a standalone function that returns a result.
 *
 * Requirements:
 * 1. Create a fresh messages array with the task goal
 * 2. Run the agent loop (max 10 turns)
 * 3. Execute tools using the registry
 * 4. Return the final text output
 * 5. Catch errors and return them as isError: true
 */
async function runWorker(
  task: SubTask,
  engine: LLMEngine,
  registry: ToolRegistry,
  systemPrompt: string
): Promise<SubResult> {
  // YOUR CODE HERE
}
```

<details>
<summary>Solution</summary>

```typescript
async function runWorker(
  task: SubTask,
  engine: LLMEngine,
  registry: ToolRegistry,
  systemPrompt: string
): Promise<SubResult> {
  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: task.goal }] },
  ]
  const tools = registry.getDefinitions()

  try {
    for (let turn = 0; turn < 10; turn++) {
      const response = await engine.chat(messages, systemPrompt, tools)
      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(
          (b: ContentBlock): b is TextBlock => b.type === 'text'
        )
        return {
          id: task.id,
          goal: task.goal,
          output: textBlock?.text ?? '',
          isError: false,
        }
      }

      // Execute tools
      const toolCalls = response.content.filter(
        (b: ContentBlock): b is ToolUseBlock => b.type === 'tool_use'
      )
      const toolResults: ToolResultBlock[] = []

      for (const call of toolCalls) {
        const result = await registry.execute(call.name, call.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: result.output,
          is_error: result.isError,
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return { id: task.id, goal: task.goal, output: 'Max turns reached', isError: true }
  } catch (err) {
    return {
      id: task.id,
      goal: task.goal,
      output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    }
  }
}
```

</details>

### Exercise 5.4: Build the Parallel Runner

```typescript
/**
 * YOUR TASK: Run multiple sub-agents in parallel.
 *
 * This is the key insight: Promise.all() runs them simultaneously.
 *
 * Requirements:
 * 1. Take an array of tasks
 * 2. Start all workers at the same time (don't await one-by-one!)
 * 3. Wait for all to complete
 * 4. Return all results
 */
async function runInParallel(
  tasks: SubTask[],
  engine: LLMEngine,
  registry: ToolRegistry,
  systemPrompt: string
): Promise<SubResult[]> {
  // YOUR CODE HERE
  // Hint: It's ONE line of code
}
```

<details>
<summary>Solution</summary>

```typescript
async function runInParallel(
  tasks: SubTask[],
  engine: LLMEngine,
  registry: ToolRegistry,
  systemPrompt: string
): Promise<SubResult[]> {
  return Promise.all(
    tasks.map(task => runWorker(task, engine, registry, systemPrompt))
  )
}
```

Yes, it really is just `Promise.all()` over `map()`. The parallel execution comes from JavaScript's event loop — all promises start immediately and resolve independently.

</details>

### Exercise 5.5: Build the spawn_agent Tool

```typescript
/**
 * YOUR TASK: Create the spawn_agent tool.
 *
 * This tool:
 * 1. Takes a 'goal' string from the LLM
 * 2. Creates a SubTask
 * 3. Runs a sub-agent
 * 4. Returns the result
 */
export function createSpawnTool(
  engine: LLMEngine,
  registry: ToolRegistry
) {
  return {
    definition: {
      // YOUR CODE: name, description, input_schema
    },
    execute: async (input: Record<string, unknown>) => {
      // YOUR CODE: create task, run sub-agent, return result
    }
  }
}
```

<details>
<summary>Solution</summary>

```typescript
export function createSpawnTool(
  engine: LLMEngine,
  registry: ToolRegistry
) {
  return {
    definition: {
      name: 'spawn_agent',
      description: 'Spawn a sub-agent to handle a task in parallel. The sub-agent gets its own conversation but shares the file system.',
      input_schema: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The task for the sub-agent to accomplish',
          },
        },
        required: ['goal'],
      },
    },
    async execute(input: Record<string, unknown>) {
      const goal = input.goal as string
      const task: SubTask = {
        id: `sub_${Math.random().toString(36).slice(2, 10)}`,
        goal,
      }

      const result = await runWorker(task, engine, registry, 'You are a helpful assistant.')

      if (result.isError) {
        return { output: `Sub-agent failed: ${result.output}`, isError: true }
      }
      return { output: `Sub-agent completed: ${result.output}`, isError: false }
    },
  }
}
```

</details>

---

## Part 5: Break It (5 min)

### Exercise 5.6: Edge Cases

1. **What if a sub-agent fails?**
   The error is returned to the parent as the tool result. The parent can decide to retry, try a different approach, or tell the user.

2. **What if two sub-agents edit the same file?**
   Race condition! The last write wins. In production, you'd need file locking or merge strategies. The Boston App uses a VirtualFS (in-memory Map), so the last write simply overwrites.

3. **What if a sub-agent tries to spawn its own sub-agent?**
   In the Boston App, this works (sub-sub-agents). In production systems like Claude Code, sub-agents **cannot** spawn further sub-agents to prevent infinite nesting.

4. **What if you spawn 100 sub-agents?**
   They all run in parallel, consuming 100x the API calls (and cost). In practice, you'd want a concurrency limit (e.g., max 5 sub-agents at once).

---

## Part 6: Challenge

### Exercise 5.7: Add a Concurrency Limit

Modify `runInParallel` to only run N sub-agents at a time:

```typescript
// Instead of all at once:
Promise.all(tasks.map(t => runWorker(t)))

// Run at most 3 simultaneously:
runWithConcurrency(tasks, 3, task => runWorker(task))
```

Hint: Use a semaphore pattern or chunk the tasks array.

### Exercise 5.8: Add Progress Tracking

Yield trace events as each sub-agent completes:

```typescript
{ type: 'sub_agent_spawned', id: 'sub_abc', goal: 'Update header' }
{ type: 'sub_agent_completed', id: 'sub_abc', output: 'Done!' }
```

This lets the UI show which workers are still running.

### Exercise 5.9: Smart Parallelism

Build a function that analyzes a task list and decides which can run in parallel vs. which must be sequential:

```typescript
const tasks = [
  "Read the config file",           // Must be first (others depend on it)
  "Update the header",              // Independent
  "Fix the footer",                 // Independent
  "Run the tests",                  // Must be last (depends on updates)
]

// Should output:
// Sequential: "Read the config file"
// Parallel: ["Update the header", "Fix the footer"]
// Sequential: "Run the tests"
```

---

## Key Takeaways

1. **Sub-agents are separate agent loops** — each with isolated conversation context
2. **They share the file system** — workers can read/write the same files
3. **`spawn_agent` is just a tool** — the LLM decides when to parallelize
4. **`Promise.all()` is the engine** — JavaScript's event loop handles the concurrency
5. **Errors are isolated** — one failed sub-agent doesn't crash the others
6. **No infinite nesting** — in production, sub-agents can't spawn sub-sub-agents

---

## Congratulations!

You've completed all 6 modules of the course. You now understand the full architecture of an AI agent:

```
MODULE 5: SUB-AGENTS        → Parallel workers via Promise.all()
MODULE 4: MEMORY             → Background note-taker saves facts to disk
MODULE 3: CONTEXT MANAGEMENT → Prune old results, compact when needed
MODULE 2: DISCOVERY          → Load tools on demand via skill catalog
MODULE 1: TOOLS              → JSON definition + execute function
MODULE 0: THE LOOP           → while (AI requests tools) { execute, loop }
FOUNDATION: THE LLM          → Text in → Text out
```

### What to Do Next

1. **Explore the full Boston App** — Run it, read every file, modify things
2. **Read the detailed docs** — The `*.md` files in the repo root go deeper on each layer
3. **Build your own agent** — Start with just Module 0+1, add layers as you need them
4. **Try the real Claude API** — Replace the mock engine with real API calls
5. **Study the Claude Agent SDK** — Anthropic's official SDK implements all these patterns and more

### The Full Stack in One Sentence

> An AI agent is an LLM in a while loop with tools, where context management keeps it running, memory keeps it informed, and sub-agents keep it fast.

That's it. Everything else is details.

# Agent Architecture Cheat Sheet

> Print this. Refer to it while building.

---

## The Agent Formula

```
AGENT = LLM + Tools + Loop
```

---

## The Core Loop (Module 0)

```typescript
const messages = [{ role: 'user', content: userMessage }]

while (true) {
  const response = await llm.chat(messages, systemPrompt, tools)
  messages.push({ role: 'assistant', content: response.content })

  if (response.stop_reason !== 'tool_use') break   // Done!

  const results = await executeTools(response.content)
  messages.push({ role: 'user', content: results })  // Loop again
}
```

---

## A Tool (Module 1)

```typescript
const tool = {
  definition: {                    // What the LLM sees
    name: 'read_file',
    description: 'Read a file',
    input_schema: { type: 'object', properties: { path: { type: 'string' } } }
  },
  execute: async (input) => {      // What YOUR code runs
    return { output: fs.readFileSync(input.path), isError: false }
  }
}
```

---

## The API Dance

```
1. You → API:    { messages, system, tools }
2. API → LLM:    (processes everything)
3. LLM → You:    { content: [text, tool_use], stop_reason: 'tool_use' }
4. You:           Execute tools
5. You → API:    { messages + [assistant_response, tool_results] }
6. Repeat from 2
```

---

## Message Roles

| Role | Sender | Content |
|------|--------|---------|
| `user` | You / tool results | Questions, tool_result blocks |
| `assistant` | The LLM | Text, tool_use blocks |

Roles MUST alternate: user → assistant → user → assistant → ...

---

## Stop Reasons

| stop_reason | Meaning | Action |
|-------------|---------|--------|
| `end_turn` | LLM is done | Exit loop, return text |
| `tool_use` | LLM wants tools | Execute tools, continue loop |

---

## Context Management (Module 3)

```
Is context > 75% of max?
  → NO:  Do nothing
  → YES: Prune old tool results → [cleared]
         Still over?
           → YES: Compact (summarize via LLM)
```

---

## Memory (Module 4)

```
After each turn:
  Has 30K new tokens accumulated?
    → YES: Side-LLM-call: "Extract key facts"
           Save facts to disk
           Inject into system prompt next turn
```

---

## Sub-Agents (Module 5)

```typescript
// Spawn 3 workers in parallel
const results = await Promise.all([
  runSubAgent({ goal: 'Task 1' }),
  runSubAgent({ goal: 'Task 2' }),
  runSubAgent({ goal: 'Task 3' }),
])
```

Each sub-agent: own messages, shared file system.

---

## Layer Stack

```
Layer 4: Sub-Agents    │ Parallel workers
Layer 3: Memory        │ Background note-taker → disk
Layer 2: Context       │ Prune → Compact → Cache
Layer 1+: Discovery    │ Skills loaded on demand
Layer 1: Tools         │ JSON definition + execute()
Layer 0: Loop          │ while (tool_use) { execute; loop }
Foundation: LLM        │ text in → text out
```

---

## Key Files (Boston App)

| File | What It Does |
|------|-------------|
| `src/agent/agent-loop.ts` | The while loop (Module 0) |
| `src/agent/tool-registry.ts` | Tool Map + execute (Module 1) |
| `src/agent/tools/fs-tools.ts` | File tools (Module 1) |
| `src/agent/progressive-discovery.ts` | Skill catalog (Module 2) |
| `src/agent/context-manager.ts` | Prune + compact (Module 3) |
| `src/agent/token-counter.ts` | Token estimation (Module 3) |
| `src/agent/observational-memory.ts` | Fact extraction (Module 4) |
| `src/agent/sub-agent.ts` | Parallel workers (Module 5) |
| `src/agent/types.ts` | All TypeScript types |

---

## Common Patterns

### Error Handling
```typescript
// Tools return errors as results, not exceptions
try {
  return { output: result, isError: false }
} catch (err) {
  return { output: err.message, isError: true }
}
```

### Stable Tool Ordering (for prompt caching)
```typescript
getDefinitions(): ToolDefinition[] {
  return [...this.tools.values()]
    .map(t => t.definition)
    .sort((a, b) => a.name.localeCompare(b.name))  // Alphabetical!
}
```

### Token Estimation
```typescript
// Quick estimate: 1 token ≈ 4 characters
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

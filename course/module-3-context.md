# Module 3: Infinite Conversations — Context Management

> **Time:** ~45 minutes
> **Prerequisites:** Complete [Module 2: Discovery](./module-2-discovery.md)
> **What you'll build:** A context manager that prunes and compacts conversations
> **Key file:** `boston-app/src/agent/context-manager.ts`

---

## Part 1: The Problem (5 min)

Your agent works! It loops (Module 0), uses tools (Module 1), and loads them smartly (Module 2). But there's a ticking time bomb.

### The Ticking Time Bomb

Remember from Module 0: you re-send the **entire** conversation on every call. The messages array grows with every turn:

```
Turn 1:   ~500 tokens    (your message + AI response)
Turn 5:   ~5,000 tokens  (messages accumulating)
Turn 10:  ~20,000 tokens (tool results add up fast)
Turn 20:  ~80,000 tokens (file contents, command outputs)
Turn 30:  ~180,000 tokens
Turn 31:  💥 ERROR! Context window exceeded (200K limit)
```

When the conversation gets too long, the LLM API returns an error and **everything stops**. Your agent crashes mid-task.

### Why does it grow so fast?

Tool results are the biggest offenders. When the AI reads a file, the **entire file contents** go into the messages array. Read 10 files? That's 10 files worth of text in the conversation. Run a build command? That's pages of build output.

```
┌──────────────────────────────────────────┐
│ Context Window (200K tokens)              │
│                                           │
│ ██  System prompt (3K)                    │
│ ██  Tool definitions (5K)                 │
│ █   Your messages (1K)                    │
│ █   AI text responses (2K)                │
│ ████████████████████  Tool results (170K) │ ← The monster
│ ░░  Free space (19K)                      │
│                                           │
│ 85% of context = old tool results!        │
└──────────────────────────────────────────┘
```

### The key question

How do you keep the conversation going when it gets too long?

---

## Part 2: The Concept (15 min)

### Three Strategies

Context management uses three strategies, applied in order:

#### Strategy 1: Prompt Caching (Free Optimization)

The system prompt and tool definitions are the same on every call. Why re-process them every time?

**Prompt caching** tells the API: "this prefix hasn't changed — use the cached version." The API charges ~10% of the normal price for cached tokens.

```
Call 1: [system prompt + tools] + [messages]
        ^^^^^^^^^^^^^^^^^^^^^^^^
        Processed fully — expensive

Call 2: [system prompt + tools] + [messages + new stuff]
        ^^^^^^^^^^^^^^^^^^^^^^^^
        Read from cache — 90% cheaper!
```

For this to work, the system prompt must be **byte-for-byte identical** across calls. That's why we:
- Build it once before the loop starts
- Sort tool definitions alphabetically (so the order is stable)

#### Strategy 2: Pruning (Lightweight Cleanup)

Old tool results are probably not needed anymore. If the AI read a file 20 turns ago, it already used that information. We can replace old tool results with a placeholder:

```
BEFORE pruning:
  user: tool_result("{ 500 lines of package.json }")   ← 2,000 tokens

AFTER pruning:
  user: tool_result("[Old tool result content cleared]") ← 8 tokens
```

Pruning saves space while keeping the conversation structure intact. The AI can still see that it called a tool and the name of the tool — it just can't see the result anymore.

**Important:** We only prune OLD results (more than 4 messages ago). Recent results are still needed.

#### Strategy 3: Compaction (The Big Reset)

If pruning isn't enough, we take drastic action: **summarize the entire old conversation** into a short summary, throw away the old messages, and continue from the summary.

```
BEFORE compaction (50 messages, 180K tokens):
  user: "Fix the login bug"
  assistant: "I'll read the auth files..."
  user: tool_result(...)
  assistant: "Found the issue..."
  user: tool_result(...)
  ... 45 more messages ...

AFTER compaction (4 messages, ~2K tokens):
  user: "[Summary: Worked on login bug. Read auth.ts, found JWT
         expiry issue, fixed it, ran tests — all pass.]"
  assistant: "Understood, I have the context."
  user: (most recent message)
  assistant: (most recent response)
```

The conversation drops from 180K tokens back to ~2K. The loop can continue indefinitely.

### The Pipeline

```
Is the context too long?
  → NO:  Do nothing, keep going
  → YES: Step 1 — Prune old tool results
         Is it still too long?
           → NO:  Done
           → YES: Step 2 — Compact (summarize everything)
```

### The Cost of Compaction

Compaction is lossy. The summary captures the big picture but **loses small details**:

- "User prefers tabs over spaces" → probably lost
- "Deploy to AWS us-east-1" → probably lost
- "Never modify the legacy/ folder" → probably lost

This is a real problem. Module 4 (Memory) solves it.

---

## Part 3: See It Work (10 min)

### Exercise 3.1: Read the Context Manager

Open `boston-app/src/agent/context-manager.ts` (165 lines).

Study the three key methods:

1. **`isOverflow(messages)`** — checks if tokens exceed 75% of max
2. **`prune(messages)`** — replaces old tool results with `[cleared]`
3. **`compact(messages, engine)`** — summarizes old messages via LLM

### Exercise 3.2: Read the Token Counter

Open `boston-app/src/agent/token-counter.ts`. It estimates token counts:

```typescript
// Rule of thumb: 1 token ≈ 4 characters
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

This is an approximation. Real tokenizers (like `tiktoken` for OpenAI or `@anthropic-ai/tokenizer` for Claude) are more accurate but slower.

### Exercise 3.3: Run the Tests

```bash
cd boston-app
npm run test -- context-manager
```

Watch how:
- Pruning replaces old tool results but keeps recent ones
- Compaction summarizes the entire conversation
- The pipeline applies pruning first, then compaction only if needed

---

## Part 4: Build It Yourself (15 min)

### Exercise 3.4: Build a Token Counter

```typescript
/**
 * YOUR TASK: Write a token estimator.
 *
 * Rules:
 * - 1 token ≈ 4 characters (rough estimate)
 * - Count tokens for all content blocks in a message
 * - Text blocks: count the text
 * - Tool_use blocks: count the name + JSON.stringify(input)
 * - Tool_result blocks: count the content
 */
export function countMessageTokens(message: LLMMessage): number {
  // YOUR CODE HERE
}
```

<details>
<summary>Solution</summary>

```typescript
import type { LLMMessage } from '../agent/types'

export function countMessageTokens(message: LLMMessage): number {
  let chars = 0

  for (const block of message.content) {
    if (block.type === 'text') {
      chars += block.text.length
    } else if (block.type === 'tool_use') {
      chars += block.name.length + JSON.stringify(block.input).length
    } else if (block.type === 'tool_result') {
      chars += block.content.length
    }
  }

  // ~4 characters per token + overhead for message structure
  return Math.ceil(chars / 4) + 10
}
```

</details>

### Exercise 3.5: Build a Pruner

```typescript
/**
 * YOUR TASK: Build the prune function.
 *
 * Rules:
 * - Only prune tool_result blocks
 * - Keep the last 4 messages untouched
 * - Replace tool result content with "[Old tool result content cleared]"
 * - Count how many results were pruned
 * - Don't mutate the original messages (return new array)
 */
export function pruneMessages(
  messages: LLMMessage[]
): { messages: LLMMessage[]; pruned: number } {
  // YOUR CODE HERE
}
```

<details>
<summary>Solution</summary>

```typescript
import type { LLMMessage, ContentBlock, ToolResultBlock } from '../agent/types'

export function pruneMessages(
  messages: LLMMessage[]
): { messages: LLMMessage[]; pruned: number } {
  if (messages.length <= 4) return { messages, pruned: 0 }

  let pruned = 0
  const cutoff = Math.max(0, messages.length - 4)

  const result = messages.map((msg, i) => {
    if (i >= cutoff) return msg  // Keep recent messages

    const newContent = msg.content.map((block: ContentBlock) => {
      if (
        block.type === 'tool_result' &&
        block.content !== '[Old tool result content cleared]'
      ) {
        pruned++
        return {
          ...block,
          content: '[Old tool result content cleared]',
        } as ToolResultBlock
      }
      return block
    })

    return { ...msg, content: newContent }
  })

  return { messages: result, pruned }
}
```

</details>

### Exercise 3.6: Build the Pipeline

Wire your token counter and pruner into a simple context manager:

```typescript
/**
 * YOUR TASK: Build the context management pipeline.
 *
 * 1. Check if total tokens exceed threshold
 * 2. If yes → prune
 * 3. If still over after pruning → log a warning
 *    (We'll skip real compaction since it needs an LLM call)
 */
export function manageContext(
  messages: LLMMessage[],
  maxTokens: number
): { messages: LLMMessage[]; action: 'none' | 'pruned' | 'needs_compaction' } {
  // YOUR CODE HERE
}
```

<details>
<summary>Solution</summary>

```typescript
export function manageContext(
  messages: LLMMessage[],
  maxTokens: number
): { messages: LLMMessage[]; action: 'none' | 'pruned' | 'needs_compaction' } {
  const threshold = maxTokens * 0.75
  const totalTokens = messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0)

  if (totalTokens <= threshold) {
    return { messages, action: 'none' }
  }

  // Step 1: Prune
  const { messages: prunedMessages, pruned } = pruneMessages(messages)

  // Check again
  const prunedTokens = prunedMessages.reduce((sum, msg) => sum + countMessageTokens(msg), 0)

  if (prunedTokens <= threshold) {
    return { messages: prunedMessages, action: 'pruned' }
  }

  // Still over — needs compaction (which requires an LLM call)
  return { messages: prunedMessages, action: 'needs_compaction' }
}
```

</details>

---

## Part 5: Break It (5 min)

### Exercise 3.7: Edge Cases

1. **What if you prune messages that are still needed?**
   The AI loses context about what was in those files. It might ask to read them again (wasting a turn) or make assumptions. That's why we keep the last 4 messages.

2. **What if compaction loses important details?**
   This is the real problem. The summary is lossy. "User prefers tabs" disappears. Module 4 solves this.

3. **What if the compaction summary itself is too long?**
   The LLM is instructed to be concise. In practice, summaries are much shorter than the original. If it's still too long, you'd need to compact again (recursive compaction).

4. **What if maxTokens is set too low?**
   The agent keeps compacting, losing more and more context. There's a minimum viable context size — too small and the agent can't function.

---

## Part 6: Challenge

### Exercise 3.8: Add Token Tracking

Add a `getStats()` method that returns:
- Current total tokens
- Max tokens
- Threshold (75% of max)
- Percentage used
- Whether overflow is imminent

### Exercise 3.9: Smart Pruning

Improve pruning to be smarter:
- Don't prune error results (the AI might need to see what went wrong)
- Prune the largest results first (sort by size before pruning)
- Keep a minimum number of results even if they're old

---

## Key Takeaways

1. **Context windows have hard limits** — exceeding them crashes the agent
2. **Tool results are the #1 space consumer** — file contents and command outputs add up fast
3. **Three strategies, in order:** prompt caching → pruning → compaction
4. **Prompt caching is free** — just keep the system prompt stable
5. **Pruning is lightweight** — replace old tool results with placeholders
6. **Compaction is heavy but effective** — summarize everything via LLM, reset context
7. **Compaction is lossy** — the summary loses details (Module 4 fixes this)

---

## What's Next?

Compaction keeps the agent running forever, but it has a critical flaw: important details get lost in the summary. "Use tabs not spaces" vanishes. "Deploy to AWS" disappears.

**[Module 4: Never Forget — Observational Memory →](./module-4-memory.md)**

# Module 4: Never Forget — Observational Memory

> **Time:** ~30 minutes
> **Prerequisites:** Complete [Module 3: Context Management](./module-3-context.md)
> **What you'll build:** A background note-taker that saves important facts
> **Key file:** `boston-app/src/agent/observational-memory.ts`

---

## Part 1: The Problem (5 min)

Module 3 solved the overflow problem. But compaction has a fatal flaw:

```
During the conversation:
  Turn 5:  "I always use tabs, not spaces"
  Turn 10: "Deploy target is AWS us-east-1"
  Turn 15: "Never modify the legacy/ folder"
  Turn 20: "Use PostgreSQL, not MySQL"

After compaction:
  Summary: "Built a login page with email/password auth.
           Fixed a CSS alignment bug. Set up API endpoints."

  Where are:
  - "Use tabs not spaces"?     ← GONE
  - "Deploy to AWS"?           ← GONE
  - "Never touch legacy/"?     ← GONE
  - "Use PostgreSQL"?          ← GONE
```

The LLM now has **amnesia** about your preferences and constraints. It will switch to spaces, modify legacy files, or use MySQL — because those instructions were compressed away.

### The key question

How do you give the LLM persistent memory that survives compaction?

---

## Part 2: The Concept (10 min)

### The Solution: A Background Note-Taker

Imagine you have a meeting. Your colleague is doing the actual work (the main LLM). Meanwhile, a quiet assistant sits in the corner taking notes on the important stuff:

```
┌─────────────────────────────────┐
│  Main conversation (visible)     │
│                                  │
│  You: "Use tabs not spaces"      │
│  AI: "Got it, I'll use tabs"     │
│  You: "Read the config file"     │
│  AI: [reads file, works...]      │
│                                  │
└──────────┬───────────────────────┘
           │
           │  (background: a second LLM reads
           │   the conversation and takes notes)
           │
           ▼
┌─────────────────────────────────┐
│  Saved observations (on disk)    │
│                                  │
│  - User prefers tabs over spaces │
│  - Deploy target: AWS us-east-1  │
│  - Never modify legacy/ folder   │
│  - Database: PostgreSQL          │
│                                  │
└─────────────────────────────────┘
```

On every turn, these saved observations are **injected back into the system prompt**. So even after compaction destroys the original conversation, the facts survive:

```
SYSTEM PROMPT:
  You are a helpful coding assistant.

  ## Remembered Facts
  - User prefers tabs over spaces
  - Deploy target: AWS us-east-1
  - Never modify legacy/ folder
  - Database: PostgreSQL

  [rest of system prompt...]
```

### How It Works

1. **Threshold check**: After each turn, check if enough new conversation has accumulated (e.g., 30K new tokens)
2. **Extract facts**: Make a side LLM call: "What are the key facts from this conversation?"
3. **Store to disk**: Save the facts to a JSON file on the file system
4. **Inject into prompt**: On the next turn, read the facts and add them to the system prompt
5. **Survive compaction**: Even when old messages are summarized, the saved facts remain

### Why a Separate LLM Call?

The observation runs as a **background side-call** — a separate LLM invocation that doesn't interfere with the main conversation. It reads recent messages, extracts facts, and stores them. The main agent never sees this happening.

This is important: the observation LLM call is cheap (it only reads recent messages, not the whole conversation) and it runs in the background (it doesn't slow down the main agent).

### What Gets Extracted?

The observation LLM is instructed to extract:
- User preferences ("tabs over spaces", "dark theme")
- Constraints ("never modify legacy/", "budget: $100")
- Technical decisions ("use PostgreSQL", "deploy to AWS us-east-1")
- Project facts ("main entry point is src/index.ts", "uses React 19")

NOT extracted:
- Step-by-step work details (too verbose)
- Tool result contents (too large)
- Intermediate reasoning (not important long-term)

---

## Part 3: See It Work (5 min)

### Exercise 4.1: Read the Implementation

Open `boston-app/src/agent/observational-memory.ts` (149 lines).

Study the key methods:

1. **`shouldObserve(messages)`** — returns true when enough new tokens have accumulated
2. **`observe(messages, engine)`** — makes the side LLM call, parses facts, stores them
3. **`getObservationsForPrompt()`** — returns the formatted facts for the system prompt
4. **`run(messages, engine)`** — the full pipeline (check → observe → yield events)

### Exercise 4.2: Run the Tests

```bash
cd boston-app
npm run test -- observational-memory
```

Watch how:
- Observations are extracted from conversation text
- Facts are stored incrementally (not overwritten)
- The prompt section is formatted correctly

---

## Part 4: Build It Yourself (10 min)

### Exercise 4.3: Build a Simple Fact Extractor

You don't need an LLM to extract basic facts. Build a rule-based extractor as a starting point:

```typescript
/**
 * YOUR TASK: Extract key facts from messages using simple rules.
 *
 * Look for patterns like:
 * - "I prefer X" / "I always use X" / "Use X not Y"
 * - "Never X" / "Don't X" / "Avoid X"
 * - "Deploy to X" / "Target is X"
 * - "Use X for Y"
 *
 * Return an array of fact strings.
 */
export function extractFacts(messages: LLMMessage[]): string[] {
  // YOUR CODE HERE
}
```

<details>
<summary>Solution</summary>

```typescript
import type { LLMMessage } from '../agent/types'

const FACT_PATTERNS = [
  /I (?:prefer|always use|like) (.+)/i,
  /(?:use|prefer) (\S+) (?:not|over|instead of) (\S+)/i,
  /(?:never|don't|avoid) (.+)/i,
  /deploy (?:to|target(?:ing)?) (.+)/i,
  /(?:database|db) (?:is|:) (\S+)/i,
]

export function extractFacts(messages: LLMMessage[]): string[] {
  const facts: string[] = []

  for (const msg of messages) {
    if (msg.role !== 'user') continue

    for (const block of msg.content) {
      if (block.type !== 'text') continue

      for (const pattern of FACT_PATTERNS) {
        const match = block.text.match(pattern)
        if (match) {
          facts.push(block.text.trim())
        }
      }
    }
  }

  return facts
}
```

</details>

### Exercise 4.4: Build an Observation Store

```typescript
/**
 * YOUR TASK: Build a simple observation store.
 *
 * It should:
 * - Store observations with timestamps
 * - Add new observations without overwriting old ones
 * - Serialize to/from JSON (for saving to disk)
 * - Format observations for the system prompt
 */
export class ObservationStore {
  private observations: Array<{ fact: string; timestamp: number }> = []

  add(fact: string): void {
    // YOUR CODE
  }

  toJSON(): string {
    // YOUR CODE
  }

  fromJSON(json: string): void {
    // YOUR CODE
  }

  toPromptSection(): string {
    // YOUR CODE: Return formatted facts for system prompt
    // Return empty string if no observations
  }
}
```

<details>
<summary>Solution</summary>

```typescript
export class ObservationStore {
  private observations: Array<{ fact: string; timestamp: number }> = []

  add(fact: string): void {
    this.observations.push({ fact, timestamp: Date.now() })
  }

  toJSON(): string {
    return JSON.stringify(this.observations, null, 2)
  }

  fromJSON(json: string): void {
    try {
      this.observations = JSON.parse(json)
    } catch {
      this.observations = []
    }
  }

  toPromptSection(): string {
    if (this.observations.length === 0) return ''

    const facts = this.observations.map(o => `- ${o.fact}`).join('\n')

    return `## Remembered Facts

The following facts were observed during this conversation and should inform your responses:

${facts}`
  }

  get size(): number {
    return this.observations.length
  }
}
```

</details>

### Exercise 4.5: Wire It Together

Connect your fact extractor and observation store:

```typescript
// After each agent loop turn:
const facts = extractFacts(messages)
for (const fact of facts) {
  store.add(fact)
}

// Before each agent loop turn:
const memorySection = store.toPromptSection()
const fullSystemPrompt = `${baseSystemPrompt}\n\n${memorySection}`
```

---

## Part 5: Break It (3 min)

### Exercise 4.6: Edge Cases

1. **What if observations grow too large?**
   Eventually, hundreds of facts take significant space in the system prompt. You'd need to prune or summarize observations too. Set a max (e.g., 50 facts) and keep only the most recent.

2. **What if the LLM extracts incorrect facts?**
   The observation LLM might misinterpret sarcasm or hypotheticals. "I would never use tabs" could be misread. This is a real limitation — observation quality depends on the LLM's comprehension.

3. **What if facts contradict each other?**
   "Prefer tabs" at turn 5 and "Actually, use spaces" at turn 20. The newer fact should override. You could timestamp and keep only the latest version of contradicting facts.

---

## Part 6: Challenge

### Exercise 4.7: Build Fact Deduplication

Add logic to detect when a new fact contradicts or duplicates an existing one:
- "Use tabs" + "Use tabs" → keep only one
- "Use tabs" + "Use spaces" → keep the newer one
- "Deploy to AWS" + "Deploy to AWS us-east-1" → keep the more specific one

### Exercise 4.8: Add Fact Categories

Categorize facts into:
- `preference` — user preferences (tabs vs spaces)
- `constraint` — things to avoid (don't modify legacy/)
- `technical` — project facts (uses React 19)
- `deployment` — deployment info (target: AWS)

Format the prompt section with headers for each category.

---

## Key Takeaways

1. **Compaction is lossy** — summaries lose small but important details
2. **Observational memory is a background note-taker** — a separate LLM extracts key facts
3. **Facts are saved to disk** — they survive compaction, session restarts, everything
4. **Facts are injected into the system prompt** — the AI "remembers" them on every call
5. **The observation is cheap** — it reads only recent messages, not the whole conversation
6. **Facts accumulate** — new observations are added, not replaced

---

## What's Next?

Our agent can now loop (Module 0), use tools (Module 1), load tools smartly (Module 2), manage context (Module 3), and remember important facts (Module 4). It can run indefinitely without forgetting.

But it still does everything **one step at a time**. What if the user asks for three independent things? Why not do them all at once?

**[Module 5: Teamwork — Sub-Agents →](./module-5-subagents.md)**

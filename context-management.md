# Layer 2: Context Management

> **Prerequisite:** Read [Layer 1+: Progressive Discovery](./progressive-discovery.md) first.
>
> **What you know so far:** The loop (Layer 0) keeps calling the LLM. The LLM uses tools (Layer 1) to act on the world. Skills and plugins load on demand (Layer 1+). Tool definitions are sent on every call. The conversation grows with each turn.
>
> **What this layer solves:** After many turns, the conversation gets too long for the LLM to handle. How do you keep the agent working when the conversation overflows?

---

## The Problem

LLMs have a **context window** -- a maximum number of tokens they can process at once. Think of it as the LLM's short-term memory. It has a hard limit:

| Model | Context Window |
|-------|---------------|
| GPT-4o | ~128,000 tokens |
| Claude Sonnet/Opus | ~200,000 tokens |

That sounds like a lot, but it fills up fast in an agent:

```mermaid
flowchart TD
    subgraph GROWTH ["How the Context Fills Up"]
        direction TB
        A["System prompt: ~3,000 tokens"]
        B["Tool definitions: ~5,000 tokens"]
        C["Your first message: ~100 tokens"]
        D["LLM reads a file: ~2,000 tokens"]
        E["LLM reads 10 files: ~20,000 tokens"]
        F["LLM runs build commands: ~10,000 tokens"]
        G["50 back-and-forth turns: 150,000+ tokens"]
        BOOM["TOTAL: over 200,000 → ERROR!"]

        A --> B --> C --> D --> E --> F --> G --> BOOM
    end

```

**What happens when you hit the limit?** The LLM API returns an error and everything stops. The loop crashes.

We need three strategies to handle this:

```mermaid
flowchart LR
    subgraph STRATEGIES ["Three Strategies"]
        S1["1. Prompt Caching<br/>Don't reprocess<br/>the same data<br/>(saves money + time)"]
        S2["2. Context Compaction<br/>Summarize old messages<br/>when space runs low<br/>(frees space)"]
        S3["3. Tool Output Pruning<br/>Trim bloated old<br/>tool results<br/>(frees space)"]
    end
```

---

## Strategy 1: Prompt Caching

### The Problem

Every time the loop calls the LLM (every turn), it sends the **entire input** from scratch. But parts of that input never change:

```mermaid
flowchart TD
    subgraph CALL1 ["Turn 1"]
        C1A["System prompt ← same every time"]
        C1B["Tool definitions ← same every time"]
        C1C["Your message"]
    end

    subgraph CALL2 ["Turn 2"]
        C2A["System prompt ← same every time"]
        C2B["Tool definitions ← same every time"]
        C2C["Your message"]
        C2D["LLM's previous reply"]
        C2E["Tool result"]
    end

    subgraph CALL3 ["Turn 3"]
        C3A["System prompt ← same every time"]
        C3B["Tool definitions ← same every time"]
        C3C["Everything from turns 1-2"]
        C3D["New messages"]
    end

    WASTE["The system prompt + tools<br/>(~8,000 tokens) are reprocessed<br/>every single turn.<br/>In 20 turns: 160,000 wasted tokens!"]

    CALL1 --> CALL2 --> CALL3 --> WASTE
```

### The Solution

LLM providers (like Anthropic) support **prompt caching**. You mark certain parts of the input as "cacheable." On the first call, those parts are processed and stored. On later calls, they're served from cache -- nearly free.

```mermaid
sequenceDiagram
    participant Loop as Agent Loop
    participant Cache as LLM Cache
    participant LLM

    Note over Loop: Turn 1
    Loop ->> Cache: System prompt + Tools (marked as cacheable)
    Cache ->> Cache: Process and STORE in cache
    Loop ->> LLM: + Your message
    LLM ->> Loop: Response

    Note over Loop: Turn 2
    Loop ->> Cache: System prompt + Tools
    Cache ->> Cache: CACHE HIT! Nearly free.
    Loop ->> LLM: + All messages so far
    LLM ->> Loop: Response

    Note over Loop: Turn 20
    Loop ->> Cache: System prompt + Tools
    Cache ->> Cache: CACHE HIT! Still free.
    Loop ->> LLM: + All messages so far
    LLM ->> Loop: Response
```

### Where to Place Cache Markers

A good strategy uses three cache breakpoints:

```mermaid
flowchart TD
    subgraph CACHED ["What Gets Sent to the LLM"]
        BP1["System prompt text<br/>← CACHE BREAKPOINT 1<br/>(rarely changes)"]
        BP2["Tool definitions<br/>← CACHE BREAKPOINT 2<br/>(only changes when plugins activate)"]
        BP3["Old messages (turns 1 to N-1)<br/>← CACHE BREAKPOINT 3<br/>(everything before newest exchange)"]
        NEW["Newest message<br/>(always new, never cached)"]

        BP1 --> BP2 --> BP3 --> NEW
    end
```

### Design Choices That Protect the Cache

Remember from Layer 1+: skill instructions go in **tool results**, not the system prompt. Now you see why -- if you changed the system prompt to add instructions, the cache would break:

```mermaid
flowchart LR
    subgraph BAD ["Inject into system prompt"]
        B1["System prompt changes"]
        B2["Cache INVALIDATED"]
        B3["Extra cost on<br/>EVERY future call"]
        B1 --> B2 --> B3
    end

    subgraph GOOD ["Inject via tool result"]
        G1["System prompt unchanged"]
        G2["Cache PRESERVED"]
        G3["Zero additional cost"]
        G1 --> G2 --> G3
    end
```

Also: **sort tools alphabetically** before sending them. If the order changes, the cache misses:

```
Turn 1 tools: [bash, edit, read, write]  → cached
Turn 2 tools: [edit, bash, write, read]  → MISS! Different order!

Turn 1 tools: [bash, edit, read, write]  → cached
Turn 2 tools: [bash, edit, read, write]  → HIT! Same order.
```

### The Plugin Activation Problem (Cold Turns)

There's a tension between Layer 1+ (Progressive Discovery) and caching. When a plugin activates, it **adds new tools** to the registry. This changes the tool definitions at cache breakpoint 2. Because caching is **prefix-based**, everything after the changed prefix also loses its cache:

```mermaid
flowchart TD
    subgraph BEFORE ["Turn N: Cache is warm"]
        direction TB
        B1["BP1: System prompt ✅ CACHED"]
        B2["BP2: Tools [bash, edit, read, write] ✅ CACHED"]
        B3["BP3: 50 messages of history ✅ CACHED"]
        B4["New message (always processed)"]
        B1 --- B2 --- B3 --- B4
    end

    ACTIVATE["Plugin activates!<br/>sentry_list_errors + sentry_get_detail<br/>added to tool registry"]

    subgraph AFTER ["Turn N+1: Cold turn"]
        direction TB
        A1["BP1: System prompt ✅ CACHED<br/>(unchanged, still hits)"]
        A2["BP2: Tools [bash, edit, read,<br/>sentry_get_detail, sentry_list_errors,<br/>write] ❌ MISS!<br/>(tools changed)"]
        A3["BP3: 50 messages of history ❌ MISS!<br/>(comes after BP2, so also reprocessed)"]
        A4["New message (always processed)"]
        A1 --- A2 --- A3 --- A4
    end

    BEFORE --> ACTIVATE --> AFTER
```

This **cold turn** means the entire conversation history gets reprocessed at full cost. If you have 150K tokens of history, that's 150K tokens billed at full input price instead of the cached price.

**But it's only one turn.** On the next call, the new tool set becomes the cached prefix. The cache re-warms:

```mermaid
flowchart LR
    subgraph T1 ["Turn N: Warm"]
        W1["All cached ✅"]
    end

    subgraph T2 ["Turn N+1: Cold (plugin activated)"]
        C1["BP1 ✅ BP2 ❌ BP3 ❌<br/>Full reprocessing"]
    end

    subgraph T3 ["Turn N+2: Warm again"]
        W2["All cached ✅<br/>(new tools are now<br/>part of the cached prefix)"]
    end

    T1 --> T2 --> T3
```

### Mitigating Cold Turn Costs

Several strategies reduce the impact of tool-change cache misses:

**1. Batch plugin activations.** If the LLM needs Sentry and Figma, activate both in the same turn. You pay one cold turn instead of two:

```
BAD:  activate_plugin("sentry")  → cold turn
      activate_plugin("figma")   → another cold turn (tools changed again!)

GOOD: activate_plugin("sentry") + activate_plugin("figma")  → one cold turn
      (both sets of tools added before the next LLM call)
```

**2. Avoid activation/deactivation cycles.** If a plugin idles out and gets deactivated, then the LLM needs it again later, that's two cold turns (one to remove, one to re-add). Consider longer idle timeouts for frequently-used plugins.

**3. Activate early, when context is small.** A cold turn with 10K tokens of history costs far less than one with 150K tokens. If you know certain plugins will be needed, activate them early in the conversation when the miss penalty is small:

```
Cold turn at 10K history:  10K tokens reprocessed  (~$0.03)
Cold turn at 150K history: 150K tokens reprocessed (~$0.45)
Same plugin — 15x the cost just from timing.
```

**4. Accept the cost.** One cold turn per plugin activation is usually acceptable. The real danger is **oscillation** -- repeatedly adding and removing tools, causing cold turns every few calls. As long as tool definitions stabilize quickly, the cost is a one-time blip.

**5. Use Code Mode.** The most radical mitigation: don't register plugin tools at all. Instead, expose plugin capabilities through 2 generic tools (`search_apis` + `execute_code`). The LLM searches for methods it needs, then writes code to call them. The tool list is permanently fixed, so cold turns never happen. See [Code Mode](./code-mode.md) for the full approach.

### Cost Impact

Prompt caching can reduce input costs by 90%+ for long conversations:

```
Without caching:  20 calls x 8K tokens = 160K tokens reprocessed
With caching:     1 cache creation + 19 cache hits ≈ 8K + nearly free
Savings: ~95%

With 1 plugin activation mid-session (at 100K context):
  19 cache hits + 1 cold turn (100K reprocessed) ≈ 108K total
  Savings: still ~67% vs no caching at all
```

---

## Strategy 2: Context Compaction

### The Problem

Even with caching, the conversation keeps growing. Every message, every tool result adds tokens. Eventually it **will** exceed the context window, and no amount of caching helps -- the entire history must fit.

```mermaid
flowchart LR
    T1["Turn 1<br/>8K tokens"]
    T10["Turn 10<br/>50K tokens"]
    T30["Turn 30<br/>120K tokens"]
    T45["Turn 45<br/>185K tokens"]
    T50["Turn 50<br/>ERROR!"]

    T1 --> T10 --> T30 --> T45 --> T50
```

### The Solution

When the conversation approaches the limit, ask the LLM to **summarize** everything into a compact summary. Then replace the old messages with this summary.

```mermaid
flowchart TD
    subgraph BEFORE ["BEFORE Compaction (185K tokens)"]
        B1["system + tools"]
        B2["msg 1"]
        B3["msg 2"]
        B4["..."]
        B5["msg 99"]
        B6["msg 100"]
        B1 --- B2 --- B3 --- B4 --- B5 --- B6
    end

    COMPACT["LLM summarizes<br/>everything into<br/>a short summary"]

    subgraph AFTER ["AFTER Compaction (~20K tokens)"]
        A1["system + tools"]
        A2["summary<br/>(~10K tokens)"]
        A1 --- A2
    end

    FREE["170K tokens of<br/>free space to<br/>continue working!"]

    BEFORE --> COMPACT --> AFTER --> FREE
```

### How Compaction Works Step by Step

```mermaid
flowchart TD
    DETECT["Step 1: Detect Overflow<br/>totalTokens (185K) > limit (200K) - buffer (20K)<br/>185K > 180K → overflow!"]

    SUMMARIZE["Step 2: Ask the LLM to Summarize<br/>'What was the goal?<br/>What's been accomplished?<br/>What files are relevant?<br/>What key decisions were made?<br/>What remains to be done?'"]

    RESULT["Step 3: LLM Returns a Summary<br/>'Goal: Build login page<br/>Done: Created Login.tsx, added API<br/>Decision: Using bcrypt + JWT<br/>Remaining: Add password reset'"]

    REPLACE["Step 4: Replace Old Messages<br/>Delete all old messages.<br/>Insert the summary as two new messages.<br/>Mark the boundary."]

    CONTINUE["Step 5: Continue Working<br/>The LLM now has the summary<br/>as context and can keep going."]

    DETECT --> SUMMARIZE --> RESULT --> REPLACE --> CONTINUE
```

### Multiple Compactions

In very long sessions, compaction happens multiple times. Each one builds on the previous summary:

```mermaid
flowchart LR
    subgraph C1 ["Turns 1-30"]
        T1["Normal<br/>operation"]
    end

    COMP1["Compaction #1<br/>Summarizes<br/>turns 1-31"]

    subgraph C2 ["Turns 32-55"]
        T2["Normal<br/>operation<br/>(context grows<br/>again)"]
    end

    COMP2["Compaction #2<br/>Summarizes<br/>previous summary<br/>+ turns 32-56"]

    subgraph C3 ["Turns 57+"]
        T3["And so on...<br/>forever!"]
    end

    C1 --> COMP1 --> C2 --> COMP2 --> C3
```

The agent can work **indefinitely** -- compaction keeps resetting the context.

---

## Strategy 3: Tool Output Pruning

### The Problem

Tool results are often the biggest items in the conversation. Reading a file might produce 10,000 tokens. Running `npm install` might produce 5,000 tokens. After many tool calls, old results dominate the context:

```mermaid
flowchart LR
    subgraph BREAKDOWN ["Context Breakdown After 30 Tool Calls"]
        direction TB
        A["System + tools: 8K tokens"]
        B["Your messages: 5K tokens"]
        C["LLM responses: 3K tokens"]
        D["Tool results: 160K tokens ⬅ 91% of total!"]
    end
```

Most of those tool results are from early turns and no longer relevant.

### The Solution

**Prune old tool results** by replacing their content with a short placeholder. Keep only the most recent results:

```mermaid
flowchart TD
    subgraph BEFORE ["BEFORE Pruning"]
        P1["Turn 5: read file A → 3,000 tokens"]
        P2["Turn 10: npm install log → 5,000 tokens"]
        P3["Turn 25: read file B → 8,000 tokens"]
        P4["Turn 28: build output → 2,000 tokens"]
    end

    PRUNE["Prune old results.<br/>Keep recent ones."]

    subgraph AFTER ["AFTER Pruning"]
        Q1["Turn 5: '[cleared]' → ~10 tokens (saved 2,990)"]
        Q2["Turn 10: '[cleared]' → ~10 tokens (saved 4,990)"]
        Q3["Turn 25: read file B → 8,000 tokens (kept)"]
        Q4["Turn 28: build output → 2,000 tokens (kept)"]
    end

    BEFORE --> PRUNE --> AFTER
```

The pruner walks **backward** from the newest message, protecting the most recent N tokens of tool output (e.g., 40,000) and clearing everything older.

---

## How All Three Strategies Work Together

```mermaid
flowchart TD
    MSG(["User sends a message"])
    BUILD["Build messages for the LLM"]
    OVER1{"Over token limit?"}
    PRUNE["Prune old tool outputs"]
    SUMMARIZE["Summarize conversation"]
    REPLACE["Replace old messages<br/>with summary"]
    CALL["Call the LLM<br/>(with prompt caching)"]
    RESPOND["LLM responds"]
    TOOLQ{"Tool calls?"}
    EXEC["Execute tools"]
    OVER2{"Over token limit?"}
    POSTCHECK{"Approaching limit?"}
    PRECOMPACT["Pre-compact for<br/>next turn"]
    DONE(["Done"])

    MSG --> BUILD
    BUILD --> OVER1
    OVER1 -->|"No"| CALL
    OVER1 -->|"Yes"| PRUNE
    PRUNE --> SUMMARIZE
    SUMMARIZE --> REPLACE
    REPLACE --> CALL
    CALL --> RESPOND
    RESPOND --> TOOLQ
    TOOLQ -->|"Yes"| EXEC
    EXEC --> OVER2
    OVER2 -->|"No"| CALL
    OVER2 -->|"Yes"| PRUNE
    TOOLQ -->|"No"| POSTCHECK
    POSTCHECK -->|"Yes"| PRECOMPACT
    PRECOMPACT --> DONE
    POSTCHECK -->|"No"| DONE
```

### A Long Session Timeline

```mermaid
flowchart TD
    subgraph PHASE1 ["Turns 1-30"]
        P1["Prompt caching active.<br/>Cache saves ~95% on system prompt.<br/>Context grows from 8K to 180K."]
    end

    subgraph COMPACT1 ["Turn 31: COMPACTION"]
        C1["Context at 180K.<br/>Prune old tool outputs.<br/>Summarize conversation.<br/>Context drops to ~20K."]
    end

    subgraph PHASE2 ["Turns 32-55"]
        P2["Prompt caching still active.<br/>Context grows from 20K to 175K."]
    end

    subgraph COMPACT2 ["Turn 56: COMPACTION #2"]
        C2["New summary builds on<br/>previous summary.<br/>Prune old tool outputs.<br/>Context drops to ~20K again."]
    end

    subgraph PHASE3 ["Turns 57-100+"]
        P3["Cycle continues.<br/>The agent can work indefinitely."]
    end

    PHASE1 --> COMPACT1 --> PHASE2 --> COMPACT2 --> PHASE3
```

---

## How This Changes Lower Layers

### Changes to Layer 0 (The Loop)

The loop now has a new step after executing tools:

```mermaid
flowchart TD
    EXEC["Execute tool"]
    CHECK{"Over token limit?"}
    COMPACT["Run compaction"]
    CONTINUE["Continue loop"]

    EXEC --> CHECK
    CHECK -->|"No"| CONTINUE
    CHECK -->|"Yes"| COMPACT
    COMPACT --> CONTINUE
```

It also has a **post-turn check**: after the loop ends, if the context is approaching the limit, pre-compact for the next turn.

### Changes to Layer 1 (Tools)

Tool definitions must be **sorted alphabetically** to keep the cache stable. The tool list sent to the LLM must be in the same order every time.

### Changes to Layer 1+ (Discovery)

Two design choices protect prompt caching:

1. **Skill instructions go in tool results** (not the system prompt) to avoid invalidating cache breakpoint 1.
2. **Plugin activations cause a cold turn** -- one cache miss when the tool list changes. The loop should batch multiple plugin activations into a single turn when possible, and avoid deactivating plugins that may be needed again soon. See [The Plugin Activation Problem](#the-plugin-activation-problem-cold-turns) above for details.

---

## Typical Constants

| Constant | Typical Value | Purpose |
|----------|---------------|---------|
| Context Limit | 200,000 | Maximum tokens the model handles |
| Compaction Buffer | 20,000 | Trigger compaction when this much space remains |
| Max Output Tokens | 8,000-16,000 | Reserved for the LLM's response |
| Prune Protection | 30,000-50,000 | Recent tool output tokens to keep |
| Min Prune Savings | 15,000-25,000 | Don't prune unless we save this much |

---

## What We Have So Far

```mermaid
flowchart TD
    subgraph AGENT ["Our Agent So Far"]
        LOOP["🔄 Layer 0: The Loop<br/>(now with overflow check)"]
        TOOLS["🔧 Layer 1: Tools<br/>(sorted for caching)"]
        DISC["🔍 Layer 1+: Discovery<br/>(cache-friendly design)"]
        CTX["📦 Layer 2: Context Mgmt<br/>(caching + compaction + pruning)"]

        LOOP <--> TOOLS
        TOOLS <--> DISC
        LOOP <--> CTX
    end

    PROBLEM["🤔 But wait...<br/>Compaction SUMMARIZES old messages.<br/>Summaries are lossy — they lose<br/>small but important details like<br/>'use tabs not spaces.'"]

    AGENT --> PROBLEM
    PROBLEM -->|"Solved in"| NEXT["Layer 3: Memory →"]
```

---

## Key Takeaways

1. **Prompt caching** avoids reprocessing identical parts (system prompt, tools), saving 90%+ on those tokens
2. **Context compaction** summarizes old messages when the window fills up, letting conversations run forever
3. **Tool output pruning** trims the biggest space hog (old tool results) while keeping recent ones
4. **All three work together**: caching reduces cost, pruning extends capacity, compaction resets when full
5. **Design choices matter**: sorted tools, stable system prompts, and tool-result-based skill injection all protect cache hits
6. **Plugin activations cause cold turns**: dynamic tool registration (from Layer 1+) changes the tool prefix, causing one full cache miss. Batch activations and activate early to minimize the cost
7. **This upgrades Layer 0**: the loop now checks for overflow after each turn and runs compaction when needed

---

> **Next:** [Layer 3: Observational Memory](./observational-memory.md) -- How do you remember important details that compaction throws away?

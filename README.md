# AI Agent Architecture Guide

> How AI agents work under the hood. No prior LLM knowledge required.

---

## 1. Start Here: What Is an LLM?

You've used ChatGPT or Claude. You type something, it types back. That's an **LLM** -- a Large Language Model.

An LLM is incredibly smart, but also incredibly limited. It's a **brain in a jar**:

```mermaid
flowchart TD
    subgraph LLM ["🧠 LLM"]
        A["text in ➜ text out"]
        B["✅ CAN: think, reason, explain, write code, make plans"]
        C["❌ CANNOT: read files, run code, browse the web, remember past conversations, or do ANYTHING in the real world"]
    end

```

If you ask an LLM "fix this bug," it can only **tell you how**. It can't actually open the file and fix it. It has no hands.

---

## 2. What Is an Agent?

An agent wraps the LLM with **tools** (hands) and a **loop** (persistence) so it can actually do work:

```mermaid
flowchart LR
    subgraph AGENT["🤖 AGENT"]
        direction LR
        LLM["🧠 LLM<br/>(brain)"]
        TOOLS["🔧 Tools<br/>(hands)"]
        WORLD["🌍 Real<br/>World"]

        LLM -->|"requests"| TOOLS
        TOOLS -->|"acts on"| WORLD
        WORLD -->|"results"| TOOLS
        TOOLS -->|"returns"| LLM
    end

    LLM -..->|"🔄 loop until done"| LLM

```

Here's the difference in practice:

```mermaid
flowchart TD
    subgraph WITHOUT["❌ WITHOUT Agent (LLM alone)"]
        direction TB
        W1["You: 'Fix the login bug'"]
        W2["LLM: 'You could try<br/>changing line 42 to...'"]
        W3["😩 You do the work yourself"]
        W1 --> W2 --> W3
    end

    subgraph WITH["✅ WITH Agent (LLM + tools + loop)"]
        direction TB
        A1["You: 'Fix the login bug'"]
        A2["📖 reads the file"]
        A3["🔍 finds the bug"]
        A4["✏️ edits the code"]
        A5["🧪 runs the tests"]
        A6["✅ 'Done! Here's what I changed.'"]
        A1 --> A2 --> A3 --> A4 --> A5 --> A6
    end

```

That's it. The formula is:

```mermaid
flowchart LR
    LLM["🧠 LLM<br/>(brain — thinks)"]
    TOOLS["🔧 Tools<br/>(hands — acts)"]
    LOOP["🔄 Loop<br/>(keeps going<br/>until done)"]

    LLM ---|"+"| TOOLS ---|"+"| LOOP

    RESULT(["= 🤖 Agent"])

    LOOP --- RESULT

```

---

## 3. The Five Layers

A working agent isn't just "LLM + tools + loop." As you build one, you hit problems. Each problem needs a new layer to solve it.

Think of it like building a house -- you start with the foundation and add floors:

```mermaid
flowchart TD
    L4["⚡ LAYER 4: SCALING — Spawn parallel sub-agents"]
    L3["💾 LAYER 3: LONG-TERM MEMORY — Background note-taker saves facts to disk"]
    L2["📦 LAYER 2: CONTEXT MANAGEMENT — Summarize old messages, cache repeated parts"]
    L1["🔧 LAYER 1: TOOLS & DISCOVERY — Give the LLM functions it can call"]
    L0["🔄 LAYER 0: THE LOOP — Keep calling the LLM until done"]
    FOUND["🧠 FOUNDATION: THE LLM — Text in, text out"]

    L4 --- L3 --- L2 --- L1 --- L0 --- FOUND
```

Here's the key idea: **each layer exists because the layer below it has a problem.**

```mermaid
flowchart TD
    P0["🤔 'I can only respond once.'"]
    L0["🔄 Layer 0: THE LOOP<br/>Now I can take multiple steps!"]

    P1["🤔 'But I can't actually read<br/>files or run commands.'"]
    L1["🔧 Layer 1: TOOLS<br/>Now I can act on the real world!"]

    P2["🤔 'But after 30 steps, the conversation<br/>is too long to fit in my memory.'"]
    L2["📦 Layer 2: CONTEXT MANAGEMENT<br/>Now I summarize old messages<br/>and keep going!"]

    P3["🤔 'But the summary lost the user's<br/>preference for tabs over spaces.'"]
    L3["💾 Layer 3: LONG-TERM MEMORY<br/>Now I write down key facts<br/>before summarizing!"]

    P4["🤔 'But this big task would be<br/>faster with parallel workers.'"]
    L4["⚡ Layer 4: SCALING<br/>Now I can spawn sub-agents<br/>to work in parallel!"]

    P0 -->|"solved by"| L0
    L0 --> P1
    P1 -->|"solved by"| L1
    L1 --> P2
    P2 -->|"solved by"| L2
    L2 --> P3
    P3 -->|"solved by"| L3
    L3 --> P4
    P4 -->|"solved by"| L4

```

> **You don't need all layers.** A simple agent only needs Layer 0 + Layer 1. Add more layers as your use case demands it.

---

## 4. How the Layers Work Together

When the user sends a message, every layer plays a role. Here's what happens:

```mermaid
flowchart TD
    USER(["👤 You: 'Fix the bug and add tests'"])
    USER --> BUILD

    subgraph LOOP ["🔄 LAYER 0: The Loop"]
        BUILD["📝 Build the prompt<br/>for the LLM"]
        CALL["🧠 Call the LLM"]
        DECIDE{"Did the LLM<br/>ask for tools?"}
        DONE["📤 Return response<br/>to user"]

        BUILD --> CALL
        CALL --> DECIDE
        DECIDE -->|"No, it's done"| DONE
    end

    subgraph T ["🔧 LAYER 1: Tools"]
        TOOLS["⚙️ Execute the tool"]
    end

    subgraph CTX ["📦 LAYER 2: Context Management"]
        OVERFLOW{"Is the conversation<br/>too long?"}
        COMPACT["✂️ Summarize old<br/>messages + prune"]
    end

    subgraph MEM ["💾 LAYER 3: Memory"]
        INJECT["📥 Inject saved<br/>observations into prompt"]
        OBSERVE["📝 Background: save<br/>new key facts to disk"]
    end

    subgraph SCALE ["⚡ LAYER 4: Scaling"]
        SPAWN["🚀 If spawn_agent:<br/>run parallel sub-agents"]
    end

    DECIDE -->|"Yes, use a tool"| TOOLS
    TOOLS --> OVERFLOW
    OVERFLOW -->|"No, fits fine"| CALL
    OVERFLOW -->|"Yes, overflow!"| COMPACT
    COMPACT --> CALL

    BUILD -.-|"reads from"| INJECT
    DONE -.-|"triggers"| OBSERVE
    TOOLS -.-|"may trigger"| SPAWN

```

**Read the diagram like this:**
1. Your message enters the **Loop** (Layer 0)
2. The loop builds a prompt. **Memory** (Layer 3) injects past observations into it.
3. The LLM is called. If it requests a tool, **Tools** (Layer 1) executes it. If that tool is `spawn_agent`, **Scaling** (Layer 4) creates a parallel worker.
4. After tool execution, **Context Management** (Layer 2) checks if the conversation is too long. If so, it summarizes.
5. The loop repeats until the LLM has no more tool requests.
6. After the loop ends, **Memory** (Layer 3) quietly saves key facts for next time.

---

## 5. What Happens Over a Long Conversation

The layers don't all kick in at once. They activate as the conversation grows. Here's what a 60-turn session looks like:

```mermaid
flowchart TD
    subgraph TIMELINE ["Context Size Over a 60-Turn Session"]
        direction LR
        T1["Turns 1-10: Context grows from 5K to 50K"]
        T2["Turns 10-30: Context grows to 180K"]
        T3["Turn 31: COMPACTION — drops to 80K"]
        T4["Turns 32-50: Context grows again to 170K"]
        T5["Turn 51: COMPACTION — drops to 80K again"]
        T6["Turns 52+: Cycle continues forever"]

        T1 --> T2 --> T3 --> T4 --> T5 --> T6
    end
```

```mermaid
flowchart LR
    T1["Turns 1-10: Layers 0+1 do the work every turn"]
    T2["Turn ~15: Layer 3 kicks in, saves facts to disk"]
    T3["Turn ~25: Layer 2 fires compaction, summarizes old messages"]
    T4["Turn ~50: Layer 4 spawns sub-agents for parallel work"]

    T1 --> T2 --> T3 --> T4
```

**Read the chart like this:**
- The line going **up** = the conversation is growing (more messages, more tool results)
- The line going **down** = compaction fired (old messages summarized, context freed)
- **Layer 0 + 1** are always active (the loop runs tools every turn)
- **Layer 2** kicks in when the line approaches the limit (caching saves money throughout; compaction saves space at overflow)
- **Layer 3** runs periodically (every ~30K new tokens) to save important facts
- **Layer 4** activates when the LLM decides a task can be parallelized

The agent can work **indefinitely** -- the context never overflows because Layer 2 keeps resetting it, and Layer 3 ensures nothing important is forgotten.

---

## 6. Detailed Guides

Each layer has its own document explaining the problem, solution, and step-by-step examples. Read them in order -- each builds on the previous:

| | Layer | Guide | What you'll learn |
|-|-------|-------|-------------------|
| L0 | The Loop | [agent-loop.md](./agent-loop.md) | The foundation -- how a while loop turns a one-shot LLM into a multi-step worker |
| L1 | Tools | [tool-execution.md](./tool-execution.md) | How the LLM requests actions (read files, run commands) and the loop executes them |
| L1+ | Discovery | [progressive-discovery.md](./progressive-discovery.md) | Loading skills and plugins on demand so the LLM isn't overwhelmed by 100+ tools |
| L1+ | Code Mode | [code-mode.md](./code-mode.md) | Replacing N tool definitions with 2 generic tools (`search_apis` + `execute_code`) to cut tokens, preserve cache, and reduce round trips |
| L2 | Context | [context-management.md](./context-management.md) | Caching, compaction, and pruning to keep conversations within the LLM's memory limit |
| L3 | Memory | [observational-memory.md](./observational-memory.md) | A background note-taker that saves important facts before compaction throws them away |
| L4 | Scaling | [subagents.md](./subagents.md) | Spawning parallel sub-agents to handle independent tasks at the same time |

> **Read them in order!** Each layer assumes you've read the ones before it. Layer 0 starts with zero assumptions. Each subsequent layer explains the problem created by the previous layer and what changes are needed at lower layers.

---

## 7. Glossary

New to this? Here are the key terms:

| Term | Plain English |
|------|--------------|
| **LLM** | The AI model (e.g., Claude, GPT). Thinks in text. Can't do anything else. |
| **Token** | How LLMs count words. 1 token ≈ 1 word ≈ 4 characters. |
| **Context Window** | The LLM's short-term memory. Has a hard limit (e.g., 200K tokens). |
| **System Prompt** | Secret instructions the LLM reads every time. You don't see them. |
| **Tool** | A function the LLM can ask to run. Like "read this file" or "run this command." |
| **Agent Loop** | The core cycle: ask the LLM what to do → do it → ask again → repeat. |
| **Compaction** | When the conversation is too long: summarize old messages and continue. |
| **Pruning** | Replacing old, large tool outputs with "[cleared]" to save space. |
| **Prompt Caching** | Don't re-read the same instructions every call. Saves ~90% cost. |
| **Observational Memory** | A background note-taker that writes down key facts to a file. |
| **Sub-agent** | A copy of the agent that handles one sub-task independently, in parallel. |
| **Skill** | A downloadable instruction set. "Here's how to do code review." |
| **Plugin** | An external service that gives the agent new tools at runtime. |
| **Code Mode** | Instead of many tool definitions, give the LLM 2 generic tools (`search_apis` + `execute_code`). The LLM searches for methods, then writes code. Saves tokens, preserves cache, reduces round trips. |
| **MCP** | Model Context Protocol. A standard way to connect LLMs to external tools. |

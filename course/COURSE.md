# Build an AI Agent From Scratch — A Hands-On Course

> **For absolute beginners.** No prior AI, LLM, or agent experience needed.
> **Learning style:** Build first, understand second. Every concept comes with code you run.

---

## Who Is This Course For?

You are a developer (or aspiring developer) who has:
- Used ChatGPT, Claude, or similar AI chatbots
- Basic programming knowledge (variables, functions, loops)
- Never built an AI agent before
- Never worked with the Claude/OpenAI API directly

By the end of this course, you will have **built a working AI agent from scratch** that can read files, write files, manage its own memory, and even spawn parallel workers — all running in your browser.

---

## What You Will Build

A **fully functional AI agent** with a 3-panel UI:

```
┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│   Chat       │   Trace      │   Files      │
│   Panel      │   Panel      │   Explorer   │
│              │              │              │
│  Talk to     │  Watch the   │  Browse the  │
│  your agent  │  agent think │  virtual     │
│              │  step by     │  file system │
│              │  step        │              │
└──────────────┴──────────────┴──────────────┘
```

You'll build it **layer by layer**, adding capabilities one at a time. Each module adds one new power:

| Module | What You Build | New Power |
|--------|---------------|-----------|
| 0 | A chatbot that can think in multiple steps | **The Loop** — multi-step reasoning |
| 1 | Give it "hands" — tools to read/write files | **Tools** — act on the real world |
| 2 | Load tools on demand instead of all at once | **Discovery** — scale to 100+ tools |
| 3 | Keep conversations running forever | **Context Management** — infinite memory |
| 4 | Remember important facts across sessions | **Long-Term Memory** — never forget |
| 5 | Run multiple tasks in parallel | **Sub-Agents** — teamwork |

---

## How This Course Works

### Learning By Doing

Every module follows the same pattern:

```
1. THE PROBLEM    → Why do we need this?
2. THE CONCEPT    → Plain English explanation (no jargon)
3. SEE IT WORK    → Run the existing code, observe behavior
4. BUILD IT       → Write the code yourself (guided)
5. BREAK IT       → Intentionally break things to understand them
6. CHALLENGE      → Extend it on your own
```

### The Reference App

This repo contains a working reference implementation called the **Boston App** (in `boston-app/`). It's a React + TypeScript app that runs entirely in the browser using WebLLM (a local AI model).

You have two options:
- **Follow along with the existing code** — Read, run, and modify the Boston App
- **Build your own from scratch** — Use the exercises to create your own implementation

We recommend: **start by reading and running the existing code**, then try the exercises to build your own version of each piece.

---

## Prerequisites

### Knowledge
- You know what a **function** is
- You know what a **loop** is (while/for)
- You know what **async/await** means (or are willing to learn — we explain it)
- You know what **JSON** is

### Setup
```bash
# Clone this repo
git clone <this-repo-url>
cd agent-learning

# Install dependencies
cd boston-app
npm install

# Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser. That's it.

> **No API keys needed!** The Boston App runs a small AI model directly in your browser using WebLLM. No backend, no API costs, no accounts needed.

---

## Course Modules

| # | Module | Time | File |
|---|--------|------|------|
| 0 | [From Chatbot to Agent: The Loop](./module-0-the-loop.md) | 45 min | The foundation — turn a one-shot chatbot into a multi-step worker |
| 1 | [Giving Your Agent Hands: Tools](./module-1-tools.md) | 60 min | How an LLM requests actions and how you execute them |
| 2 | [Smart Tool Loading: Progressive Discovery](./module-2-discovery.md) | 30 min | Load tools on demand so the LLM isn't overwhelmed |
| 3 | [Infinite Conversations: Context Management](./module-3-context.md) | 45 min | Summarize, prune, and cache to keep conversations going |
| 4 | [Never Forget: Observational Memory](./module-4-memory.md) | 30 min | A background note-taker that saves important facts |
| 5 | [Teamwork: Sub-Agents](./module-5-subagents.md) | 45 min | Spawn parallel workers to do multiple things at once |

**Total course time: ~4-5 hours** (at your own pace)

---

## The Big Picture

Before you start, here is the full picture of what you are building. Don't worry about understanding it yet — come back to this after each module and it will make more sense each time.

```
                    ┌─────────────────────────────┐
                    │     MODULE 5: SUB-AGENTS     │
                    │  Spawn parallel workers      │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │     MODULE 4: MEMORY         │
                    │  Background note-taker       │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │     MODULE 3: CONTEXT        │
                    │  Summarize + prune + cache   │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │     MODULE 2: DISCOVERY      │
                    │  Load tools on demand        │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │     MODULE 1: TOOLS          │
                    │  Give LLM hands to act       │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │     MODULE 0: THE LOOP       │
                    │  Multi-step reasoning        │
                    └──────────────┬──────────────┘
                    ┌──────────────┴──────────────┐
                    │        THE LLM               │
                    │   Text in → Text out         │
                    └─────────────────────────────┘
```

Each layer builds on the one below it. Each layer exists because **the layer below it has a problem**.

---

## Key Vocabulary (Just 10 Words)

You'll encounter these throughout the course. Bookmark this page.

| Word | Plain English | Analogy |
|------|--------------|---------|
| **LLM** | The AI brain. Takes text in, produces text out. | A very smart person locked in a room who can only communicate through notes |
| **Token** | How AI measures text length. ~1 word = ~1 token | Like "characters" but for AI — counting words instead of letters |
| **Context Window** | The AI's short-term memory limit (e.g., 200K tokens) | A desk that can only hold 200,000 sticky notes |
| **System Prompt** | Secret instructions you give the AI before the user talks | A job description the employee reads before their first day |
| **Tool** | A function the AI can ask your code to run | A button the AI can press that makes something happen in the real world |
| **Agent Loop** | Keep calling the AI until it's done | An employee who keeps working until the task is finished |
| **Compaction** | Summarize old messages to make room | Rewriting your 10-page notes into 2 pages of key points |
| **Pruning** | Remove old, less-important details | Crossing out old to-do items you've already finished |
| **Memory** | Facts saved to disk that survive summarization | Writing important things in a separate notebook |
| **Sub-Agent** | A separate AI worker handling one piece of the task | Assigning a sub-task to a teammate |

---

## Running the Tests

Every module has tests you can run to verify your understanding:

```bash
cd boston-app

# Run all tests
npm run test

# Run tests for a specific module
npm run test -- --grep "agent-loop"    # Module 0
npm run test -- --grep "tool"          # Module 1
npm run test -- --grep "discovery"     # Module 2
npm run test -- --grep "context"       # Module 3
npm run test -- --grep "memory"        # Module 4
npm run test -- --grep "sub-agent"     # Module 5
```

---

## Ready?

Start with **[Module 0: From Chatbot to Agent — The Loop](./module-0-the-loop.md)**.

No shortcuts — each module builds on the previous one. Trust the process.

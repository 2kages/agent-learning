# Module 0: From Chatbot to Agent — The Loop

> **Time:** ~45 minutes
> **Prerequisites:** You know what a function, loop, and async/await are
> **What you'll build:** The core engine that turns a one-shot chatbot into a multi-step agent
> **Key file:** `boston-app/src/agent/agent-loop.ts`

---

## Part 1: The Problem (5 min)

### What a chatbot does today

When you use ChatGPT or Claude, here's what happens:

```
You:     "Build me a login page"
ChatGPT: "Sure! Here's how you could do it:
          1. Create a file called login.tsx
          2. Add this code: ..."
```

The AI gives you **advice**. YOU have to do the work.

Now imagine if the AI could actually DO the work:

```
You:     "Build me a login page"
Agent:   *reads your project files*
         *creates login.tsx*
         *writes the code*
         *runs the tests*
         "Done! I created login.tsx and all tests pass."
```

That's an **agent**. Same brain, but it can take **multiple steps** and **act on the world**.

### Why can't a chatbot do this?

Because every time you call the AI, it gives you **one response** and stops. It's like texting someone who can only send ONE reply, ever.

```
┌──────────┐         ┌──────────┐
│   You    │──────>  │   LLM    │──────>  One reply. Done. Goodbye.
└──────────┘         └──────────┘
```

For real work, you need the AI to keep going — step after step after step.

### The key insight

**What if we just... keep calling it?**

```
┌──────────┐         ┌──────────┐
│   You    │──────>  │   LLM    │──────>  "I'll read the file first"
└──────────┘         └──────────┘
                         │
                         ▼  (call it again with the file contents)
                     ┌──────────┐
                     │   LLM    │──────>  "Now I'll write the code"
                     └──────────┘
                         │
                         ▼  (call it again)
                     ┌──────────┐
                     │   LLM    │──────>  "Done! Here's what I did."
                     └──────────┘
```

That's the **agent loop**. It's literally a while loop.

---

## Part 2: Understanding the Concept (10 min)

### The Agent Loop in Plain English

```
START:
  1. Send the conversation history to the AI
  2. The AI responds
  3. Did the AI request any tools? (like "read this file")
     → YES: Execute the tool, add the result to history, GO TO 1
     → NO:  The AI is done. Return its final text.
```

That's it. The entire foundation of every AI agent in the world is **a while loop**.

### But Wait — The AI Has No Memory!

Here's the surprising part: **the AI starts fresh every time you call it.** It has zero memory of previous calls.

So how does it "remember" what happened in step 1 when you call it in step 2?

**You send the ENTIRE conversation every time.**

```
Call 1:  "Hey AI, the user asked: 'Read my file'"
         AI says: "I'll read package.json"

Call 2:  "Hey AI, here's what happened so far:
         - User asked: 'Read my file'
         - You said: 'I'll read package.json'
         - Here's the file contents: { version: '1.0' }
         What do you want to do next?"
         AI says: "The version is 1.0"
```

The conversation is just **an array of messages** that grows with every step.

### Messages Have Roles

Every message has a `role` that tells the AI who said it:

| Role | Who | Example |
|------|-----|---------|
| `user` | You (or tool results) | "Read my package.json" |
| `assistant` | The AI | "I'll read that file" / tool request |

The roles **must alternate**: user, assistant, user, assistant, ...

This is enforced by the API. If you send two `user` messages in a row, the API returns an error.

### When Does the Loop Stop?

The AI signals it's done by **not requesting any tools**. There's no special "I'm finished" message — it just responds with text and no tool requests.

```typescript
// Pseudocode
if (response.stop_reason === 'tool_use') {
  // AI wants to use a tool → keep going
  continueLoop = true
} else {
  // AI just sent text → it's done
  continueLoop = false
}
```

---

## Part 3: See It Work (10 min)

### Exercise 0.1: Run the Boston App

```bash
cd boston-app
npm install
npm run dev
```

Open http://localhost:5173?mock in your browser (the `?mock` flag uses a mock AI engine for testing — no model download needed).

Type a message and watch:
1. The **Chat Panel** shows your message
2. The **Trace Panel** shows events: `loop_start`, `llm_call`, `llm_response`, `loop_end`
3. The loop calls the AI, gets a response, and exits (because the mock AI doesn't request tools)

### Exercise 0.2: Read the Code

Open `boston-app/src/agent/agent-loop.ts` and read it. It's only ~106 lines. Here's the key structure:

```typescript
// This is the entire agent loop. Really.
export async function* runAgentLoop(
  userMessage: string,
  options: AgentLoopOptions
): AsyncGenerator<TraceEvent, string> {

  // 1. Create the conversation history with the user's message
  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userMessage }] },
  ]

  yield { type: 'loop_start' }

  // 2. THE LOOP — keep calling the AI
  for (let turn = 0; turn < maxTurns; turn++) {

    // 3. Call the AI with the full history
    const response = await engine.chat(messages, systemPrompt, tools)

    // 4. Add the AI's response to history
    messages.push({ role: 'assistant', content: response.content })

    // 5. Did the AI request tools?
    if (response.stop_reason !== 'tool_use') {
      break  // No tools → done!
    }

    // 6. Execute each tool, add results to history
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

    // 7. Add tool results as a user message (API requirement)
    messages.push({ role: 'user', content: toolResults })
    // → Loop back to step 3
  }

  yield { type: 'loop_end' }
  return finalText
}
```

### The `AsyncGenerator` Pattern

Notice the function is `async function*` — that makes it an **async generator**. Instead of returning one value, it **yields** multiple values over time.

Why? So the UI can show progress in real-time:

```typescript
// In the React hook (useAgent.ts):
for await (const event of runAgentLoop(message, options)) {
  // Each event updates the UI immediately
  if (event.type === 'llm_call') showSpinner()
  if (event.type === 'tool_call') showToolExecution(event)
  if (event.type === 'loop_end') hideSpinner()
}
```

Think of it like a live sports broadcast — you don't wait until the game is over to get updates. You get play-by-play as it happens.

---

## Part 4: Build It Yourself (15 min)

### Exercise 0.3: Write a Minimal Agent Loop

Create a new file `boston-app/src/exercises/my-agent-loop.ts`:

```typescript
import type { LLMEngine, LLMMessage, LLMResponse, ToolDefinition } from '../agent/types'

/**
 * YOUR TASK: Write the simplest possible agent loop.
 *
 * Requirements:
 * 1. Take a user message and call the LLM
 * 2. If the LLM doesn't request tools → return its text
 * 3. If the LLM requests tools → you can't execute them yet (no tool
 *    registry), so just return "Tools requested but not implemented"
 * 4. Use a while loop, not recursion
 *
 * Hints:
 * - Start with an array: const messages: LLMMessage[] = [...]
 * - The LLM's response has a stop_reason: 'end_turn' or 'tool_use'
 * - Text content looks like: { type: 'text', text: '...' }
 */
export async function myAgentLoop(
  userMessage: string,
  engine: LLMEngine,
  systemPrompt: string
): Promise<string> {
  // YOUR CODE HERE
  // Step 1: Create the messages array with the user's message
  // Step 2: Loop — call engine.chat(), check stop_reason
  // Step 3: Return the final text
}
```

**Try it yourself first!** Then check the solution below.

<details>
<summary>Solution (click to reveal)</summary>

```typescript
export async function myAgentLoop(
  userMessage: string,
  engine: LLMEngine,
  systemPrompt: string
): Promise<string> {
  // Step 1: Create the conversation with the user's message
  const messages: LLMMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userMessage }] },
  ]

  // Step 2: The loop
  let continueLoop = true

  while (continueLoop) {
    // Call the LLM
    const response: LLMResponse = await engine.chat(messages, systemPrompt, [])

    // Add the AI's response to history
    messages.push({ role: 'assistant', content: response.content })

    // Check: did it request tools?
    if (response.stop_reason === 'tool_use') {
      // We can't execute tools yet — that's Module 1!
      return 'Tools requested but not implemented yet'
    }

    // No tools → done
    continueLoop = false
  }

  // Extract the final text
  const lastMessage = messages[messages.length - 1]
  const textBlock = lastMessage.content.find(b => b.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : ''
}
```

</details>

### Exercise 0.4: Test Your Loop

Run the existing tests to verify the loop behavior:

```bash
cd boston-app
npm run test -- agent-loop.test
```

Read `tests/unit/agent-loop.test.ts` to see how the MockLLMEngine works. It lets you pre-program the AI's responses:

```typescript
// From the test file — this is how you set up a mock AI
const engine = new MockLLMEngine()
engine.addResponse({
  content: [{ type: 'text', text: 'Hello!' }],
  stop_reason: 'end_turn',
})

// Now when your loop calls engine.chat(), it will return "Hello!"
```

---

## Part 5: Break It (5 min)

### Exercise 0.5: What Happens If...

Try these experiments (in the tests or by modifying the code):

1. **What if the AI always requests tools?** The loop runs until `maxTurns` and stops. Without this safety limit, it would run forever.

2. **What if you send messages out of order (user, user, assistant)?** The API would reject it. The roles must alternate.

3. **What if the messages array is empty?** The LLM API returns an error — it needs at least one user message.

4. **What if maxTurns is 0?** The loop never executes. The agent returns empty text.

---

## Part 6: Challenge

### Exercise 0.6: Add a Turn Counter

Modify the agent loop to yield a trace event for each turn that includes the turn number:

```typescript
yield { type: 'turn_start', turn: 1 }
yield { type: 'turn_start', turn: 2 }
// etc.
```

Watch the Trace Panel update with the turn numbers as the agent works.

---

## Key Takeaways

1. **An agent is just a while loop** around an LLM call
2. **The LLM has no memory** — you re-send the entire conversation every call
3. **Messages alternate roles** — user, assistant, user, assistant...
4. **The loop stops** when the LLM doesn't request any tools
5. **Tool results are user messages** — this is an API convention, not a design choice
6. **The conversation grows** — every tool call adds more messages (this becomes a problem in Module 3)

---

## What's Next?

Right now our loop can call the AI repeatedly, but the AI can't actually DO anything. It can't read files, write files, or run commands. It's still a brain with no hands.

**[Module 1: Giving Your Agent Hands — Tools →](./module-1-tools.md)**

In Module 1, you'll learn how the AI requests actions and how your code executes them. You'll give your agent its first real tools.

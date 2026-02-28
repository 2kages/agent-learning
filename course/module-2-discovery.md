# Module 2: Smart Tool Loading — Progressive Discovery

> **Time:** ~30 minutes
> **Prerequisites:** Complete [Module 1: Tools](./module-1-tools.md)
> **What you'll build:** A skill system that loads tools on-demand
> **Key file:** `boston-app/src/agent/progressive-discovery.ts`

---

## Part 1: The Problem (5 min)

Your agent has tools — great! But real-world agents have **many** tools:

| Agent | # of Tools |
|-------|-----------|
| Simple chatbot | 3-5 |
| Code assistant | 20-30 |
| Full agent (with plugins) | 100-500+ |

Sending all 500 tool definitions on every API call creates two problems:

1. **Token waste**: Each tool definition is ~100-200 tokens. 500 tools = 50,000-100,000 tokens burned on every call just for tool descriptions. That's half your context window gone before the conversation even starts.

2. **Decision paralysis**: When the LLM sees 500 tools, it gets confused. Like a restaurant with a 50-page menu — too many choices lead to worse decisions.

```
┌──────────────────────────────────────┐
│  Context Window (200K tokens)         │
│                                       │
│  ████████████████████  Tool Defs      │  ← 50K tokens wasted
│  ██                    System Prompt  │
│  ████                  Conversation   │
│  ░░░░░░░░░░░░░░░░░░░  FREE SPACE     │
│                                       │
│  Half your memory is tool definitions!│
└──────────────────────────────────────┘
```

### The key question

How do you give the LLM access to hundreds of tools without wasting tokens?

---

## Part 2: The Concept (10 min)

### The Solution: A Tool Menu

Instead of loading all tools, you show the LLM a **menu** of available **skills** (groups of related tools). The LLM reads the menu and activates only the skills it needs.

```
BEFORE (all tools loaded):
  Tool 1: read_file        ← always loaded
  Tool 2: write_file       ← always loaded
  Tool 3: run_test         ← always loaded
  Tool 4: deploy           ← always loaded
  Tool 5: send_email       ← always loaded
  ... 495 more tools ...   ← always loaded, rarely used

AFTER (progressive discovery):
  Tool 1: read_file        ← always loaded (core tool)
  Tool 2: write_file       ← always loaded (core tool)
  Meta-tool: activate_skill ← always loaded

  Available Skills:
  - "testing": Tools for running tests
  - "deployment": Tools for deploying
  - "email": Tools for sending emails

  LLM sees the menu, activates "testing" when needed →
  Tool 3: run_test         ← NOW loaded
  Tool 4: check_coverage   ← NOW loaded
```

### How It Works

1. **Skills are registered** — each skill is a name + description + list of tools
2. **The LLM sees a catalog** — skill names and descriptions in the system prompt
3. **One meta-tool**: `activate_skill` — the LLM calls this to load a skill
4. **Activation loads tools** — the skill's tools are registered into the tool registry
5. **Idempotent** — activating the same skill twice is safe (no-op)

### The Skill Registry

```typescript
class SkillRegistry {
  private skills = new Map<string, SkillDefinition>()
  private activated = new Set<string>()

  addSkill(skill): void { ... }         // Register a skill
  activate(name, toolRegistry): void { ... } // Load its tools
  buildCatalogPrompt(): string { ... }  // "Here are available skills..."
}
```

### Why "Progressive"?

Because tools are discovered **progressively** — only when the LLM realizes it needs them:

```
Turn 1: LLM sees "testing" skill in catalog
Turn 2: User asks "Run the tests"
Turn 3: LLM calls activate_skill("testing")
Turn 4: LLM now has run_test, check_coverage tools
Turn 5: LLM calls run_test(...)
```

The LLM doesn't have to know upfront what it needs. It discovers capabilities as it goes.

---

## Part 3: See It Work (5 min)

### Exercise 2.1: Read the Skill Registry

Open `boston-app/src/agent/progressive-discovery.ts` (133 lines).

Key things to notice:
- `addSkill()` registers a skill but doesn't load its tools
- `activate()` is idempotent — the `activated` Set prevents double-loading
- `buildCatalogPrompt()` creates a readable list for the system prompt
- `createActivateSkillTool()` creates the meta-tool that the LLM uses

### Exercise 2.2: Trace Skill Activation

Run the tests:

```bash
cd boston-app
npm run test -- progressive-discovery
```

Watch how:
1. Skills are registered (3 tools available through skills)
2. Only the `activate_skill` tool is in the registry initially
3. After calling `activate("testing", registry)`, the testing tools appear
4. Activating again is safe — no duplicate tools

---

## Part 4: Build It Yourself (10 min)

### Exercise 2.3: Create a Skill

Create a "math" skill that bundles the calculator tool from Module 1 with a new `convert_units` tool:

```typescript
import type { SkillDefinition } from '../agent/progressive-discovery'
import { calculatorTool } from './calculator-tool'

/**
 * YOUR TASK: Create a skill definition for math tools.
 *
 * The skill should:
 * - Be named 'math'
 * - Have a description about mathematical operations
 * - Include the calculatorTool from Module 1
 * - Include a new convert_units tool (e.g., km to miles)
 * - Have instructions for the LLM on how to use these tools
 */
export const mathSkill: SkillDefinition = {
  name: 'math',
  description: 'Mathematical operations: calculations and unit conversions',
  instructions: 'You now have access to math tools. Use calculate for expressions and convert_units for unit conversions.',
  tools: [
    calculatorTool,
    // YOUR CODE: add a convert_units tool
  ]
}
```

<details>
<summary>Solution (click to reveal)</summary>

```typescript
import type { SkillDefinition } from '../agent/progressive-discovery'
import type { Tool } from '../agent/types'
import { calculatorTool } from './calculator-tool'

const convertUnitsTool: Tool = {
  definition: {
    name: 'convert_units',
    description: 'Convert a value between units (e.g., km to miles, kg to lbs)',
    input_schema: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'The value to convert' },
        from: { type: 'string', description: 'Source unit (km, miles, kg, lbs, C, F)' },
        to: { type: 'string', description: 'Target unit' },
      },
      required: ['value', 'from', 'to'],
    },
  },
  execute: async (input) => {
    const { value, from, to } = input as { value: number; from: string; to: string }
    const conversions: Record<string, Record<string, number>> = {
      km: { miles: 0.621371 },
      miles: { km: 1.60934 },
      kg: { lbs: 2.20462 },
      lbs: { kg: 0.453592 },
    }
    const rate = conversions[from]?.[to]
    if (!rate) {
      return { output: `Cannot convert from ${from} to ${to}`, isError: true }
    }
    return { output: `${value} ${from} = ${value * rate} ${to}`, isError: false }
  },
}

export const mathSkill: SkillDefinition = {
  name: 'math',
  description: 'Mathematical operations: calculations and unit conversions',
  instructions: 'You now have math tools. Use `calculate` for math expressions and `convert_units` for unit conversions between km/miles, kg/lbs.',
  tools: [calculatorTool, convertUnitsTool],
}
```

</details>

### Exercise 2.4: Wire It Up

```typescript
import { SkillRegistry } from '../agent/progressive-discovery'
import { ToolRegistry } from '../agent/tool-registry'
import { mathSkill } from './math-skill'

const toolRegistry = new ToolRegistry()
const skillRegistry = new SkillRegistry()

// Register the skill (NOT the individual tools)
skillRegistry.addSkill(mathSkill)

// Create the meta-tool
const activateTool = skillRegistry.createActivateSkillTool(toolRegistry)
toolRegistry.register(activateTool)

// At this point, the LLM can see:
// - activate_skill (always available)
// But NOT calculate or convert_units (not activated yet)

console.log(toolRegistry.getDefinitions())
// → [{ name: 'activate_skill', ... }]

// When the LLM calls: activate_skill({ skill_name: 'math' })
skillRegistry.activate('math', toolRegistry)

console.log(toolRegistry.getDefinitions())
// → [{ name: 'activate_skill', ... }, { name: 'calculate', ... }, { name: 'convert_units', ... }]
```

---

## Part 5: Break It (3 min)

### Exercise 2.5: Edge Cases

1. **Activate a skill that doesn't exist:** Returns an error message listing available skills
2. **Activate the same skill twice:** Second call is a no-op (idempotent)
3. **Remove the activate_skill tool:** The LLM can't load any skills — it's stuck with whatever is already registered

---

## Part 6: Challenge

### Exercise 2.6: Build a "Coding" Skill

Create a skill that includes tools for:
- `lint_code` — checks code for common mistakes (simulate with regex checks)
- `format_code` — formats code (simulate with basic indentation)
- `count_lines` — counts lines of code in a file

Register it alongside the math skill and verify that the skill catalog shows both.

---

## Key Takeaways

1. **Don't load all tools upfront** — it wastes tokens and confuses the LLM
2. **Skills are bundles** — a name + description + tools + instructions
3. **One meta-tool unlocks everything** — `activate_skill` is the gateway
4. **The LLM discovers what it needs** — it reads the catalog and activates on demand
5. **Activation is idempotent** — safe to call multiple times

---

## What's Next?

Our agent now has a loop (Module 0), tools (Module 1), and smart tool loading (Module 2). It can work on multi-step tasks.

But there's a ticking time bomb: **the conversation keeps growing**. After 30+ turns, the messages array can exceed the LLM's context window. Then everything crashes.

**[Module 3: Infinite Conversations — Context Management →](./module-3-context.md)**

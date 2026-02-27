/** WebLLM model to use — smallest viable for JSON tool calling */
export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

/** Max turns before the agent loop force-stops */
export const MAX_AGENT_TURNS = 20

/** Default system prompt */
export const SYSTEM_PROMPT = `You are a helpful coding assistant. You have access to a virtual file system where you can read, write, list, and search files. Use the available tools to help the user.

When the user asks you to do something, think step by step and use tools as needed. When you're done, respond with a clear summary of what you did.`

export const MEMORY_PROMPT = `I'm moving what you know about me into Feega, a design and motion canvas with an AI agent.

Write ONE markdown document, inside a single code block, with everything you remember about me that would help it work the way I like. Use these headings and skip any you know nothing about:

## Who I am
Name, role, company or clients, what I make.

## How I like to work
Tone, level of detail, things I always ask for, things I never want.

## Taste
Visual style, brands and references I like, type and colour preferences, what I call ugly.

## Projects
What I am working on now, with the facts worth keeping.

## Tools
The apps, stacks and formats I use.

Write facts and preferences, not a conversation. No secrets, passwords or keys. If you are unsure about something, leave it out.`;

export const MEMORY_TOOLS = ['claude', 'codex', 'gemini', 'cursor'] as const;

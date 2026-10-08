# feega CLI (fallback)

Use when MCP is not connected. Same OAuth session as MCP (`~/.config/feega/session.json`).
Every command is brand-scoped (`feega <command> <slug>`).

## Install

```bash
curl -sSL https://raw.githubusercontent.com/andreabuttarelli/feega/main/cli/scripts/install.sh | bash
feega login
```

From source (Bun):

```bash
git clone https://github.com/andreabuttarelli/feega.git
cd feega/cli && bun install
bun run cli.ts --help
```

## Commands

```bash
feega brands                                    # List brands
feega health                                     # Check Supabase / Gemini
feega dashboard <slug>                          # Brand overview
feega products <slug> [sync]                    # List, or re-import from the connected store
feega ads <slug>                                  # Meta ad campaigns of the brand
feega ads <slug> --approve <id> | --pause <id> | --resume <id>
feega upgrade <slug> --credits 16               # Checkout a monthly plan (8/16/32/64/128/256)
feega upgrade <slug> --top-up 8                 # One-time top-up, credits never expire
feega update                                    # Update the CLI itself
```

`--id` and ad ids accept the short prefix printed in the tables. Full command reference and
flags: [`cli/README.md`](../../../README.md).

## MCP instead

MCP reaches the whole org directly (`query`, `insert_row`, `ask_motion_agent`, `run_node_generation`,
…) and is preferred when connected — see [mcp.md](mcp.md). Tool ↔ command mapping:
[tools.md](tools.md).

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
feega products <slug> [sync]                    # List, or re-import from the connected store
feega upgrade <slug>                            # Checkout the plan (€9 / editor / month, 500 credits)
feega upgrade <slug> --top-up 1000              # One-time top-up (1000/2000/5000), never expires
feega update                                    # Update the CLI itself
```

`--id` ids accept the short prefix printed in the tables. Full command reference and
flags: [`cli/README.md`](../../../README.md).

## MCP instead

MCP reaches the whole org directly (`query`, `insert_row`, `run_node_generation`,
…) and is preferred when connected — see [mcp.md](mcp.md). Tool ↔ command mapping:
[tools.md](tools.md).
